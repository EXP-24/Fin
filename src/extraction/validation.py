"""Arithmetic validation of extracted statement facts (spec §3.4).

A financial statement obeys accounting identities (total assets = current +
non-current assets, total resources = total assets, …). If extraction (OCR or
table parsing) misread a number, one of these identities breaks. We check each
identity per period and report the ones that do not hold, so a reviewer can look
at the right line instead of trusting a silently wrong value.

A broken identity means *the extracted data is inconsistent* — it may be an OCR
error, not a statement about the company's finances.

Tolerance: values are integers in VND; rounding in the printed statements allows
a difference of up to one printed unit per term (``unit_mult * n_terms``).
"""

from __future__ import annotations

from dataclasses import dataclass

from .statements import ExtractionResult, StatementFact

# A term is (statement, code, sign, optional). ``optional`` terms count as 0 when absent.
Term = tuple[str, str, int, bool]


@dataclass(frozen=True)
class Rule:
    id: str
    title: str
    lhs: tuple[str, str]
    terms: tuple[Term, ...]
    level: str = "error"  # "error" = identity must hold; "info" = soft cross-check


def _t(stmt: str, code: str, sign: int = 1, optional: bool = False) -> Term:
    return (stmt, code, sign, optional)


RULES: tuple[Rule, ...] = (
    Rule("BS_ASSETS", "Tổng tài sản (270) = Tài sản ngắn hạn (100) + Tài sản dài hạn (200)",
         ("cdkt_ts", "270"), (_t("cdkt_ts", "100"), _t("cdkt_ts", "200"))),
    Rule("BS_BALANCE", "Tổng nguồn vốn (440) = Tổng tài sản (270)",
         ("cdkt_nv", "440"), (_t("cdkt_ts", "270"),)),
    Rule("BS_RESOURCES", "Tổng nguồn vốn (440) = Nợ phải trả (300) + Vốn chủ sở hữu (400)",
         ("cdkt_nv", "440"), (_t("cdkt_nv", "300"), _t("cdkt_nv", "400"))),
    Rule("BS_LIABILITIES", "Nợ phải trả (300) = Nợ ngắn hạn (310) + Nợ dài hạn (330)",
         ("cdkt_nv", "300"), (_t("cdkt_nv", "310"), _t("cdkt_nv", "330"))),
    Rule("IS_NET_REVENUE", "Doanh thu thuần (10) = Doanh thu (01) − Các khoản giảm trừ (02)",
         ("kqkd", "10"), (_t("kqkd", "01"), _t("kqkd", "02", -1, True))),
    Rule("IS_GROSS_PROFIT", "Lợi nhuận gộp (20) = Doanh thu thuần (10) − Giá vốn (11)",
         ("kqkd", "20"), (_t("kqkd", "10"), _t("kqkd", "11", -1))),
    Rule("IS_OPERATING_PROFIT",
         "Lợi nhuận thuần HĐKD (30) = 20 + 21 − 22 + 24 − 25 − 26",
         ("kqkd", "30"), (_t("kqkd", "20"), _t("kqkd", "21"), _t("kqkd", "22", -1),
                          _t("kqkd", "24", 1, True), _t("kqkd", "25", -1), _t("kqkd", "26", -1))),
    Rule("IS_PBT", "Lợi nhuận trước thuế (50) = Lợi nhuận thuần HĐKD (30) + Lợi nhuận khác (40)",
         ("kqkd", "50"), (_t("kqkd", "30"), _t("kqkd", "40"))),
    Rule("IS_PAT", "Lợi nhuận sau thuế (60) = Trước thuế (50) − Thuế hiện hành (51) − Thuế hoãn lại (52)",
         ("kqkd", "60"), (_t("kqkd", "50"), _t("kqkd", "51", -1), _t("kqkd", "52", -1, True))),
    Rule("CF_NET", "Lưu chuyển tiền thuần (50) = HĐKD (20) + Đầu tư (30) + Tài chính (40)",
         ("lctt", "50"), (_t("lctt", "20"), _t("lctt", "30"), _t("lctt", "40"))),
    Rule("CF_END", "Tiền cuối kỳ (70) = Tiền đầu kỳ (60) + Lưu chuyển thuần (50) + Tỷ giá (61) + Chênh lệch quy đổi (62)",
         ("lctt", "70"), (_t("lctt", "60"), _t("lctt", "50"), _t("lctt", "61", 1, True), _t("lctt", "62", 1, True))),
    Rule("CF_BS_CASH", "Tiền cuối kỳ trên LCTT (70) = Tiền và tương đương tiền trên bảng cân đối (110)",
         ("lctt", "70"), (_t("cdkt_ts", "110"),), level="info"),
)


def _check_rule(rule: Rule, vals: dict[tuple[str, str], StatementFact], year: int) -> dict | None:
    lhs = vals.get(rule.lhs)
    if lhs is None:
        return None
    total = 0
    used: list[StatementFact] = [lhs]
    n_terms = 0
    missing_optional: list[str] = []
    for stmt, code, sign, optional in rule.terms:
        f = vals.get((stmt, code))
        if f is None:
            if optional:
                missing_optional.append(code)
                continue
            return None  # a required input is missing -> cannot judge (skip, not fail)
        total += sign * f.value
        used.append(f)
        n_terms += 1
    mult = max(f.unit_mult for f in used)
    tol = mult * max(1, n_terms)
    diff = lhs.value - total
    ok = abs(diff) <= tol
    level = rule.level
    if not ok and rule.id == "CF_END" and "61" in missing_optional:
        level = "info"  # the FX-effect line was not found, so the gap may just be that line
    return {
        "rule": rule.id,
        "title": rule.title,
        "year": year,
        "ok": ok,
        "level": level,
        "missing_optional": missing_optional,
        "expected": total,
        "actual": lhs.value,
        "difference": diff,
        "tolerance": tol,
        "codes": [f"{f.statement}:{f.code}" for f in used],
        "pages": sorted({f.page for f in used if f.page is not None}),
    }


def validate_extraction(result: ExtractionResult) -> dict:
    """Run every identity for every period found in one report."""
    if not result.facts:
        return {
            "status": "no_data",
            "message": "Không nhận diện được bảng báo cáo theo mã số "
                       "(có thể là báo cáo ngân hàng hoặc bảng bị OCR lỗi); chưa thể kiểm tra số học.",
            "scope": result.scope, "year": result.year, "statements": [], "facts": 0,
            "checks_run": 0, "checks_passed": 0, "warnings": [], "skipped_rules": [], "unit_assumed": False,
        }
    by_year: dict[int, dict[tuple[str, str], StatementFact]] = {}
    for f in result.facts:
        by_year.setdefault(f.year, {}).setdefault(f.key, f)

    checks = []
    skipped: list[dict] = []
    for year in sorted(by_year, reverse=True):
        for rule in RULES:
            c = _check_rule(rule, by_year[year], year)
            if c is not None:
                checks.append(c)
            elif year == max(by_year) and any(k[0] == rule.lhs[0] for k in by_year[year]):
                # the statement is present but an input line was not extracted: say so,
                # so a missing number never looks like a passed check
                need = [rule.lhs] + [(t[0], t[1]) for t in rule.terms if not t[3]]
                skipped.append({"rule": rule.id, "title": rule.title,
                                "missing": [f"{s}:{c}" for s, c in need if (s, c) not in by_year[year]]})
    warnings = [c for c in checks if not c["ok"]]
    status = "ok" if not any(w["level"] == "error" for w in warnings) else "warning"
    return {
        "status": status,
        "scope": result.scope,
        "year": result.year,
        "statements": result.statements,
        "facts": len(result.facts),
        "checks_run": len(checks),
        "checks_passed": len(checks) - len(warnings),
        "warnings": warnings,
        "skipped_rules": skipped,
        "unit_assumed": any(not f.unit_known for f in result.facts),
    }
