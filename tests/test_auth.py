"""Auth regression checks; DB tests use an isolated temporary PostgreSQL schema.

Set FINSIGHT_AUTH_TEST_DATABASE_URL to opt in to the integration tests.
"""
import os
import uuid

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.engine import make_url

from src.serving.auth import COOKIE_NAME, hash_password, verify_password
from src.serving.db import Database, UserRow
from src.serving.deps import get_db
from src.serving import auth
from src.serving.routes import chat, documents, sessions


def test_passwords_are_salted_and_verified():
    encoded = hash_password("a-long-test-password")
    other = hash_password("a-long-test-password")
    assert encoded != other
    assert "a-long-test-password" not in encoded
    assert verify_password("a-long-test-password", encoded)
    assert not verify_password("wrong-password", encoded)
    assert not verify_password("a-long-test-password", "invalid")


@pytest.fixture
def auth_app():
    url = os.getenv("FINSIGHT_AUTH_TEST_DATABASE_URL")
    if not url:
        pytest.skip("Set FINSIGHT_AUTH_TEST_DATABASE_URL for PostgreSQL integration tests")
    schema = "auth_test_" + uuid.uuid4().hex
    admin = create_engine(url)
    with admin.begin() as conn:
        conn.exec_driver_sql(f'CREATE SCHEMA "{schema}"')
    scoped = make_url(url).update_query_dict({"options": f"-csearch_path={schema}"})
    db = Database(scoped.render_as_string(hide_password=False))
    try:
        db.create_all()
        db.create_all()  # the additive migration must be safe to repeat
        app = FastAPI()
        for router in (auth.router, sessions.router, documents.router, chat.router):
            app.include_router(router)
        app.dependency_overrides[get_db] = lambda: db
        with auth._lock:
            auth._attempts.clear()
        yield app, db
    finally:
        db.engine.dispose()
        with admin.begin() as conn:
            conn.exec_driver_sql(f'DROP SCHEMA "{schema}" CASCADE')
        admin.dispose()


def client(app):
    """A browser: bootstraps a guest, then sends the CSRF header on every request."""
    browser = TestClient(app)
    identity = browser.post("/api/auth/guest").json()
    browser.headers["X-FinAI-CSRF"] = identity["csrf_token"]
    return browser


def adopt(browser, identity):
    browser.headers["X-FinAI-CSRF"] = identity["csrf_token"]


def test_guest_can_register_and_keeps_sessions(auth_app):
    app, db = auth_app
    browser = client(app)
    sid = browser.post("/api/sessions", json={"name": "Before signup"}).json()["id"]
    credentials = {"username": "Alice", "password": "test-password-123"}
    response = browser.post("/api/auth/register", json=credentials)
    assert response.status_code == 201
    body = response.json()
    assert body["username"] == "alice" and body["status"] == "member"
    assert "password" not in response.text
    assert "httponly" in response.headers["set-cookie"].lower()
    adopt(browser, body)
    assert [s["id"] for s in browser.get("/api/sessions").json()] == [sid]
    with db._Session() as session:
        row = session.scalar(select(UserRow).where(UserRow.username == "alice"))
        assert row.password_hash != credentials["password"]
        assert verify_password(credentials["password"], row.password_hash)


def test_login_logout_and_duplicate_username(auth_app):
    app, _ = auth_app
    credentials = {"username": "alice", "password": "test-password-123"}
    first = client(app)
    adopt(first, first.post("/api/auth/register", json=credentials).json())
    second = client(app)
    assert second.post("/api/auth/register", json=credentials).status_code == 409
    assert second.post("/api/auth/login", json={**credentials, "password": "wrong-password"}).status_code == 401
    login = second.post("/api/auth/login", json=credentials)
    assert login.status_code == 200 and login.json()["status"] == "member"
    adopt(second, login.json())
    assert second.post("/api/auth/logout").status_code == 204
    assert second.get("/api/sessions").status_code == 401


def test_accounts_cannot_access_each_others_documents_or_chat(auth_app):
    app, db = auth_app
    alice, bob = client(app), client(app)
    for browser, username in ((alice, "alice"), (bob, "bob")):
        r = browser.post("/api/auth/register", json={"username": username, "password": "test-password-123"})
        assert r.status_code == 201
        adopt(browser, r.json())
    sid = alice.post("/api/sessions", json={"name": "Private report"}).json()["id"]
    assert len(alice.get("/api/sessions").json()) == 1
    assert bob.get("/api/sessions").json() == []
    for method, path, kwargs in (
        ("get", f"/api/sessions/{sid}", {}),
        ("delete", f"/api/sessions/{sid}", {}),
        ("get", f"/api/sessions/{sid}/documents", {}),
        ("get", f"/api/sessions/{sid}/documents/anything", {}),
        ("get", f"/api/sessions/{sid}/documents/anything/validation", {}),
        ("delete", f"/api/sessions/{sid}/documents/anything", {}),
        ("post", f"/api/sessions/{sid}/documents", {"files": {"file": ("test.md", b"test")}}),
        ("get", f"/api/sessions/{sid}/chat", {}),
        ("post", f"/api/sessions/{sid}/chat", {"json": {"question": "Private?"}}),
    ):
        assert getattr(bob, method)(path, **kwargs).status_code == 404
    assert alice.get(f"/api/sessions/{sid}").status_code == 200


def test_csrf_and_rate_limit(auth_app):
    app, _ = auth_app
    browser = client(app)
    browser.headers.pop("X-FinAI-CSRF")
    assert browser.post("/api/sessions", json={"name": "x"}).status_code == 403
    payload = {"username": "alice", "password": "test-password-123"}
    for _ in range(10):
        assert browser.post("/api/auth/login", json=payload).status_code == 401
    assert browser.post("/api/auth/login", json=payload).status_code == 429


class _FakeDb:
    """Minimal Database stand-in to check what chat persists, without PostgreSQL."""

    def __init__(self, status):
        self.status = status
        self.saved = []

    def get_user(self, user_id):
        return {"id": user_id, "status": self.status, "username": None}

    def session_belongs_to(self, sid, user_id):
        return True

    def list_documents(self, sid):
        return []

    def list_chat(self, sid):
        return [{"role": "user", "content": "old", "created_at": "t", "citations": []}]

    def append_message(self, sid, role, content, citations=None):
        self.saved.append((role, content))


class _FakeMemory:
    def __init__(self):
        self.turns = []

    def recent(self, sid):
        return []

    def prime(self, sid, durable):
        pass

    def add_turn(self, sid, role, content):
        self.turns.append((role, content))


class _FakePipeline:
    def answer(self, sid, question, history=None):
        from types import SimpleNamespace
        return SimpleNamespace(answer="ok", sources=[])


@pytest.mark.parametrize("status,persisted", [("guest", False), ("member", True)])
def test_only_members_get_durable_chat_history(status, persisted):
    db, memory = _FakeDb(status), _FakeMemory()
    request = chat.ChatRequest(question="Doanh thu là bao nhiêu?")
    chat.ask("sid", request, db=db, pipeline=_FakePipeline(), memory=memory, user_id="u", files=None)
    assert bool(db.saved) is persisted
    assert len(memory.turns) == 2  # short-term window always works
    history = chat.get_history("sid", db=db, user_id="u")
    assert bool(history) is persisted
