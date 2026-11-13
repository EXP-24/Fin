"""Session CRUD endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from src.rag import VectorStore

from ..auth import current_guest_user_id
from ..db import Database
from ..deps import get_db, get_files, get_memory, get_vectorstore
from ..files import FileStore
from ..memory import ShortTermMemory
from ..schemas import DocumentInfo, SessionCreate, SessionDetail, SessionSummary

router = APIRouter(prefix="/api/sessions", tags=["sessions"])


@router.post("", response_model=SessionSummary, status_code=201)
def create_session(payload: SessionCreate, db: Database = Depends(get_db), user_id: str = Depends(current_guest_user_id)):
    created = db.create_session(payload.name, payload.description, user_id)
    return db.get_summary(created["id"])


@router.get("", response_model=list[SessionSummary])
def list_sessions(db: Database = Depends(get_db), user_id: str = Depends(current_guest_user_id)):
    return db.list_summaries(user_id)


@router.get("/{sid}", response_model=SessionDetail)
def get_session(sid: str, db: Database = Depends(get_db), user_id: str = Depends(current_guest_user_id)):
    if not db.session_belongs_to(sid, user_id):
        raise HTTPException(status_code=404, detail="Session not found")
    summary = db.get_summary(sid)
    if summary is None:
        raise HTTPException(status_code=404, detail="Session not found")
    documents = [DocumentInfo(**d) for d in db.list_documents(sid)]
    return SessionDetail(**summary, documents=documents)


@router.delete("/{sid}", status_code=204)
def delete_session(
    sid: str,
    db: Database = Depends(get_db),
    vectors: VectorStore = Depends(get_vectorstore),
    files: FileStore = Depends(get_files),
    memory: ShortTermMemory = Depends(get_memory),
    user_id: str = Depends(current_guest_user_id),
):
    if not db.session_belongs_to(sid, user_id):
        raise HTTPException(status_code=404, detail="Session not found")
    if not db.delete_session(sid, user_id):
        raise HTTPException(status_code=404, detail="Session not found")
    # tear down the session's data in the other stores too
    vectors.delete_session(sid)
    files.delete_session(sid)
    memory.clear(sid)
