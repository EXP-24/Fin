"""Ratio questions: components, table-row scoring, OCR number repair, mixed-corpus routing."""
from src.rag.pipeline import _ratio_components, _ratio_hint, _repair_numbers, _row_score


def test_ratio_components():
    assert _ratio_components("Tính ROE của hai công ty theo vốn chủ cuối kỳ") == ("lợi nhuận sau thuế", "vốn chủ sở hữu")
    assert _ratio_components("biên lợi nhuận gộp của ABC") == ("lợi nhuận gộp", "doanh thu thuần")
    assert _ratio_components("so sánh đòn bẩy tài chính") == ("nợ phải trả", "vốn chủ sở hữu")
    assert _ratio_components("Tổng tài sản năm 2025 là bao nhiêu?") == ()
    assert _ratio_components("ROEX không phải là chỉ số") == ()  # whole word only


def test_ratio_hint_only_for_ratios():
    assert "FULL-YEAR" in _ratio_hint("ROE của ABC")
    assert _ratio_hint("Tổng tài sản?") == ""


def test_repair_split_amounts():
    assert _repair_numbers("Lợi nhuận sau thuế 6.979.82 6 3.420.111 25.954.47 2 21.760.104") == \
        "Lợi nhuận sau thuế 6.979.826 3.420.111 25.954.472 21.760.104"
    assert _repair_numbers("(2.136.12 0)") == "(2.136.120)"
    # untouched: well-formed amounts, years, percentages
    for ok in ("25.954.472 21.760.104", "năm 2025 6", "98,34 100,00", "31/12/2025 4"):
        assert _repair_numbers(ok) == ok


def test_row_score_prefers_table_rows_over_prose():
    pdf_style = "Lợi nhuận sau thuế \n 6.979.826      3.420.111 \nLợi ích cổ đông \n (304.264)"
    prose = "Quỹ được trích từ lợi nhuận sau thuế theo Nghị định 135 năm 2025."
    inline = "| 60 | 15. Lợi nhuận sau thuế thu nhập doanh nghiệp | | 260.000 | 188.000 |"
    assert _row_score(pdf_style, "lợi nhuận sau thuế") == 2   # label starts the line, amount below
    assert _row_score(prose, "lợi nhuận sau thuế") == 0
    assert _row_score(inline, "lợi nhuận sau thuế") == 1      # amount on the same line
