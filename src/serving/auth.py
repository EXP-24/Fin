"""Guest + registered-member auth sharing one revocable, DB-backed cookie.

A visitor starts as a guest. Registering upgrades that same user row in place
(sessions they created stay theirs); logging in switches to an existing member.
"""
from __future__ import annotations

import hashlib
import hmac
import os
import re
import secrets
import threading
import time
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.exc import IntegrityError

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
    return db.resolve_user(_sha256(auth_token)), auth_token


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024)
    return f"scrypt${salt.hex()}${digest.hex()}"


def verify_password(password: str, encoded: str) -> bool:
    try:
        algorithm, salt, expected = encoded.split("$")
        if algorithm != "scrypt":
            return False
        actual = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=2**17, r=8, p=1, maxmem=256 * 1024 * 1024)
        return hmac.compare_digest(actual.hex(), expected)
    except (ValueError, TypeError):
        return False


_attempts: dict[str, list[float]] = {}
_lock = threading.Lock()


def limit_attempts(request: Request) -> None:
    """At most 10 register/login attempts per minute per client address."""
    key = request.client.host if request.client else "unknown"
    now = time.monotonic()
    with _lock:
        for ip in list(_attempts):
            _attempts[ip] = [t for t in _attempts[ip] if now - t < 60]
            if not _attempts[ip]:
                del _attempts[ip]
        recent = _attempts.setdefault(key, [])
        if len(recent) >= 10:
            raise HTTPException(429, "Quá nhiều lần thử. Vui lòng đợi một phút.", headers={"Retry-After": "60"})
        recent.append(now)


class Credentials(BaseModel):
    username: str = Field(min_length=3, max_length=64)
    password: str = Field(min_length=8, max_length=128)

    @field_validator("username")
    @classmethod
    def normalize_username(cls, value: str) -> str:
        value = value.strip().lower()
        if not re.fullmatch(r"[a-z0-9_.-]{3,64}", value):
            raise ValueError("Tên đăng nhập cần 3–64 ký tự: chữ không dấu, số, dấu chấm, gạch dưới hoặc gạch ngang.")
        return value


def _identity(user_id: str, token: str, db: Database) -> dict:
    user = db.get_user(user_id) or {"status": "guest", "username": None}
    return {"user_id": user_id, "status": user["status"], "username": user["username"],
            "csrf_token": _csrf_token(token)}


def _start_session(user_id: str, request: Request, response: Response, db: Database) -> str:
    """Issue a fresh token for user_id (revoking the caller's old one) and set the cookie."""
    old = request.cookies.get(COOKIE_NAME)
    if old and len(old) <= 256:
        db.revoke_token(_sha256(old))
    token = secrets.token_urlsafe(32)
    db.issue_token(user_id, _sha256(token), datetime.now(timezone.utc) + timedelta(seconds=LIFETIME_SECONDS))
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=os.getenv("FINAI_COOKIE_SECURE", "false").lower() == "true",
        samesite="lax",
        path="/",
        max_age=LIFETIME_SECONDS,
    )
    response.headers["Cache-Control"] = "no-store"
    return token


@router.post("/guest")
def init_guest(
    request: Request,
    response: Response,
    db: Database = Depends(get_db),
):
    """Bootstrap/identify: returns the current identity, creating a guest if none."""
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
    response.headers["Cache-Control"] = "no-store"
    return _identity(user_id, token, db)


@router.post("/register", status_code=201, dependencies=[Depends(limit_attempts)])
def register(payload: Credentials, request: Request, response: Response, db: Database = Depends(get_db)):
    guest_id, _ = _resolve(request, db)  # keep the guest's existing sessions
    password_hash = hash_password(payload.password)
    try:
        user = db.register_member(payload.username, password_hash, guest_id)
    except IntegrityError:
        raise HTTPException(409, "Tên đăng nhập đã được sử dụng.") from None
    token = _start_session(user["id"], request, response, db)
    return _identity(user["id"], token, db)


@router.post("/login", dependencies=[Depends(limit_attempts)])
def login(payload: Credentials, request: Request, response: Response, db: Database = Depends(get_db)):
    row = db.get_credentials(payload.username)
    # Same expensive password operation for unknown accounts (no user enumeration by timing).
    if row is None:
        hash_password(payload.password)
        valid = False
    else:
        valid = verify_password(payload.password, row["password_hash"])
    if not valid:
        raise HTTPException(401, "Tên đăng nhập hoặc mật khẩu không đúng.")
    token = _start_session(row["id"], request, response, db)
    return _identity(row["id"], token, db)


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


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: Database = Depends(get_db), _user: str = Depends(current_guest_user_id)):
    token = request.cookies.get(COOKIE_NAME)
    if token:
        db.revoke_token(_sha256(token))
    response.delete_cookie(COOKIE_NAME, path="/")
    response.headers["Cache-Control"] = "no-store"
