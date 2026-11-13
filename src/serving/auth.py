"""Guest-only auth. Future registration can keep UserRow.id unchanged."""
from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response

from .db import Database
from .deps import get_db

router = APIRouter(prefix="/api/auth", tags=["auth"])
COOKIE_NAME = "finai_guest"
LIFETIME_SECONDS = 60 * 60 * 24 * 90  # 90 days; expired guests remain stored, not accessible.


def _sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def _csrf_token(auth_token: str) -> str:
    # Bound to a random HttpOnly token. Not a substitute for XSS prevention.
    return _sha256("finai-csrf:v1:" + auth_token)


def _resolve(request: Request, db: Database) -> tuple[str | None, str | None]:
    auth_token = request.cookies.get(COOKIE_NAME)
    if not auth_token or len(auth_token) > 256:
        return None, None
    return db.resolve_guest(_sha256(auth_token)), auth_token


@router.post("/guest")
def init_guest(
    request: Request,
    response: Response,
    db: Database = Depends(get_db),
):
    user_id, token = _resolve(request, db)
    if not user_id:
        token = secrets.token_urlsafe(32)
        expires_at = datetime.now(timezone.utc) + timedelta(seconds=LIFETIME_SECONDS)
        user_id = db.create_guest(_sha256(token), expires_at)
        response.set_cookie(
            key=COOKIE_NAME,
            value=token,
            httponly=True,
            secure=os.getenv("FINAI_COOKIE_SECURE", "false").lower() == "true",
            samesite="lax",
            path="/",
            max_age=LIFETIME_SECONDS,
        )
    return {"user_id": user_id, "status": "guest", "csrf_token": _csrf_token(token)}


def current_guest_user_id(
    request: Request,
    db: Database = Depends(get_db),
) -> str:
    user_id, token = _resolve(request, db)
    if not user_id:
        raise HTTPException(status_code=401, detail="Guest session expired; reload page")
    if request.method.upper() not in {"GET", "HEAD", "OPTIONS"}:
        supplied = request.headers.get("X-FinAI-CSRF", "")
        if not hmac.compare_digest(supplied, _csrf_token(token)):
            raise HTTPException(status_code=403, detail="CSRF token missing or invalid")
    return user_id
