"""Extract line-item facts from the Markdown statement tables of a BCTC report.

Vietnamese financial statements print a fixed VAS line code (``Mã số``) next to
every line. This module reads those tables straight from the Markdown that
ingestion already produces and returns typed facts keyed on the line code, in
integer VND, with provenance (page). It is deterministic — no LLM, no network.

It reuses the canonical code maps of :mod:`src.rag.financial_facts` so the whole
project agrees on what each code means.

Handled layouts (verified on real OCR reports):
  * ``| Mã số | Chỉ tiêu | Thuyết minh | cur | prior |`` (code in the first column)
  * ``| Chỉ tiêu | Mã số | Thuyết minh | cur | prior |`` (code in the second)
  * unit from the column header (``triệu đồng``), the nearby text or the document
  * both period columns: the report year and the prior year
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

from src.rag.financial_facts import (
    CDKT_ASSET_CODES,
    CDKT_RESOURCE_CODES,
    KQKD_CODES,
    LCTT_CODES,
)

# Codes we keep per statement. LCTT 61 (FX effect) is needed for the cash check.
_LCTT = {
    **LCTT_CODES,
    "61": "Ảnh hưởng của thay đổi tỷ giá hối đoái quy đổi ngoại tệ",
    "62": "Chênh lệch do chuyển đổi tiền tệ",  # appears in some consolidated statements
}
_CODEMAPS = {"kqkd": KQKD_CODES, "cdkt_ts": CDKT_ASSET_CODES, "cdkt_nv": CDKT_RESOURCE_CODES, "lctt": _LCTT}

_PAGE_RE = re.compile(r"<!--\s*=+\s*page\s+(\d+)\s*=+\s*-->", re.IGNORECASE)
_CODE_RE = re.compile(r"^\d{2,3}$")
_NOTE_REF_RE = re.compile(r"^(?:[IVX]+\.)?\d{1,2}(?:\.\d{1,2})?$")
_NUM_RE = re.compile(r"^\(?-?\d[\d.,]*\)?$")
_YEAR_RE = re.compile(r"(?<!\d)(20\d{2})(?!\d)")
_UNIT_RE = re.compile(r"(?:đơn\s*vị\s*tính|đvt|đơn\s*vị)\s*[:\-]?\s*\**\s*([^\n|*]{1,40})", re.IGNORECASE)


def _norm(text: str) -> str:
    """Lowercase, strip diacritics (OCR often garbles them), map đ→d."""
    t = unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


# keyword (normalised) -> statement family; the nearest preceding one wins.
_CONTEXT = (
    ("ket qua hoat dong kinh doanh", "kqkd"),
    ("luu chuyen tien", "lctt"),
    ("can doi ke toan", "cdkt"),
    ("tinh hinh tai chinh", "cdkt"),
)


@dataclass(slots=True, frozen=True)
class StatementFact:
    statement: str      # kqkd | cdkt_ts | cdkt_nv | lctt
    code: str           # VAS line code
    label: str          # canonical Vietnamese label
    year: int           # period the value belongs to
    value: int          # signed, in VND (EPS lines: VND per share)
    raw: str            # as printed
    unit_mult: int      # multiplier applied (1, 1_000, 1_000_000, ...)
    unit_known: bool    # False when no unit statement was found (assumed VND)
    page: int | None
    column: str         # "cur" (report year) | "prior"

    @property
    def key(self) -> tuple[str, str]:
        return (self.statement, self.code)

    def to_dict(self) -> dict:
        return {s: getattr(self, s) for s in self.__slots__}


@dataclass
class ExtractionResult:
    facts: list[StatementFact] = field(default_factory=list)
    scope: str = "unknown"          # consolidated | separate | unknown
    year: int | None = None
    tables_seen: int = 0            # tables with a "Mã số" column
    statements: list[str] = field(default_factory=list)


# --------------------------------------------------------------------------- #
#  Markdown table scanning
# --------------------------------------------------------------------------- #

def _split_row(line: str) -> list[str]:
    s = line.strip()
    if s.startswith("|"):
        s = s[1:]
    if s.endswith("|"):
        s = s[:-1]
    return [c.replace("*", "").replace("`", "").strip() for c in s.split("|")]


def _is_sep(cells: list[str]) -> bool:
    return bool(cells) and all(re.fullmatch(r":?-{2,}:?", c) or not c for c in cells) and any(cells)


def _scan(markdown: str):
    """Yield (page, context_text, rows) for every Markdown table."""
    page: int | None = None
    ctx: list[str] = []
    rows: list[list[str]] = []
    start_page: int | None = None

    def flush():
        nonlocal rows
        if rows:
            out = (start_page, "\n".join(ctx[-30:]), rows)
            rows = []
            return out
        return None

    for line in markdown.splitlines():
        m = _PAGE_RE.search(line)
        if m:
            done = flush()
            if done:
                yield done
            page = int(m.group(1))
            continue
        if line.lstrip().startswith("|"):
            if not rows:
                start_page = page
            cells = _split_row(line)
            if not _is_sep(cells):
                rows.append(cells)
        else:
            done = flush()
            if done:
                yield done
            if line.strip():
                ctx.append(line.strip())
    done = flush()
    if done:
        yield done


def _find_code_col(rows: list[list[str]]) -> int | None:
    width = max(len(r) for r in rows)
    header = rows[0]
    for i, c in enumerate(header):
        if _norm(c).replace(" ", "") in ("maso", "ms"):
            return i
    body = rows[1:]
    for i in range(min(4, width)):
        vals = [r[i] for r in body if len(r) > i and r[i]]
        hits = sum(1 for v in vals if _CODE_RE.fullmatch(v))
        if len(vals) >= 4 and hits / len(vals) >= 0.6:
            return i
    return None


def _parse_int(cell: str) -> int | None:
    s = cell.strip()
    if s in ("-", "–", "—"):
        return 0
    if not _NUM_RE.fullmatch(s):
        return None
    neg = (s.startswith("(") and s.endswith(")")) or s.startswith("-")
    digits = re.sub(r"[^\d]", "", s)
    if not digits:
        return None
    v = int(digits)
    return -v if neg else v


_UNIT_PATTERNS = (
    (re.compile(r"(?<![a-z])ty\s*(?:dong|vnd)(?![a-z])"), 1_000_000_000),
    (re.compile(r"(?<![a-z])trieu(?:\s*(?:dong|vnd))?(?![a-z])"), 1_000_000),
    (re.compile(r"(?<![a-z])(?:nghin|ngan)\s*(?:dong|vnd)(?![a-z])"), 1_000),
    (re.compile(r"(?<![a-z])(?:vnd|dong)(?![a-z])"), 1),
)


def _unit_from_text(text: str) -> int | None:
    """Money unit named in ``text`` — explicit "<unit> đồng/VND" only, so words like
    "tỷ giá" (exchange rate) are never mistaken for the billion unit."""
    n = _norm(text)
    for pat, mult in _UNIT_PATTERNS:
        if pat.search(n):
            return mult
    return None


def detect_scope(markdown: str, filename: str = "") -> str:
    f = _norm(filename)
    if "separate" in f or "rieng" in f:
        return "separate"
    if "consolidated" in f or "hop nhat" in f or "hop_nhat" in f:
        return "consolidated"
    head = _norm(markdown[:8000])
    rieng = len(re.findall(r"bao cao tai chinh rieng|tinh hinh tai chinh rieng|ket qua hoat dong kinh doanh rieng", head))
    hop = len(re.findall(r"hop nhat", head))
    if rieng and rieng >= hop:
        return "separate"
    if hop:
        return "consolidated"
    return "unknown"


def _doc_unit(markdown: str) -> int | None:
    for m in _UNIT_RE.finditer(markdown[:200_000]):
        u = _unit_from_text(m.group(1))
        if u is not None:
            return u
    return None


def extract_statement_facts(markdown: str, year: int | None, filename: str = "") -> ExtractionResult:
    """Return the facts of every statement table that has a ``Mã số`` column."""
    res = ExtractionResult(scope=detect_scope(markdown, filename), year=year)
    doc_unit = _doc_unit(markdown)
    seen: set[tuple[str, str, str]] = set()
    stmts: set[str] = set()

    last_ok: dict | None = None  # layout of the last accepted table (statements are often split across pages)

    for page, context, rows in _scan(markdown):
        if not rows:
            continue
        width = max(len(r) for r in rows)
        code_col = _find_code_col(rows) if len(rows) >= 3 else None
        continuation = False
        if code_col is None and last_ok and width == last_ok["width"]:
            # a short table (even a single row such as "TỔNG TÀI SẢN") that continues the previous one
            code_col = last_ok["code_col"]
            continuation = True
        if code_col is None or width < code_col + 2:
            continue
        # the first row is a header unless it already holds a line code
        has_header = not (len(rows[0]) > code_col and _CODE_RE.fullmatch(rows[0][code_col]))
        body = rows[1:] if has_header else rows
        res.tables_seen += 1

        # --- which statement? nearest preceding title keyword, else code heuristics
        family = None
        best = -1
        nctx = _norm(context + ("\n" + " ".join(rows[0]) if has_header else ""))
        for kw, fam in _CONTEXT:
            pos = nctx.rfind(kw)
            if pos > best:
                best, family = pos, fam
        codes = {r[code_col] for r in body if len(r) > code_col and _CODE_RE.fullmatch(r[code_col])}
        if family is None:
            if "270" in codes or "440" in codes or "100" in codes:
                family = "cdkt"
            elif {"10", "20", "50"} <= codes and "11" in codes:
                family = "kqkd"
        if family is None and continuation:
            family = last_ok["family"]
        if family is None or not codes:
            continue

        # Guard against look-alike tables (notes, bank statements): demand real coverage,
        # but let a part of a split statement through when it continues the previous table.
        three_digit = {c for c in codes if len(c) == 3 and 100 <= int(c) <= 440}
        if family == "cdkt":
            ok = len(codes & (set(CDKT_ASSET_CODES) | set(CDKT_RESOURCE_CODES))) >= 5 or (
                bool(three_digit) and len(three_digit) == len(codes) and last_ok is not None
                and last_ok["family"] == "cdkt" and width == last_ok["width"]
            )
        elif family == "kqkd":
            ok = (len(codes & set(KQKD_CODES)) >= 8 and {"10", "20"} <= codes) or (
                last_ok is not None and last_ok["family"] == "kqkd" and width == last_ok["width"]
                and codes <= set(KQKD_CODES)
            )
        else:  # lctt: a long table may be split across pages, so each part is partial
            ok = (len(codes) >= 6 and bool(codes & {"20", "30", "40", "50", "60", "70"})) or (
                last_ok is not None and last_ok["family"] == "lctt" and width == last_ok["width"]
            )
        if not ok:
            continue

        # --- value columns: everything after the code (and the "Thuyết minh" note) column
        header_cells = rows[0] if has_header else []
        if last_ok and width == last_ok["width"] and last_ok["code_col"] == code_col and (continuation or not header_cells):
            value_start, swapped_hint = last_ok["value_start"], last_ok["swapped"]
        else:
            value_start, swapped_hint = code_col + 1, None
            tm_cols = [i for i, c in enumerate(header_cells) if _norm(c).startswith(("thuyet minh", "tm"))]
            if tm_cols and tm_cols[0] >= code_col:
                value_start = tm_cols[0] + 1
            else:  # headerless note column: mostly tiny refs like "5", "V.20", "3.1"
                col = [r[value_start] for r in body if len(r) > value_start and r[value_start]]
                if len(col) >= 4 and sum(1 for v in col if _NOTE_REF_RE.fullmatch(v)) / len(col) >= 0.6:
                    value_start += 1
        if width - value_start < 1:
            continue
        vh = header_cells[value_start:]
        h_cur = " ".join(vh[-2:-1]) if len(vh) >= 2 else ""
        h_prior = " ".join(vh[-1:])
        y_cur = [int(y) for y in _YEAR_RE.findall(h_cur)]
        y_prior = [int(y) for y in _YEAR_RE.findall(h_prior)]
        swapped = bool(y_cur and y_prior and max(y_cur) < max(y_prior))
        if swapped_hint is not None and not (y_cur and y_prior):
            swapped = swapped_hint
        cur_year = year
        if cur_year is None and (y_cur or y_prior):
            cur_year = max(y_cur + y_prior)
        if cur_year is None:
            continue

        unit = _unit_from_text(" ".join(vh)) or _unit_from_text(
            (_UNIT_RE.findall(context) or [""])[-1]
        ) or doc_unit
        unit_known = unit is not None
        mult = unit or 1
        last_ok = {"family": family, "width": width, "code_col": code_col, "value_start": value_start, "swapped": swapped}

        for r in body:
            if len(r) != width:
                continue
            code = r[code_col]
            if not _CODE_RE.fullmatch(code):
                continue
            if family == "cdkt":
                stmt = "cdkt_ts" if int(code) < 300 else "cdkt_nv"
            else:
                stmt = family
            codemap = _CODEMAPS[stmt]
            if code not in codemap:
                continue
            vals = r[value_start:]
            b = _parse_int(vals[-1])
            if b is None:
                continue
            a = _parse_int(vals[-2]) if len(vals) >= 2 else None
            if a is not None and _NOTE_REF_RE.fullmatch(vals[-2]) and len(re.sub(r"\D", "", vals[-1])) >= 5:
                a = None  # OCR shifted the row: the small "current" cell is really the note reference
            single = a is None  # one value column only (the report-year value)
            per_share = stmt == "kqkd" and code in ("70", "71")
            m = 1 if per_share else mult
            if single:
                cols = [("cur", cur_year, b, vals[-1])]
            else:
                cols = [("cur", cur_year, a, vals[-2]), ("prior", cur_year - 1, b, vals[-1])]
                if swapped:
                    cols = [("cur", cur_year, b, vals[-1]), ("prior", cur_year - 1, a, vals[-2])]
            for column, yr, val, raw_cell in cols:
                key = (stmt, code, column)
                if key in seen:
                    continue
                seen.add(key)
                stmts.add(stmt)
                res.facts.append(StatementFact(
                    statement=stmt, code=code, label=codemap[code], year=yr, value=val * m, raw=raw_cell.strip(),
                    unit_mult=m, unit_known=unit_known, page=page, column=column,
                ))

    res.statements = sorted(stmts)
    return res
