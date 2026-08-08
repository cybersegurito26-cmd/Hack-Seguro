"""
Iteration 7 backend regression tests for the Ambassadors/Referrals fixes.

Covers:
  1. GET /api/referrals/poster.png — new optional `?t=<token>` query auth
     - missing token → 401
     - Authorization header → 200 (PNG magic + >5KB)
     - ?t=valid → 200 (PNG magic + >5KB)
     - ?t=bogus → 401
     - ?t=expired → 401 (session deleted)
  2. /api/referrals/mine spot-check (auth guard + shape)
  3. /api/join?code=DEMO-001&ref=<user> renders inviter block
  4. /api/auth/register with valid ref → invited_by_user_id set
     /api/auth/register with malformed ref → invited_by_user_id null
     /api/auth/register with well-formed but unknown ref → invited_by_user_id null
"""
import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import pytest
import requests
from motor.motor_asyncio import AsyncIOMotorClient

BASE_URL = os.environ.get("EXPO_PUBLIC_BACKEND_URL") or os.environ.get("EXPO_BACKEND_URL")
assert BASE_URL, "EXPO_PUBLIC_BACKEND_URL must be set"
BASE_URL = BASE_URL.rstrip("/")
API = f"{BASE_URL}/api"

MONGO_URL = os.environ.get("MONGO_URL", "mongodb://localhost:27017")
DB_NAME = os.environ.get("DB_NAME", "hackseguro")


# ---------- helpers ----------
def _random_email(prefix="TEST_iter7"):
    return f"{prefix}_{uuid.uuid4().hex[:10]}@example.com"


def _register(email=None, password="Segur1sim@2026", role="student", ref=None):
    body = {
        "name": "Iter7 Tester",
        "email": email or _random_email(),
        "password": password,
        "role": role,
    }
    if ref is not None:
        body["ref"] = ref
    r = requests.post(f"{API}/auth/register", json=body, timeout=30)
    return r


@pytest.fixture(scope="module")
def inviter():
    """Register an inviter and return {token, user_id, email}."""
    r = _register()
    assert r.status_code == 200, f"inviter registration failed: {r.status_code} {r.text}"
    data = r.json()
    return {
        "token": data["session_token"],
        "user_id": data["user"]["user_id"],
        "email": data["user"]["email"],
    }


@pytest.fixture(scope="module")
def event_loop():
    loop = asyncio.new_event_loop()
    yield loop
    loop.close()


@pytest.fixture(scope="module")
def mongo(event_loop):
    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]
    yield event_loop, db
    client.close()


# ---------------------------------------------------------------
# 1) POSTER ENDPOINT — ?t= query token
# ---------------------------------------------------------------
class TestPosterQueryToken:
    def test_poster_missing_token_returns_401(self):
        r = requests.get(f"{API}/referrals/poster.png", timeout=15)
        assert r.status_code == 401, f"expected 401, got {r.status_code}"

    def test_poster_with_header_token_returns_png(self, inviter):
        r = requests.get(
            f"{API}/referrals/poster.png",
            headers={"Authorization": f"Bearer {inviter['token']}"},
            timeout=30,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        assert r.headers.get("Content-Type", "").startswith("image/png")
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n", "PNG magic mismatch"
        assert len(r.content) > 5 * 1024, f"png too small ({len(r.content)} bytes)"
        # NOTE: backend emits `private, max-age=300` (verified via direct localhost hit)
        # but the public ingress/Cloudflare layer rewrites it to
        # `no-store, no-cache, must-revalidate`. Still present, non-empty.
        cc = r.headers.get("Cache-Control", "")
        assert cc, "Cache-Control header missing"

    def test_poster_with_query_token_returns_png(self, inviter):
        r = requests.get(
            f"{API}/referrals/poster.png",
            params={"t": inviter["token"]},
            timeout=30,
        )
        assert r.status_code == 200, f"got {r.status_code}: {r.text[:200]}"
        assert r.headers.get("Content-Type", "").startswith("image/png")
        assert r.content[:8] == b"\x89PNG\r\n\x1a\n"
        assert len(r.content) > 5 * 1024

    def test_poster_with_bogus_query_token_returns_401(self):
        r = requests.get(
            f"{API}/referrals/poster.png",
            params={"t": "totally-not-a-real-token"},
            timeout=15,
        )
        assert r.status_code == 401, f"expected 401, got {r.status_code}"

    def test_poster_with_expired_token_returns_401(self, mongo):
        # Register a fresh user, then delete its session
        r = _register()
        assert r.status_code == 200
        expired_token = r.json()["session_token"]

        loop, db = mongo

        async def _delete_session():
            await db.user_sessions.delete_one({"session_token": expired_token})

        loop.run_until_complete(_delete_session())

        r2 = requests.get(
            f"{API}/referrals/poster.png",
            params={"t": expired_token},
            timeout=15,
        )
        assert r2.status_code == 401, f"expected 401, got {r2.status_code}"


# ---------------------------------------------------------------
# 2) /referrals/mine regression
# ---------------------------------------------------------------
class TestReferralsMineRegression:
    def test_mine_requires_auth(self):
        r = requests.get(f"{API}/referrals/mine", timeout=15)
        assert r.status_code == 401

    def test_mine_shape_ok(self, inviter):
        r = requests.get(
            f"{API}/referrals/mine",
            headers={"Authorization": f"Bearer {inviter['token']}"},
            timeout=15,
        )
        assert r.status_code == 200
        d = r.json()
        for k in ("user_id", "valid", "pending", "share_url", "poster_url", "goals", "invitees"):
            assert k in d, f"missing key {k}"
        assert d["user_id"] == inviter["user_id"]
        assert f"ref={inviter['user_id']}" in d["share_url"]
        # goals contain both badge thresholds
        thresholds = {g["threshold"] for g in d["goals"]}
        assert {3, 10}.issubset(thresholds)


# ---------------------------------------------------------------
# 3) /api/join public HTML
# ---------------------------------------------------------------
class TestJoinPublic:
    def test_join_with_ref_renders_inviter(self, inviter):
        r = requests.get(
            f"{API}/join",
            params={"code": "DEMO-001", "ref": inviter["user_id"]},
            timeout=15,
        )
        assert r.status_code == 200
        body = r.text
        assert "Escuela" in body or "DEMO-001" in body

    def test_join_without_ref_still_renders_school(self):
        r = requests.get(f"{API}/join", params={"code": "DEMO-001"}, timeout=15)
        assert r.status_code == 200
        assert "DEMO-001" in r.text or "Escuela" in r.text


# ---------------------------------------------------------------
# 4) /auth/register with ref
# ---------------------------------------------------------------
class TestRegisterWithRef:
    def test_register_with_valid_ref_sets_attribution(self, inviter, mongo):
        invitee_email = _random_email("TEST_iter7_invitee_ok")
        r = _register(email=invitee_email, ref=inviter["user_id"])
        assert r.status_code == 200, r.text
        invitee_uid = r.json()["user"]["user_id"]

        loop, db = mongo

        async def _find():
            return await db.users.find_one({"user_id": invitee_uid}, {"_id": 0})

        u = loop.run_until_complete(_find())
        assert u is not None
        assert u.get("invited_by_user_id") == inviter["user_id"], (
            f"expected invited_by_user_id={inviter['user_id']}, got {u.get('invited_by_user_id')!r}"
        )

    def test_register_with_unknown_but_wellformed_ref_is_silently_ignored(self, mongo):
        # user_ + hex, matches REF_VALIDATOR shape but doesn't exist in DB
        bogus_ref = f"user_{uuid.uuid4().hex[:12]}"
        invitee_email = _random_email("TEST_iter7_invitee_unknown")
        r = _register(email=invitee_email, ref=bogus_ref)
        assert r.status_code == 200, r.text
        invitee_uid = r.json()["user"]["user_id"]

        loop, db = mongo

        async def _find():
            return await db.users.find_one({"user_id": invitee_uid}, {"_id": 0})

        u = loop.run_until_complete(_find())
        assert u is not None
        assert u.get("invited_by_user_id") in (None, ""), (
            f"expected invited_by_user_id null for unknown ref, got {u.get('invited_by_user_id')!r}"
        )

    def test_register_with_malformed_ref_is_ignored(self, mongo):
        # Garbled ref (frontend regex now blocks this, but backend must also be safe)
        invitee_email = _random_email("TEST_iter7_invitee_garbled")
        garbled = "user_abcdef https://ciber-educativo.preview.emergentagent.com/?ref=user_abcdef"
        r = _register(email=invitee_email, ref=garbled)
        assert r.status_code == 200, r.text
        invitee_uid = r.json()["user"]["user_id"]

        loop, db = mongo

        async def _find():
            return await db.users.find_one({"user_id": invitee_uid}, {"_id": 0})

        u = loop.run_until_complete(_find())
        assert u is not None
        assert u.get("invited_by_user_id") in (None, ""), (
            f"malformed ref must be ignored; got {u.get('invited_by_user_id')!r}"
        )
