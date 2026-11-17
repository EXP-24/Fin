"""Deterministic financial calculator (spec §6.4 ``compute_ratio`` / ``get_lineitem``).

When a question asks for a *difference*, a *growth rate* or a well-known *ratio* of
statement line items, the numbers are read from the facts extracted at upload time
(:mod:`src.extraction`) and the arithmetic is done in code — never by the LLM. The
answer lists the formula, every input with its page, and the assumptions made.

Design rule: **answer only when sure, otherwise return None** and let the normal RAG
pipeline handle the question. The calculator refuses (returns None) when:
  * it can't pin down exactly one line item / the right years,
  * a needed value is missing, or two documents disagree on it (e.g. several
    companies mixed in one session),
  * the question is an aggregate / multi-company / ranking question.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass, field

# --------------------------------------------------------------------------- #
#  Text helpers
# --------------------------------------------------------------------------- #

def _norm(text: str) -> str:
    t = unicodedata.normalize("NFD", text.lower().replace("đ", "d"))
    return "".join(c for c in t if unicodedata.category(c) != "Mn")


_YEAR_RE = re.compile(r"(?<!\d)(20[0-3]\d)(?!\d)")

# (normalised phrase, statement, code, label) — longest phrase wins, no overlaps.
_ITEMS: list[tuple[str, str, str, str]] = [
    ("doanh thu hoat dong tai chinh", "kqkd", "21", "Doanh thu hoạt động tài chính"),
    ("doanh thu ban hang va cung cap dich vu", "kqkd", "01", "Doanh thu bán hàng và cung cấp dịch vụ"),
    ("doanh thu thuan", "kqkd", "10", "Doanh thu thuần"),
    ("doanh thu", "kqkd", "10", "Doanh thu thuần"),
    ("gia von hang ban", "kqkd", "11", "Giá vốn hàng bán"),
    ("gia von", "kqkd", "11", "Giá vốn hàng bán"),
    ("loi nhuan gop", "kqkd", "20", "Lợi nhuận gộp"),
    ("chi phi tai chinh", "kqkd", "22", "Chi phí tài chính"),
    ("chi phi lai vay", "kqkd", "23", "Chi phí lãi vay"),
    ("chi phi ban hang", "kqkd", "25", "Chi phí bán hàng"),
    ("chi phi quan ly doanh nghiep", "kqkd", "26", "Chi phí quản lý doanh nghiệp"),
    ("loi nhuan thuan tu hoat dong kinh doanh", "kqkd", "30", "Lợi nhuận thuần từ hoạt động kinh doanh"),
    ("loi nhuan truoc thue", "kqkd", "50", "Lợi nhuận trước thuế"),
    ("loi nhuan sau thue", "kqkd", "60", "Lợi nhuận sau thuế"),
    ("tong tai san", "cdkt_ts", "270", "Tổng tài sản"),
    ("tai san ngan han", "cdkt_ts", "100", "Tài sản ngắn hạn"),
    ("tai san dai han", "cdkt_ts", "200", "Tài sản dài hạn"),
    ("hang ton kho", "cdkt_ts", "140", "Hàng tồn kho"),
    ("tien va cac khoan tuong duong tien", "cdkt_ts", "110", "Tiền và các khoản tương đương tiền"),
    ("tien va tuong duong tien", "cdkt_ts", "110", "Tiền và các khoản tương đương tiền"),
    ("tong nguon von", "cdkt_nv", "440", "Tổng nguồn vốn"),
    ("no phai tra", "cdkt_nv", "300", "Nợ phải trả"),
    ("no ngan han", "cdkt_nv", "310", "Nợ ngắn hạn"),
    ("no dai han", "cdkt_nv", "330", "Nợ dài hạn"),
    ("von chu so huu", "cdkt_nv", "400", "Vốn chủ sở hữu"),
    ("luu chuyen tien thuan tu hoat dong kinh doanh", "lctt", "20", "Lưu chuyển tiền thuần từ hoạt động kinh doanh"),
    ("luu chuyen tien thuan tu cac hoat dong kinh doanh", "lctt", "20", "Lưu chuyển tiền thuần từ hoạt động kinh doanh"),
    ("dong tien thuan tu hoat dong kinh doanh", "lctt", "20", "Lưu chuyển tiền thuần từ hoạt động kinh doanh"),
    ("dong tien tu hoat dong kinh doanh", "lctt", "20", "Lưu chuyển tiền thuần từ hoạt động kinh doanh"),
    ("luu chuyen tien thuan tu hoat dong dau tu", "lctt", "30", "Lưu chuyển tiền thuần từ hoạt động đầu tư"),
    ("luu chuyen tien thuan tu hoat dong tai chinh", "lctt", "40", "Lưu chuyển tiền thuần từ hoạt động tài chính"),
    ("luu chuyen tien thuan trong nam", "lctt", "50", "Lưu chuyển tiền thuần trong năm"),
    ("luu chuyen tien thuan trong ky", "lctt", "50", "Lưu chuyển tiền thuần trong kỳ"),
]
_ITEMS.sort(key=lambda x: -len(x[0]))

# Named ratios: (normalised triggers, id, title, numerator terms, denominator terms, kind)
# terms are lists of (statement, code, sign). kind: "percent" | "times"
_RATIOS = [
    (("bien loi nhuan gop", "ty suat loi nhuan gop", "ty le loi nhuan gop", "ty suat sinh loi gop"),
     "gross_margin", "Biên lợi nhuận gộp", [("kqkd", "20", 1)], [("kqkd", "10", 1)], "percent"),
    (("bien loi nhuan rong", "bien loi nhuan sau thue", "ty suat loi nhuan rong", "ty suat loi nhuan sau thue tren doanh thu"),
     "net_margin", "Biên lợi nhuận ròng", [("kqkd", "60", 1)], [("kqkd", "10", 1)], "percent"),
    (("roe", "ty suat loi nhuan tren von chu so huu"),
     "roe", "ROE (LNST / Vốn chủ sở hữu cuối kỳ)", [("kqkd", "60", 1)], [("cdkt_nv", "400", 1)], "percent"),
    (("roa", "ty suat loi nhuan tren tong tai san"),
     "roa", "ROA (LNST / Tổng tài sản cuối kỳ)", [("kqkd", "60", 1)], [("cdkt_ts", "270", 1)], "percent"),
    (("no ngan han tren von chu so huu", "no ngan han chia cho von chu so huu", "no ngan han/von chu so huu"),
     "st_debt_equity", "Nợ ngắn hạn / Vốn chủ sở hữu", [("cdkt_nv", "310", 1)], [("cdkt_nv", "400", 1)], "percent"),
    (("no phai tra tren von chu so huu", "no phai tra chia cho von chu so huu", "he so no tren von chu so huu", "no phai tra/von chu so huu"),
     "debt_equity", "Nợ phải trả / Vốn chủ sở hữu", [("cdkt_nv", "300", 1)], [("cdkt_nv", "400", 1)], "percent"),
    (("no phai tra tren tong tai san", "ty le no tren tong tai san", "he so no tren tong tai san", "no phai tra/tong tai san"),
     "debt_assets", "Nợ phải trả / Tổng tài sản", [("cdkt_nv", "300", 1)], [("cdkt_ts", "270", 1)], "percent"),
    (("kha nang thanh toan hien hanh", "he so thanh toan hien hanh", "current ratio"),
     "current_ratio", "Khả năng thanh toán hiện hành (Tài sản ngắn hạn / Nợ ngắn hạn)",
     [("cdkt_ts", "100", 1)], [("cdkt_nv", "310", 1)], "times"),
    (("kha nang thanh toan nhanh", "he so thanh toan nhanh", "quick ratio"),
     "quick_ratio", "Khả năng thanh toán nhanh ((Tài sản ngắn hạn − Hàng tồn kho) / Nợ ngắn hạn)",
     [("cdkt_ts", "100", 1), ("cdkt_ts", "140", -1)], [("cdkt_nv", "310", 1)], "times"),
]

_GROWTH_KW = ("tang truong", "toc do tang", "ty le tang", "% so voi", "phan tram so voi", "tang bao nhieu %",
              "giam bao nhieu %", "tang bao nhieu phan tram", "giam bao nhieu phan tram", "tang/giam bao nhieu phan tram")
_DIFF_KW = ("chenh lech", "hieu so", "lon hon", "be hon", "nho hon", "cao hon", "thap hon", "kem hon",
            "bien dong", "thay doi", "tang them", "giam di", "tang bao nhieu", "giam bao nhieu", "tang so voi", "giam so voi")
_PREV_KW = ("nam truoc", "cung ky", "so voi nam ngoai", "nam ngoai")
# aggregate / ranking / multi-entity questions are out of scope for this calculator
_SKIP_KW = ("trung binh", "trung vi", "lon nhat", "nho nhat", "cao nhat", "thap nhat", "nam nao", "bao nhieu cong ty",
            "bao nhieu doanh nghiep", "tong cua", "tong gia tri", "tong so", "xep hang", "nhom doanh nghiep")
_ENTITY_RE = re.compile(r"ctcp|cong ty co phan|ngan hang tmcp|ngan hang thuong mai|tap doan|tong cong ty")


# --------------------------------------------------------------------------- #
#  Data classes
# --------------------------------------------------------------------------- #

@dataclass
class CalcInput:
    label: str
    statement: str
    code: str
    year: int
    value: int            # VND
    raw: str
    unit_mult: int
    doc_id: str
    doc_name: str
    page: int | None
    scope: str


@dataclass
class Calculation:
    kind: str                         # difference | growth | ratio
    title: str
    formula: str
    result: float                     # difference: VND; growth: ratio (0.1 = 10%); ratio: fraction
    result_unit: str                  # "money" | "percent" | "times"
    inputs: list[CalcInput] = field(default_factory=list)
    extra: dict = field(default_factory=dict)
    assumptions: list[str] = field(default_factory=list)
    money_unit: int = 1_000_000_000   # display unit for money
    money_unit_name: str = "tỷ đồng"
    rows: list[dict] = field(default_factory=list)   # per-year results for multi-year ratios

    def citations(self) -> list[dict]:
        seen, out = set(), []
        for i in self.inputs:
            key = (i.doc_id, i.code, i.year, i.statement)
            if key in seen:
                continue
            seen.add(key)
            out.append({
                "rank": len(out) + 1, "doc_id": i.doc_id, "doc_name": i.doc_name, "page": i.page, "score": 1.0,
                "snippet": f"{i.label} (mã số {i.code}) năm {i.year}: {i.raw}",
            })
        return out


# --------------------------------------------------------------------------- #
#  Fact lookup
# --------------------------------------------------------------------------- #

class _Ambiguous(Exception):
    pass


class FactIndex:
    """Facts of every analysed document in a session, queryable by (item, year, scope)."""

    def __init__(self, analyses: list[dict]) -> None:
        self.rows: list[dict] = []
        for a in analyses:
            for f in a.get("facts", []):
                self.rows.append({**f, "doc_id": a["doc_id"], "doc_name": a["doc_name"], "scope": a.get("scope", "unknown")})

    def scopes(self) -> set[str]:
        return {r["scope"] for r in self.rows}

    def lookup(self, statement: str, code: str, year: int, scope: str | None) -> CalcInput | None:
        cands = [r for r in self.rows if r["statement"] == statement and r["code"] == code and r["year"] == year]
        if scope:
            cands = [r for r in cands if r["scope"] == scope]
        if not cands:
            return None
        # prefer the report's own current-year column over a later report's prior column
        for column in ("cur", "prior"):
            same = [r for r in cands if r["column"] == column]
            if same:
                values = {r["value"] for r in same}
                if len(values) > 1:
                    raise _Ambiguous  # several documents disagree (e.g. different companies)
                r = same[0]
                return CalcInput(label=r["label"], statement=statement, code=code, year=year, value=r["value"],
                                 raw=r["raw"], unit_mult=r["unit_mult"], doc_id=r["doc_id"], doc_name=r["doc_name"],
                                 page=r.get("page"), scope=r["scope"])
        return None


# --------------------------------------------------------------------------- #
#  Question understanding
# --------------------------------------------------------------------------- #

def _find_items(nq: str) -> list[tuple[str, str, str, int, int]]:
    """Non-overlapping line-item mentions: (statement, code, label, start, end)."""
    taken: list[tuple[int, int]] = []
    found = []
    for phrase, stmt, code, label in _ITEMS:
        for m in re.finditer(r"(?<![a-z])" + re.escape(phrase) + r"(?![a-z])", nq):
            s, e = m.span()
            if any(not (e <= a or s >= b) for a, b in taken):
                continue
            taken.append((s, e))
            found.append((stmt, code, label, s, e))
    return sorted(found, key=lambda x: x[3])


def _requested_money_unit(nq: str) -> tuple[int, str] | None:
    for pat, mult, name in (
        (r"nghin ty", 1_000_000_000_000, "nghìn tỷ đồng"),
        (r"tram ty", 100_000_000_000, "trăm tỷ đồng"),
        (r"(?<![a-z])ty\s*(?:dong|vnd)?", 1_000_000_000, "tỷ đồng"),
        (r"trieu", 1_000_000, "triệu đồng"),
        (r"nghin\s*(?:dong|vnd)", 1_000, "nghìn đồng"),
    ):
        if re.search(pat, nq):
            return mult, name
    return None


def _scope_from_question(nq: str) -> str | None:
    if re.search(r"cong ty me|bao cao rieng|rieng le|\brieng\b", nq):
        return "separate"
    if re.search(r"hop nhat|tap doan|toan tap doan", nq):
        return "consolidated"
    return None


def _ordered_years(question: str) -> list[int]:
    seen: list[int] = []
    for y in _YEAR_RE.findall(question):
        if int(y) not in seen:
            seen.append(int(y))
    return seen


def try_calculate(question: str, analyses: list[dict]) -> Calculation | None:
    """Return a verified calculation, or None to fall back to retrieval + LLM."""
    if not analyses or not question:
        return None
    nq = _norm(question)
    if any(k in nq for k in _SKIP_KW):
        return None
    if len(set(re.findall(r"\b[A-Z]{3}\b", question))) >= 2:
        return None  # several tickers -> multi-company question
    if len(_ENTITY_RE.findall(nq)) >= 2:
        return None

    years = _ordered_years(question)
    is_growth = any(k in nq for k in _GROWTH_KW) or ("%" in question and any(k in nq for k in _DIFF_KW))
    is_diff = any(k in nq for k in _DIFF_KW)
    wants_prev = any(k in nq for k in _PREV_KW)

    ratio = next((r for r in _RATIOS if any(re.search(r"(?<![a-z])" + re.escape(t) + r"(?![a-z])", nq) for t in r[0])), None)
    index = FactIndex(analyses)
    if not index.rows:
        return None
    pref = _scope_from_question(nq)
    assumptions: list[str] = []

    def pick_scope(statement: str, code: str, year: int) -> str | None:
        """Scope to use: the one asked for, else consolidated when available."""
        if pref:
            return pref
        scopes = index.scopes()
        if "consolidated" in scopes and "separate" in scopes:
            return "consolidated"
        return None

    try:
        # ------------------------------------------------------------ ratios
        if ratio is not None:
            if is_growth or is_diff or not years:
                return None  # ratio-of-ratios / no period: let RAG handle it
            _, rid, title, num_terms, den_terms, kind = ratio
            rows, inputs = [], []
            for y in years[:4]:
                parts = {}
                for terms in (num_terms, den_terms):
                    tot = 0
                    for stmt, code, sign in terms:
                        sc = pick_scope(stmt, code, y)
                        fact = index.lookup(stmt, code, y, sc)
                        if fact is None:
                            return None
                        inputs.append(fact)
                        tot += sign * fact.value
                    parts["num" if terms is num_terms else "den"] = tot
                if parts["den"] == 0:
                    return None
                rows.append({"year": y, "value": parts["num"] / parts["den"], "num": parts["num"], "den": parts["den"]})
            if "consolidated" in index.scopes() and "separate" in index.scopes() and not pref:
                assumptions.append("Câu hỏi không nói rõ phạm vi; dùng báo cáo hợp nhất.")
            if rid in ("roe", "roa"):
                assumptions.append("Dùng số dư cuối kỳ (không bình quân đầu–cuối kỳ).")
            first = rows[0]
            return Calculation(
                kind="ratio", title=title,
                formula=f"{title} = {_terms_text(num_terms)} ÷ {_terms_text(den_terms)}",
                result=first["value"], result_unit=kind, inputs=inputs, assumptions=assumptions, rows=rows,
            )

        # ----------------------------------------------- difference / growth
        if not (is_growth or is_diff):
            return None
        items = _find_items(nq)
        distinct = {(s, c) for s, c, *_ in items}
        if len(distinct) != 1:
            return None
        stmt, code, label, start, end = items[0]
        # qualifier right after the item ("hàng tồn kho - nguyên vật liệu", "(giá gốc)") means a sub-item
        tail = nq[end:end + 14]
        if re.match(r"\s*[-–(]|\s*trong do|\s*nguyen vat lieu|\s*thanh pham", tail):
            return None
        # 61 = profit attributable to parent shareholders (consolidated only)
        if code == "60" and re.search(r"co dong cong ty me|thuoc ve co dong|thuoc ve cong ty me", nq):
            return None

        if len(years) >= 2:
            ya, yb = years[0], years[1]
        elif len(years) == 1 and (wants_prev or is_growth):
            ya, yb = years[0], years[0] - 1  # stated year vs the year before
        else:
            return None
        if ya == yb:
            return None
        sc = pick_scope(stmt, code, ya)
        fa, fb = index.lookup(stmt, code, ya, sc), index.lookup(stmt, code, yb, sc)
        if fa is None or fb is None:
            return None
        if "consolidated" in index.scopes() and "separate" in index.scopes() and not pref:
            assumptions.append("Câu hỏi không nói rõ phạm vi; dùng báo cáo hợp nhất.")
        if fa.unit_mult != fb.unit_mult:
            assumptions.append("Hai kỳ dùng đơn vị in khác nhau; đã quy đổi về đồng trước khi tính.")
        unit = _requested_money_unit(nq)
        if is_growth:
            old, new = (fb, fa) if yb < ya else (fa, fb)
            if old.value == 0:
                return None
            if old.value < 0:
                assumptions.append("Kỳ gốc có giá trị âm nên tỷ lệ tăng trưởng chỉ mang tính số học.")
            growth = (new.value - old.value) / abs(old.value)
            return Calculation(
                kind="growth", title=f"Tốc độ tăng trưởng {label} năm {new.year} so với năm {old.year}",
                formula=f"({label} {new.year} − {label} {old.year}) ÷ |{label} {old.year}|",
                result=growth, result_unit="percent", inputs=[old, new],
                extra={"delta": new.value - old.value, "from": old.year, "to": new.year}, assumptions=assumptions,
            )
        diff = fa.value - fb.value
        calc = Calculation(
            kind="difference", title=f"Chênh lệch {label} giữa năm {ya} và năm {yb}",
            formula=f"{label} {ya} − {label} {yb}",
            result=diff, result_unit="money", inputs=[fa, fb], assumptions=assumptions,
            extra={"a": ya, "b": yb},
        )
        if unit:
            calc.money_unit, calc.money_unit_name = unit
        else:
            mag = abs(diff)
            calc.money_unit, calc.money_unit_name = (
                (1_000_000_000, "tỷ đồng") if mag >= 1_000_000_000 else
                (1_000_000, "triệu đồng") if mag >= 1_000_000 else (1, "đồng")
            )
        return calc
    except _Ambiguous:
        return None


def _terms_text(terms: list[tuple[str, str, int]]) -> str:
    out = ""
    for i, (_, code, sign) in enumerate(terms):
        out += (" − " if sign < 0 else (" + " if i else "")) + f"mã {code}"
    return f"({out})" if len(terms) > 1 else out


# --------------------------------------------------------------------------- #
#  Presentation (Vietnamese)
# --------------------------------------------------------------------------- #

def _fmt_int(n: int) -> str:
    return f"{n:,}".replace(",", ".")


def _fmt_dec(x: float, nd: int = 2) -> str:
    s = f"{x:,.{nd}f}"
    s = s.replace(",", "§").replace(".", ",").replace("§", ".")
    if "," in s:
        s = s.rstrip("0").rstrip(",")
    return s


def _money(v: int, mult: int, name: str) -> str:
    return f"{_fmt_dec(v / mult, 2)} {name}"


def format_calculation(c: Calculation) -> str:
    lines: list[str] = []
    if c.kind == "difference":
        sign = "cao hơn" if c.result > 0 else ("thấp hơn" if c.result < 0 else "bằng")
        head = f"**{c.title}: {_money(c.result, c.money_unit, c.money_unit_name)}**"
        lines.append(head)
        a, b = c.extra["a"], c.extra["b"]
        if c.result != 0:
            lines.append(f"Năm {a} {sign} năm {b} {_money(abs(c.result), c.money_unit, c.money_unit_name)} "
                         f"(= {_fmt_int(abs(c.result))} đồng).")
    elif c.kind == "growth":
        pct = c.result * 100
        lines.append(f"**{c.title}: {'+' if pct > 0 else ''}{_fmt_dec(pct)}%**")
        delta = c.extra["delta"]
        lines.append(f"Giá trị {'tăng' if delta > 0 else 'giảm'} {_fmt_int(abs(delta))} đồng "
                     f"(từ năm {c.extra['from']} sang năm {c.extra['to']}).")
    else:
        def show(v: float) -> str:
            return f"{_fmt_dec(v * 100)}%" if c.result_unit == "percent" else f"{_fmt_dec(v)} lần"
        if len(c.rows) == 1:
            lines.append(f"**{c.title} năm {c.rows[0]['year']}: {show(c.rows[0]['value'])}**")
        else:
            lines.append(f"**{c.title}**")
            lines.append("")
            lines.append("| Năm | Giá trị |")
            lines.append("|---|---|")
            for r in c.rows:
                lines.append(f"| {r['year']} | {show(r['value'])} |")
    lines.append("")
    lines.append(f"**Cách tính:** {c.formula}")
    lines.append("")
    lines.append("**Số liệu đầu vào** (đọc trực tiếp từ bảng báo cáo):")
    lines.append("")
    lines.append("| Chỉ tiêu | Mã số | Năm | Giá trị (đồng) | Nguồn |")
    lines.append("|---|---|---|---|---|")
    seen = set()
    for i in c.inputs:
        key = (i.doc_id, i.statement, i.code, i.year)
        if key in seen:
            continue
        seen.add(key)
        page = f", trang {i.page}" if i.page else ""
        lines.append(f"| {i.label} | {i.code} | {i.year} | {_fmt_int(i.value)} | {i.doc_name}{page} |")
    if c.assumptions:
        lines.append("")
        lines.append("**Lưu ý:** " + " ".join(c.assumptions))
    lines.append("")
    lines.append("_Phép tính được thực hiện bằng chương trình trên số liệu đã trích xuất, không do AI ước tính._")
    return "\n".join(lines)
