"""The answer must be in the user's language: never Chinese for a Vietnamese question."""
from src.rag.pipeline import _chat_in_language, _has_cjk, _reply_language


def test_has_cjk():
    assert _has_cjk("Tôi在提供的文件中没有找到")
    assert not _has_cjk("Tôi không tìm thấy trong tài liệu.")


def test_reply_language():
    assert _reply_language("Biên lợi nhuận gộp của Techcombank là bao nhiêu?") == "Vietnamese"
    assert _reply_language("cho vay khach hang cuoi nam 2025") == "Vietnamese"   # no diacritics
    assert _reply_language("What was the total revenue in 2023?") == "English"


class _Llm:
    def __init__(self, replies):
        self.replies, self.calls = list(replies), []

    def chat(self, messages, **kwargs):
        self.calls.append(messages)
        return self.replies.pop(0)


def test_chinese_answer_is_regenerated_once():
    llm = _Llm(["Tôi在提供的文件中没有找到毛利率", "Không tìm thấy trong tài liệu."])
    out = _chat_in_language(llm, [{"role": "user", "content": "q"}], "Biên lợi nhuận gộp?")
    assert out == "Không tìm thấy trong tài liệu."
    assert len(llm.calls) == 2 and "Vietnamese" in llm.calls[1][-1]["content"]


def test_good_answer_costs_one_call():
    llm = _Llm(["Tổng tài sản là 1.500.000 triệu đồng."])
    assert _chat_in_language(llm, [], "Tổng tài sản?").startswith("Tổng tài sản")
    assert len(llm.calls) == 1


def test_still_chinese_falls_back_to_vietnamese_message():
    llm = _Llm(["这是中文", "仍然是中文"])
    out = _chat_in_language(llm, [], "Lợi nhuận?")
    assert not _has_cjk(out) and "tài liệu" in out


def test_cjk_question_is_not_touched():
    llm = _Llm(["中文回答"])
    assert _chat_in_language(llm, [], "毛利率是多少?") == "中文回答"
