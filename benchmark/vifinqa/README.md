# ViFinQA subset benchmark

Checks the real Finsight pipeline on real Vietnamese annual reports (OCR text from
the [ViFinQA](https://huggingface.co/datasets/) release, 100 listed companies).

The ViFinQA release ships **questions only — no answers**. `gold_v1.jsonl` holds
13 questions (VNM, MBB, HPG) whose answers were **read by hand** from the OCR text;
every item stores the source report and an evidence quote so it can be re-checked.

> **License:** the reports come from the TiniX OCR corpus (CC BY-NC 4.0). Keep the
> converted files in `data/vifinqa/` (git-ignored) and use them for local,
> non-commercial evaluation only.

## Run

```bash
# 1. convert the needed reports (HTML tables -> Markdown tables, page markers)
python -m benchmark.vifinqa.prepare --src <ViFinQA dir> --dst data/vifinqa/corpus \
    --report VNM:2025:consolidated --report VNM:2020:consolidated ...   # see gold_v1.jsonl "required_reports"

# 2. upload every converted file into ONE Finsight session (app UI or API) and wait
#    until all are "Sẵn sàng". Embedding runs on CPU: expect ~8-10 min per report.

# 3. evaluate (backend infra up: docker compose up -d; GROQ key in .env)
python -m benchmark.vifinqa.run_eval --session-id <session id>
```

Results are written to `results/latest.md` (+ timestamped `.json`/`.md`).

## Metrics

| Metric | Meaning |
|---|---|
| Report retrieved | a retrieved chunk comes from a report that holds the answer |
| Gold number in context | the correct figure is inside the retrieved context (retrieval worked) |
| **Answer correct** | all numbers of any acceptable gold set appear in the answer (Vietnamese number canonicalisation, so `953.046.624.309` ≡ `953,05 tỷ`) |
| Abstained | the system said "not found" |

Each question runs with **no chat history**, so questions don't influence each other.

## Files

- `prepare.py` — ViFinQA `.txt` → Finsight Markdown converter
- `build_gold.py` → `gold_v1.jsonl` — hand-verified gold set (regenerate with `python benchmark/vifinqa/build_gold.py`)
- `run_eval.py` — evaluation harness
