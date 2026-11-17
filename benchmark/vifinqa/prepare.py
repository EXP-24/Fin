#!/usr/bin/env python3
"""Convert ViFinQA OCR reports into the Markdown layout Finsight ingests.

ViFinQA stores each report as plain text with ``===== PAGE N =====`` markers and
HTML ``<table>`` markup (with row/col spans). Finsight's chunker
(``src/rag/chunking.py``) expects ``<!-- ===== page N ===== -->`` markers and
Markdown tables, so this script converts one into the other. Nothing else about
the text is changed.

NOTE: ViFinQA reports are derived from the TiniX OCR corpus (CC BY-NC 4.0). Keep
the converted files out of git (``data/vifinqa/`` is git-ignored) and use them
for local, non-commercial evaluation only.

Usage
-----
    python -m benchmark.vifinqa.prepare \
        --src C:/path/to/ViFinQA --dst data/vifinqa/corpus \
        --report VNM:2023:consolidated --report VNM:2022:separate
"""

from __future__ import annotations

import argparse
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

_PAGE_RE = re.compile(r"^=+\s*PAGE\s+(\d+)\s*=+\s*$", re.IGNORECASE | re.MULTILINE)
_TABLE_RE = re.compile(r"<table.*?</table>", re.IGNORECASE | re.DOTALL)


class _TableParser(HTMLParser):
    """Collect rows of cell texts, expanding row/col spans into a rectangular grid."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.rows: list[list[tuple[str, int, int]]] = []
        self._cell: list[str] | None = None
        self._attrs: dict[str, str] = {}

    def handle_starttag(self, tag, attrs):
        if tag == "tr":
            self.rows.append([])
        elif tag in ("td", "th"):
            self._cell = []
            self._attrs = dict(attrs)
        elif tag == "br" and self._cell is not None:
            self._cell.append(" ")

    def handle_endtag(self, tag):
        if tag in ("td", "th") and self._cell is not None and self.rows:
            text = re.sub(r"\s+", " ", "".join(self._cell)).strip()
            rs = _as_int(self._attrs.get("rowspan"))
            cs = _as_int(self._attrs.get("colspan"))
            self.rows[-1].append((text, rs, cs))
            self._cell = None

    def handle_data(self, data):
        if self._cell is not None:
            self._cell.append(data)


def _as_int(v: str | None) -> int:
    try:
        return max(1, int(v or 1))
    except ValueError:
        return 1


def html_table_to_markdown(html: str) -> str:
    p = _TableParser()
    p.feed(html)
    grid: list[list[str]] = []
    pending: dict[tuple[int, int], str] = {}  # (row, col) occupied by a rowspan
    for r, row in enumerate(p.rows):
        out: list[str] = []
        c = 0
        for text, rs, cs in row:
            while (r, c) in pending:
                out.append(pending.pop((r, c)))
                c += 1
            out.append(text)
            for dc in range(1, cs):
                out.append("")
            for dr in range(1, rs):
                for dc in range(cs):
                    pending[(r + dr, c + dc)] = ""
            c += cs
        while (r, c) in pending:
            out.append(pending.pop((r, c)))
            c += 1
        grid.append(out)
    grid = [row for row in grid if any(cell for cell in row)]
    if not grid:
        return ""
    width = max(len(row) for row in grid)
    grid = [[(x or "").replace("|", "/") for x in row] + [""] * (width - len(row)) for row in grid]
    lines = ["| " + " | ".join(grid[0]) + " |", "| " + " | ".join(["---"] * width) + " |"]
    lines += ["| " + " | ".join(row) + " |" for row in grid[1:]]
    return "\n".join(lines)


def convert_report(raw: str) -> str:
    text = _TABLE_RE.sub(lambda m: "\n\n" + html_table_to_markdown(m.group(0)) + "\n\n", raw)
    text = _PAGE_RE.sub(lambda m: f"<!-- ===== page {m.group(1)} ===== -->", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip() + "\n"


def report_path(src: Path, ticker: str, year: str, rtype: str) -> Path:
    name = f"{ticker}_financial_statements_{year}_{rtype}"
    return src / "financial_statements" / ticker / year / name / f"{name}_extracted.txt"


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--src", required=True, type=Path, help="ViFinQA dataset root")
    ap.add_argument("--dst", required=True, type=Path, help="output directory for .md files")
    ap.add_argument("--report", action="append", default=[], metavar="TICKER:YEAR:TYPE",
                    help="report to convert, e.g. VNM:2023:consolidated (repeatable)")
    args = ap.parse_args(argv)
    args.dst.mkdir(parents=True, exist_ok=True)
    missing = 0
    for spec in args.report:
        ticker, year, rtype = spec.split(":")
        path = report_path(args.src, ticker, year, rtype)
        if not path.exists():
            print(f"MISSING  {spec}  ({path})", file=sys.stderr)
            missing += 1
            continue
        md = convert_report(path.read_text(encoding="utf-8", errors="replace"))
        out = args.dst / f"{ticker}_{year}_{rtype}.md"
        out.write_text(md, encoding="utf-8")
        print(f"OK       {spec} -> {out.name} ({len(md) // 1024} KB)")
    return 1 if missing else 0


if __name__ == "__main__":
    raise SystemExit(main())
