"""Statement-fact extraction + arithmetic validation (src/extraction)."""

from __future__ import annotations

from src.extraction import analyze_document, extract_statement_facts, validate_extraction

# A small, internally consistent report (unit: million VND).
REPORT = """# BÁO CÁO TÀI CHÍNH HỢP NHẤT NĂM 2023

Đơn vị tính: **triệu đồng**

<!-- ===== page 6 ===== -->
## BẢNG CÂN ĐỐI KẾ TOÁN

| Chỉ tiêu | Mã số | Thuyết minh | 31/12/2023 | 31/12/2022 |
| --- | --- | --- | --- | --- |
| Tài sản ngắn hạn | 100 |  | 820.000 | 700.000 |
| Tài sản dài hạn | 200 |  | 680.000 | 600.000 |
| TỔNG TÀI SẢN | 270 |  | 1.500.000 | 1.300.000 |
| Nợ phải trả | 300 |  | 800.000 | 760.000 |
| Nợ ngắn hạn | 310 | V.05 | 560.000 | 540.000 |
| Nợ dài hạn | 330 | V.06 | 240.000 | 220.000 |
| Vốn chủ sở hữu | 400 |  | 700.000 | 540.000 |
| TỔNG NGUỒN VỐN | 440 |  | 1.500.000 | 1.300.000 |

<!-- ===== page 7 ===== -->
## BÁO CÁO KẾT QUẢ HOẠT ĐỘNG KINH DOANH

| Chỉ tiêu | Mã số | Thuyết minh | Năm 2023 | Năm 2022 |
| --- | --- | --- | --- | --- |
| Doanh thu bán hàng | 01 |  | 2.400.000 | 2.100.000 |
| Doanh thu thuần | 10 |  | 2.400.000 | 2.100.000 |
| Giá vốn hàng bán | 11 |  | 1.680.000 | 1.512.000 |
| Lợi nhuận gộp | 20 |  | 720.000 | 588.000 |
| Doanh thu tài chính | 21 |  | 20.000 | 15.000 |
| Chi phí tài chính | 22 |  | 48.000 | 52.000 |
| Chi phí bán hàng | 25 |  | 240.000 | 200.000 |
| Chi phí quản lý doanh nghiệp | 26 |  | 132.000 | 121.000 |
| Lợi nhuận thuần từ HĐKD | 30 |  | 320.000 | 230.000 |
| Lợi nhuận khác | 40 |  | 5.000 | 5.000 |
| Lợi nhuận trước thuế | 50 |  | 325.000 | 235.000 |
| Chi phí thuế hiện hành | 51 |  | 65.000 | 47.000 |
| Lợi nhuận sau thuế | 60 |  | 260.000 | 188.000 |
"""


def _facts(result, statement, code, column="cur"):
    return next(f for f in result.facts if (f.statement, f.code, f.column) == (statement, code, column))


def test_extracts_both_periods_in_vnd():
    r = extract_statement_facts(REPORT, 2023, "bctc_2023_consolidated.md")
    assert r.scope == "consolidated"
    assert set(r.statements) == {"cdkt_ts", "cdkt_nv", "kqkd"}
    cur = _facts(r, "cdkt_ts", "270")
    assert (cur.year, cur.value, cur.page, cur.unit_mult, cur.unit_known) == (2023, 1_500_000 * 10**6, 6, 10**6, True)
    prior = _facts(r, "cdkt_ts", "270", "prior")
    assert (prior.year, prior.value) == (2022, 1_300_000 * 10**6)


def test_valid_report_passes_every_identity():
    v = analyze_document(REPORT, 2023, "bctc_2023_consolidated.md")["validation"]
    assert v["status"] == "ok"
    assert v["warnings"] == []
    assert v["checks_run"] >= 14  # both years x BS/IS rules


def test_misread_number_is_caught():
    broken = REPORT.replace("| TỔNG TÀI SẢN | 270 |  | 1.500.000 |", "| TỔNG TÀI SẢN | 270 |  | 1.500.900 |")
    v = analyze_document(broken, 2023, "bctc.md")["validation"]
    assert v["status"] == "warning"
    rules = {w["rule"] for w in v["warnings"]}
    assert "BS_ASSETS" in rules and "BS_BALANCE" in rules
    w = next(w for w in v["warnings"] if w["rule"] == "BS_ASSETS" and w["year"] == 2023)
    assert w["difference"] == 900 * 10**6
    assert w["pages"] == [6]


def test_small_rounding_is_tolerated():
    # one printed unit of difference is within tolerance (rounding in the statement)
    rounded = REPORT.replace("| TỔNG TÀI SẢN | 270 |  | 1.500.000 |", "| TỔNG TÀI SẢN | 270 |  | 1.500.001 |")
    v = analyze_document(rounded, 2023, "bctc.md")["validation"]
    assert not [w for w in v["warnings"] if w["rule"] == "BS_ASSETS" and w["year"] == 2023]


def test_negative_numbers_in_parentheses():
    md = REPORT.replace("| Lợi nhuận khác | 40 |  | 5.000 | 5.000 |", "| Lợi nhuận khác | 40 |  | (5.000) | 5.000 |")
    md = md.replace("| Lợi nhuận trước thuế | 50 |  | 325.000 |", "| Lợi nhuận trước thuế | 50 |  | 315.000 |")
    md = md.replace("| Lợi nhuận sau thuế | 60 |  | 260.000 |", "| Lợi nhuận sau thuế | 60 |  | 250.000 |")
    r = extract_statement_facts(md, 2023, "x.md")
    assert _facts(r, "kqkd", "40").value == -5_000 * 10**6
    v = validate_extraction(r)
    assert not [w for w in v["warnings"] if w["year"] == 2023]


def test_split_statement_parts_are_recovered():
    """OCR often splits one statement into several tables; a lone 'TỔNG TÀI SẢN' row must survive."""
    split = """Đơn vị tính: triệu đồng

## BẢNG CÂN ĐỐI KẾ TOÁN

| Chỉ tiêu | Mã số | Thuyết minh | 31/12/2023 | 31/12/2022 |
| --- | --- | --- | --- | --- |
| Tài sản ngắn hạn | 100 |  | 820.000 | 700.000 |
| Tiền | 110 |  | 150.000 | 120.000 |
| Đầu tư ngắn hạn | 120 |  | 100.000 | 90.000 |
| Phải thu ngắn hạn | 130 |  | 300.000 | 260.000 |
| Hàng tồn kho | 140 |  | 240.000 | 200.000 |
| Tài sản ngắn hạn khác | 150 |  | 30.000 | 30.000 |
| Tài sản dài hạn | 200 |  | 680.000 | 600.000 |

<!-- ===== page 9 ===== -->
## BẢNG CÂN ĐỐI KẾ TOÁN (tiếp theo)

| TỔNG TÀI SẢN | 270 |  | 1.500.000 | 1.300.000 |
"""
    r = extract_statement_facts(split, 2023, "x.md")
    assert _facts(r, "cdkt_ts", "270").value == 1_500_000 * 10**6
    assert _facts(r, "cdkt_ts", "200").value == 680_000 * 10**6


def test_shifted_row_does_not_read_note_reference_as_value():
    """A row whose cells shifted left must not treat the note number '5' as the amount."""
    md = REPORT.replace("| TỔNG NGUỒN VỐN | 440 |  | 1.500.000 | 1.300.000 |", "| TỔNG NGUỒN VỐN | 440 | 5 | 1.500.000 |")
    # the row is now one cell short, so it is ignored rather than mis-read
    r = extract_statement_facts(md, 2023, "x.md")
    assert all(f.value != 5 * 10**6 for f in r.facts if f.code == "440")


def test_bank_style_report_yields_no_facts_not_wrong_facts():
    md = "## THUYẾT MINH\n\n| Chỉ tiêu | Mã số | A | B |\n| --- | --- | --- | --- |\n| x | 12 | 1 | 2 |\n| y | 13 | 3 | 4 |\n| z | 14 | 5 | 6 |\n| w | 15 | 7 | 8 |\n"
    res = analyze_document(md, 2020, "bank.md")
    assert res["facts"] == []
    assert res["validation"]["status"] == "no_data"


def test_unit_is_not_confused_by_exchange_rate_wording():
    md = REPORT.replace("Đơn vị tính: **triệu đồng**", "Ảnh hưởng của tỷ giá hối đoái")
    r = extract_statement_facts(md, 2023, "x.md")
    f = _facts(r, "cdkt_ts", "270")
    assert f.unit_mult == 1 and f.unit_known is False  # "tỷ giá" is not the billion unit


def test_per_share_lines_are_not_scaled():
    md = REPORT + "| Lãi cơ bản trên cổ phiếu | 70 |  | 2.726 | 3.105 |\n"
    r = extract_statement_facts(md, 2023, "x.md")
    f = _facts(r, "kqkd", "70")
    assert f.value == 2726 and f.unit_mult == 1
