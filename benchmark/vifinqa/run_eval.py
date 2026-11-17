#!/usr/bin/env python3
"""Evaluate the real Finsight RAG pipeline on the hand-verified ViFinQA subset.

The reports must already be indexed in one Finsight session (upload the converted
files from ``data/vifinqa/corpus`` via the app/API, see README). This script then
runs every gold question through ``RAGPipeline`` *in-process* with **no chat
history**, so questions cannot contaminate each other, and scores:

  * report_hit     – did retrieval return a chunk from the report(s) that hold the answer?
  * context_hit    – do the gold numbers appear in the retrieved context?
  * answer_correct – do ALL numbers of ANY acceptable gold set appear in the answer?
  * abstained      – did the system refuse (counts as wrong, but distinct from a wrong number)?

    python -m benchmark.vifinqa.run_eval --session-id <id>
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

_ROOT = Path(__file__).resolve().parents[2]
if str(_ROOT) not in sys.path:
    sys.path.insert(0, str(_ROOT))

from benchmark.rag import metrics as M  # noqa: E402

_HERE = Path(__file__).resolve().parent


def any_set_present(text: str, alternatives: list[list[str]]) -> bool:
    found = M.extract_numbers(text)
    for alt in alternatives:
        gold = {c for g in alt if (c := M._canon_number(g)) is not None}
        if gold and gold <= found:
            return True
    return False


def evaluate(session_id: str, gold_path: Path, pause: float, limit: int | None, use_calculator: bool = True) -> dict:
    from src.analysis import format_calculation, try_calculate
    from src.serving.deps import get_db, get_files, get_pipeline  # imported late: loads models
    from src.serving.routes.chat import _session_analyses

    pipe = get_pipeline()
    analyses = _session_analyses(session_id, get_db(), get_files()) if use_calculator else []
    items = [json.loads(line) for line in gold_path.read_text(encoding="utf-8").splitlines() if line.strip()]
    if limit:
        items = items[:limit]
    rows = []
    for i, it in enumerate(items, 1):
        t0 = time.time()
        row = {"id": it["id"], "ticker": it["ticker"], "question": it["question"], "gold": it["gold_answer"]}
        try:
            # Same order as the chat endpoint: the deterministic calculator first,
            # retrieval + LLM for everything it declines.
            calc = try_calculate(it["question"], analyses) if use_calculator else None
            if calc is not None:
                answer = format_calculation(calc)
                docs = sorted({c["doc_name"] for c in calc.citations()})
                context = answer
                n_sources = len(calc.citations())
                via = "calculator"
            else:
                sources = pipe.retrieve(session_id, it["question"])
                context = "\n".join(s.text for s in sources)
                result = pipe.answer(session_id, it["question"], history=None)
                answer = result.answer
                docs = sorted({s.doc_name for s in result.sources} | {s.doc_name for s in sources})
                n_sources = len(result.sources)
                via = "rag"
            row.update(
                via=via,
                answer=answer,
                retrieved_docs=docs,
                report_hit=any(r in docs for r in it["required_reports"]),
                all_reports_hit=all(r in docs for r in it["required_reports"]),
                context_hit=any_set_present(context, it["gold_alternatives"]),
                answer_correct=any_set_present(answer, it["gold_alternatives"]),
                abstained=M.is_abstention(answer),
                n_sources=n_sources,
            )
        except Exception as exc:  # noqa: BLE001 - keep the run going, record the failure
            row.update(error=f"{type(exc).__name__}: {exc}", report_hit=False, all_reports_hit=False,
                       context_hit=False, answer_correct=False, abstained=False)
        row["seconds"] = round(time.time() - t0, 1)
        rows.append(row)
        flag = "OK " if row["answer_correct"] else "XX "
        print(f"[{i}/{len(items)}] {flag}{it['ticker']} #{it['id']} via={row.get('via', '-')} "
              f"report_hit={row['report_hit']} ctx={row['context_hit']} ({row['seconds']}s)", flush=True)
        # the calculator makes no LLM call, so there is nothing to rate-limit
        if pause and i < len(items) and row.get("via") != "calculator":
            time.sleep(pause)  # stay under the LLM provider's tokens-per-minute cap

    n = len(rows)
    pct = lambda k: round(100 * sum(1 for r in rows if r[k]) / n, 1) if n else 0.0  # noqa: E731
    summary = {
        "n": n, "report_hit_pct": pct("report_hit"), "all_reports_hit_pct": pct("all_reports_hit"),
        "context_hit_pct": pct("context_hit"), "answer_correct_pct": pct("answer_correct"),
        "abstained_pct": pct("abstained"), "errors": sum(1 for r in rows if "error" in r),
        "answered_by_calculator": sum(1 for r in rows if r.get("via") == "calculator"),
        "calculator_correct": sum(1 for r in rows if r.get("via") == "calculator" and r["answer_correct"]),
        "rag_n": sum(1 for r in rows if r.get("via") == "rag"),
        "rag_correct": sum(1 for r in rows if r.get("via") == "rag" and r["answer_correct"]),
    }
    return {"run": datetime.now(timezone.utc).isoformat(timespec="seconds"), "session_id": session_id, "summary": summary, "rows": rows}


def to_markdown(rep: dict) -> str:
    s = rep["summary"]
    lines = [
        "# ViFinQA subset — Finsight RAG evaluation", "",
        f"- Run: `{rep['run']}`  |  Questions: **{s['n']}** (hand-verified gold)  |  Errors: {s['errors']}", "",
        "| Metric | Score |", "|---|---|",
        f"| Report retrieved (a chunk from a needed report) | {s['report_hit_pct']}% |",
        f"| All needed reports retrieved (multi-doc questions) | {s['all_reports_hit_pct']}% |",
        f"| Gold number present in retrieved context | {s['context_hit_pct']}% |",
        f"| **Answer correct** (gold number in answer) | **{s['answer_correct_pct']}%** |",
        f"| Abstained (\"not found\") | {s['abstained_pct']}% |",
        f"| Answered by the calculator | {s['answered_by_calculator']} (correct: {s['calculator_correct']}) |",
        f"| Answered by RAG + LLM | {s['rag_n']} (correct: {s['rag_correct']}) |", "",
        "| # | Co | Via | Report✓ | Ctx✓ | Answer✓ | Abstain | Gold | Answer (first 160 chars) |", "|---|---|---|---|---|---|---|---|---|",
    ]
    for r in rep["rows"]:
        a = (r.get("answer") or r.get("error", "")).replace("\n", " ").replace("|", "/")[:160]
        yn = lambda b: "✅" if b else "❌"  # noqa: E731
        lines.append(f"| {r['id']} | {r['ticker']} | {r.get('via', '-')} | {yn(r['report_hit'])} | {yn(r['context_hit'])} | "
                     f"{yn(r['answer_correct'])} | {yn(r['abstained'])} | {r['gold']} | {a} |")
    return "\n".join(lines) + "\n"


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--session-id", required=True)
    ap.add_argument("--gold", type=Path, default=_HERE / "gold_v1.jsonl")
    ap.add_argument("--pause", type=float, default=25.0, help="seconds between questions (rate limit)")
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--no-calculator", action="store_true", help="RAG only (compare with/without the calculator)")
    args = ap.parse_args()
    rep = evaluate(args.session_id, args.gold, args.pause, args.limit, use_calculator=not args.no_calculator)
    out = _HERE / "results"
    out.mkdir(exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S")
    (out / f"vifinqa_eval_{stamp}.json").write_text(json.dumps(rep, ensure_ascii=False, indent=1), encoding="utf-8")
    md = to_markdown(rep)
    (out / f"vifinqa_eval_{stamp}.md").write_text(md, encoding="utf-8")
    (out / "latest.md").write_text(md, encoding="utf-8")
    print(json.dumps(rep["summary"], ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
