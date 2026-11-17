"""Thin client for the Groq chat-completions API (OpenAI-compatible).

Groq serves the generation half of the RAG loop. We talk to it over plain HTTP
with ``httpx`` rather than pulling in the full SDK, so the only dependency is
one we already use elsewhere.
"""

from __future__ import annotations

import os
import re
import time

import httpx

_BASE_URL = "https://api.groq.com/openai/v1/chat/completions"


class LLMError(RuntimeError):
    """Raised when the LLM call fails (auth, rate limit, network, …)."""


class GroqClient:
    """Minimal synchronous chat client for Groq."""

    def __init__(
        self,
        api_key: str,
        *,
        model: str = "llama-3.3-70b-versatile",
        timeout: float = 60.0,
    ) -> None:
        if not api_key:
            raise LLMError(
                "GROQ_API_KEY is not set. Add it to your environment or .env file."
            )
        self.api_key = api_key
        self.model = model
        self.timeout = timeout

    def chat(
        self,
        messages: list[dict],
        *,
        temperature: float = 0.2,
        max_tokens: int = 4096,
    ) -> str:
        """Send a chat request and return the assistant's text reply."""
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        # Reasoning models (e.g. openai/gpt-oss-*) spend completion tokens on
        # hidden "thinking"; without a low effort + headroom the visible answer
        # gets cut off (finish_reason == "length"). Override with
        # GROQ_REASONING_EFFORT=low|medium|high.
        if "gpt-oss" in self.model:
            body["reasoning_effort"] = os.getenv("GROQ_REASONING_EFFORT", "low")
        # Groq's free tier has a tokens-per-minute cap; a 429 usually clears in a
        # few seconds, so wait (bounded) and retry before surfacing an error.
        for attempt in range(3):
            try:
                resp = httpx.post(_BASE_URL, headers=headers, json=body, timeout=self.timeout)
            except httpx.HTTPError as exc:  # network / timeout
                raise LLMError(f"Could not reach Groq: {exc}") from exc
            if resp.status_code == 429 and attempt < 2:
                time.sleep(_retry_after(resp))
                continue
            if resp.status_code == 413 and attempt < 2:
                # "Request too large ... Limit L, Requested R": the per-minute token cap
                # counts the reserved completion budget too, so shrink max_tokens to fit.
                m = re.search(r"Limit (\d+), Requested (\d+)", _error_detail(resp))
                if m:
                    shrunk = body["max_tokens"] - (int(m.group(2)) - int(m.group(1))) - 150
                    if shrunk >= 400:
                        body["max_tokens"] = shrunk
                        continue
                raise LLMError(
                    "Câu hỏi kèm ngữ cảnh quá dài so với giới hạn token mỗi phút của gói Groq. "
                    "Hãy hỏi cụ thể hơn, hoặc giảm FINSIGHT_CONTEXT_CHARS trong .env."
                )
            break

        if resp.status_code == 429:
            raise LLMError(
                "Hệ thống AI đang quá tải (đã chạm giới hạn lượt dùng). "
                "Vui lòng thử lại sau ít giây."
            )
        if resp.status_code != 200:
            detail = _error_detail(resp)
            raise LLMError(f"Groq API error {resp.status_code}: {detail}")

        data = resp.json()
        try:
            choice = data["choices"][0]
            text = (choice["message"].get("content") or "").strip()
        except (KeyError, IndexError) as exc:
            raise LLMError(f"Unexpected Groq response shape: {data}") from exc
        if not text:
            raise LLMError("The model returned an empty answer. Please try again.")
        text = strip_latex(normalize_citations(text))
        if choice.get("finish_reason") == "length":
            text += "\n\n_(Câu trả lời bị cắt do giới hạn độ dài. Hãy hỏi cụ thể hơn để xem đầy đủ.)_"
        return text


# Llama sometimes imitates another vendor's citation style, e.g. "【1†L31-L38】" or
# "【2†source】", instead of the "[1]" the system prompt asks for. Rewrite to "[n]".
_ALT_CITATION = re.compile(r"【\s*(\d+)\s*(?:†[^】]*)?】")


def normalize_citations(text: str) -> str:
    return _ALT_CITATION.sub(r"[\1]", text)


# The chat UI renders Markdown only, so LaTeX the model emits would show as raw code
# (e.g. "[ \text{Số dư} = 140.000 + ... ]"). The prompt forbids it; this is the safety net
# that turns whatever slips through into plain text.
_MATH_BLOCK = re.compile(r"\\\[(.+?)\\\]|\$\$(.+?)\$\$|\\\((.+?)\\\)", re.S)
# After Markdown un-escaping, a formula can arrive as a bare "[ ... \text{...} ... ]".
_BARE_BRACKET_MATH = re.compile(r"\[\s*([^\[\]]*\\(?:text|frac|times|div|cdot|mathrm)[^\[\]]*?)\s*\]")
_WRAPPERS = re.compile(r"\\(?:text|textbf|textit|mathrm|mathbf|mathit|operatorname)\{([^{}]*)\}")
_FRAC = re.compile(r"\\[dt]?frac\{([^{}]*)\}\{([^{}]*)\}")
_SYMBOLS = {
    r"\times": "×", r"\cdot": "×", r"\div": "÷", r"\approx": "≈", r"\leq": "≤", r"\le": "≤",
    r"\geq": "≥", r"\ge": "≥", r"\neq": "≠", r"\rightarrow": "→", r"\to": "→", r"\%": "%",
    r"\left": "", r"\right": "", r"\quad": " ", r"\qquad": " ", r"\,": " ", r"\;": " ",
    r"\:": " ", r"\!": "",
}
_SYMBOL_RE = re.compile("|".join(re.escape(k) + (r"(?![a-zA-Z])" if k[1:].isalpha() else "")
                                 for k in sorted(_SYMBOLS, key=len, reverse=True)))


# \begin{aligned} a &= b \\ &= c \end{aligned}: keep the lines, drop the alignment markup.
_ENV = re.compile(
    r"\\begin\{(aligned|align\*?|equation\*?|gather\*?|array|cases|split|eqnarray\*?)\}(?:\{[lcr|\s]*\})?"
    r"(.*?)\\end\{\1\}",
    re.S,
)


def _env(m: re.Match) -> str:
    body = m.group(2)
    lines = [ln.strip() for ln in re.split(r"\\\\", body)]
    lines = [re.sub(r"\s*&\s*", " ", ln).strip() for ln in lines]
    lines = [re.sub(r"^=", "=", ln) for ln in lines if ln]
    return "\n\n" + "\n\n".join(lines) + "\n\n"


def _frac(m: re.Match) -> str:
    a, b = m.group(1).strip(), m.group(2).strip()
    wrap = lambda s: f"({s})" if re.search(r"[\s+\-×÷]", s) else s  # noqa: E731
    return f"{wrap(a)} / {wrap(b)}"


def strip_latex(text: str) -> str:
    if "\\" not in text and "$$" not in text:
        return text
    text = _ENV.sub(_env, text)
    text = _MATH_BLOCK.sub(lambda m: " " + (m.group(1) or m.group(2) or m.group(3)).strip() + " ", text)
    text = _BARE_BRACKET_MATH.sub(lambda m: m.group(1), text)
    for _ in range(3):  # nested wrappers, e.g. \text{\textbf{x}}
        text = _WRAPPERS.sub(r"\1", text)
    text = _FRAC.sub(_frac, text)
    text = _SYMBOL_RE.sub(lambda m: _SYMBOLS[m.group(0)], text)
    text = text.replace("{,}", ",")
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text


def _retry_after(resp: httpx.Response) -> float:
    """Seconds to wait before retrying a 429 (bounded so requests stay responsive)."""
    try:
        wait = float(resp.headers.get("retry-after", "5"))
    except ValueError:
        wait = 5.0
    return min(max(wait, 1.0), 20.0)


def _error_detail(resp: httpx.Response) -> str:
    try:
        return resp.json().get("error", {}).get("message", resp.text)
    except Exception:  # noqa: BLE001 - best-effort error message
        return resp.text
