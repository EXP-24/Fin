"""RAG chat endpoints: ask a grounded question, read conversation history.

Memory model:
  * Postgres  — durable, complete chat history (this is the source of truth).
  * Redis     — fast short-term window fed back into the LLM prompt. Primed from
                Postgres on a cache miss so coherence survives restarts.

Guests (not registered) get no durable history: their messages are never written to
Postgres and the history endpoint returns nothing. Only the short-lived Redis window
(it expires after FINSIGHT_MEMORY_TTL) keeps follow-up questions coherent.
"""

from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from src.analysis import format_calculation, try_calculate
from src.rag import RAGPipeline
from src.rag.llm import LLMError

from ..auth import current_guest_user_id
from ..db import Database
from ..deps import get_db, get_files, get_memory, get_pipeline
from ..files import FileStore
from ..memory import ShortTermMemory
from ..schemas import ChatMessage, ChatRequest, ChatResponse, Citation
from .documents import get_analysis

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/sessions/{sid}/chat", tags=["chat"])


def _session_analyses(sid: str, db: Database, files: FileStore) -> list[dict]:
    """Extracted facts of every document of the session (analysing old uploads lazily)."""
    out: list[dict] = []
    for d in db.list_documents(sid):
        if d["status"] == "failed":
            continue
        analysis = get_analysis(files, sid, d)
        if analysis and analysis.get("facts"):
            out.append({
                "doc_id": d["id"], "doc_name": d["filename"], "scope": analysis.get("scope", "unknown"),
                "year": analysis.get("year"), "facts": analysis["facts"],
            })
    return out


def _is_member(db: Database, user_id: str) -> bool:
    """Only registered members get a durable chat history."""
    return (db.get_user(user_id) or {}).get("status") == "member"


@router.get("", response_model=list[ChatMessage])
def get_history(sid: str, db: Database = Depends(get_db), user_id: str = Depends(current_guest_user_id)):
    if not db.session_belongs_to(sid, user_id):
        raise HTTPException(status_code=404, detail="Session not found")
    if not _is_member(db, user_id):
        return []
    return [ChatMessage(**m) for m in db.list_chat(sid)]


@router.post("", response_model=ChatResponse)
def ask(
    sid: str,
    payload: ChatRequest,
    db: Database = Depends(get_db),
    pipeline: RAGPipeline = Depends(get_pipeline),
    memory: ShortTermMemory = Depends(get_memory),
    user_id: str = Depends(current_guest_user_id),
    files: FileStore = Depends(get_files),
):
    if not db.session_belongs_to(sid, user_id):
        raise HTTPException(status_code=404, detail="Session not found")

    member = _is_member(db, user_id)

    # recent turns from the cache; if empty, prime it from durable history
    history = memory.recent(sid)
    if not history and member:
        durable = db.list_chat(sid)
        if durable:
            memory.prime(sid, durable)
            history = memory.recent(sid)

    # Differences / growth / well-known ratios of statement line items are computed by
    # code from the extracted facts (never by the LLM). Anything the calculator is not
    # sure about returns None and falls through to retrieval + LLM as before.
    calc = None
    try:
        calc = try_calculate(payload.question, _session_analyses(sid, db, files))
    except Exception:  # noqa: BLE001 - the calculator must never break chat
        logger.exception("Calculator failed; falling back to RAG")

    if calc is not None:
        logger.info("Answered %r with the calculator (%s)", payload.question[:80], calc.kind)
        answer = format_calculation(calc)
        citations = [Citation(**c) for c in calc.citations()]
    else:
        try:
            result = pipeline.answer(sid, payload.question, history=history)
        except LLMError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
        answer = result.answer
        citations = [
            Citation(
                rank=s.rank,
                doc_id=s.doc_id,
                doc_name=s.doc_name,
                page=s.page,
                score=s.score,
                snippet=s.text[:400],
            )
            for s in result.sources
        ]

    # durable history (Postgres, members only) + short-term window (Redis)
    if member:
        db.append_message(sid, "user", payload.question)
        db.append_message(
            sid, "assistant", answer, [c.model_dump() for c in citations]
        )
    memory.add_turn(sid, "user", payload.question)
    memory.add_turn(sid, "assistant", answer)

    return ChatResponse(answer=answer, citations=citations)
