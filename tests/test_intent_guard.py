"""Questions about report figures must never be rejected as out-of-scope by the LLM router."""
import pytest

from src.rag.pipeline import _is_data_question


@pytest.mark.parametrize("question", [
    "Tổng tài sản tại 31/12/2025?",
    "Tiền gửi của khách hàng?",
    "Mục doanh thu nào cao nhất?",
    "cho vay khach hang cuoi nam 2025",          # no diacritics
    "Lợi nhuận sau thuế năm 2025?",
    "Dòng tiền hoạt động kinh doanh",
    "ROE năm 2025 của công ty là bao nhiêu?",
])
def test_data_questions_go_to_retrieval(question):
    assert _is_data_question(question)


@pytest.mark.parametrize("question", [
    "ROE là gì?",                                 # general knowledge: router may answer
    "Công thức tính biên lợi nhuận gộp",
    "Hôm nay thời tiết thế nào?",
    "Viết thơ về lợi nhuận",                      # financial word used only as a bypass
    "Xin chào",
])
def test_other_questions_are_left_to_the_router(question):
    assert not _is_data_question(question)
