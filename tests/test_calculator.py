"""Deterministic calculator (src/analysis): correct numbers, honest refusals."""

from __future__ import annotations

import pytest

from src.analysis import format_calculation, try_calculate
from src.extraction import analyze_document
from tests.test_extraction import REPORT


def _analysis(markdown=REPORT, year=2023, name="abc_2023_consolidated.md", doc_id="d1"):
    a = analyze_document(markdown, year, name)
    return {"doc_id": doc_id, "doc_name": name, "scope": a["scope"], "year": a["year"], "facts": a["facts"]}


@pytest.fixture()
def docs():
    return [_analysis()]


def test_difference_in_requested_unit(docs):
    c = try_calculate("Chênh lệch tổng tài sản giữa năm 2023 và năm 2022 là bao nhiêu tỷ đồng?", docs)
    assert c is not None and c.kind == "difference"
    assert c.result == 200_000 * 10**6  # 1.500.000 - 1.300.000 triệu đồng
    text = format_calculation(c)
    assert "200 tỷ đồng" in text and "200.000.000.000 đồng" in text
    assert "trang 6" in text  # provenance of the inputs


def test_growth_rate(docs):
    c = try_calculate("Doanh thu thuần năm 2023 tăng bao nhiêu phần trăm so với năm 2022?", docs)
    assert c is not None and c.kind == "growth"
    assert round(c.result * 100, 2) == 14.29
    assert "+14,29%" in format_calculation(c)


def test_growth_uses_previous_year_when_only_one_given(docs):
    c = try_calculate("Tốc độ tăng trưởng lợi nhuận sau thuế năm 2023 là bao nhiêu?", docs)
    assert c is not None
    assert round(c.result * 100, 2) == round((260 - 188) / 188 * 100, 2)


@pytest.mark.parametrize("q, expected", [
    ("Biên lợi nhuận gộp năm 2023 là bao nhiêu?", 30.0),
    ("ROE năm 2023 là bao nhiêu?", 260 / 700 * 100),
    ("Tỷ lệ nợ phải trả trên tổng tài sản năm 2022?", 760 / 1300 * 100),
])
def test_percent_ratios(docs, q, expected):
    c = try_calculate(q, docs)
    assert c is not None and c.kind == "ratio"
    assert c.rows[0]["value"] * 100 == pytest.approx(expected)


def test_current_ratio_is_in_times(docs):
    c = try_calculate("Khả năng thanh toán hiện hành năm 2023 là bao nhiêu?", docs)
    assert c is not None and c.result_unit == "times"
    assert c.rows[0]["value"] == pytest.approx(820 / 560)
    assert "lần" in format_calculation(c)


def test_every_number_in_the_answer_traces_to_an_input(docs):
    c = try_calculate("Chênh lệch tổng tài sản giữa năm 2023 và năm 2022?", docs)
    cites = c.citations()
    assert cites and all(x["doc_name"] and x["page"] == 6 for x in cites)
    assert all(str(x["score"]) == "1.0" for x in cites)


@pytest.mark.parametrize("q", [
    "Tại sao hàng tồn kho tăng?",                                               # not a calculation
    "Giá trị trung bình của tổng tài sản năm 2023 và 2022 là bao nhiêu?",       # aggregate
    "Chênh lệch tổng tài sản của VNM và HPG năm 2023?",                         # two companies
    "Chênh lệch hàng tồn kho - nguyên vật liệu giữa năm 2023 và năm 2022?",     # sub-item of the line
    "Chênh lệch doanh thu giữa năm 2025 và năm 2024?",                          # periods not in the data
    "Chênh lệch giữa năm 2023 và năm 2022?",                                    # no line item named
    "Chênh lệch tổng tài sản và nợ phải trả giữa năm 2023 và năm 2022?",        # two different items
    "ROE năm 2023 tăng bao nhiêu % so với năm 2022?",                           # growth of a ratio: unsupported
])
def test_refuses_instead_of_guessing(docs, q):
    assert try_calculate(q, docs) is None


def test_refuses_when_documents_disagree():
    """Two companies in one session: same year, different values -> ambiguous -> refuse."""
    other = REPORT.replace("1.500.000", "9.999.000")
    docs = [_analysis(), _analysis(other, name="other_2023_consolidated.md", doc_id="d2")]
    assert try_calculate("Chênh lệch tổng tài sản giữa năm 2023 và năm 2022?", docs) is None


def test_scope_follows_the_question():
    separate = REPORT.replace("HỢP NHẤT", "RIÊNG").replace("1.500.000", "1.200.000").replace("1.300.000", "1.100.000")
    docs = [
        _analysis(),
        _analysis(separate, name="abc_2023_separate.md", doc_id="d2"),
    ]
    sep = try_calculate("Chênh lệch tổng tài sản của công ty mẹ giữa năm 2023 và năm 2022?", docs)
    con = try_calculate("Chênh lệch tổng tài sản hợp nhất giữa năm 2023 và năm 2022?", docs)
    assert sep is not None and con is not None
    assert sep.result == 100_000 * 10**6 and con.result == 200_000 * 10**6
    default = try_calculate("Chênh lệch tổng tài sản giữa năm 2023 và năm 2022?", docs)
    assert default.result == 200_000 * 10**6  # defaults to consolidated...
    assert any("hợp nhất" in a for a in default.assumptions)  # ...and says so


def test_prior_column_of_next_years_report_fills_a_missing_year():
    docs = [_analysis()]  # the 2023 report also carries 2022 in its prior column
    c = try_calculate("Chênh lệch lợi nhuận trước thuế giữa năm 2023 và năm 2022?", docs)
    assert c is not None and c.result == (325_000 - 235_000) * 10**6
