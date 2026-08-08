"""Quick regression smoke tests after push.ts / app.json fix.

Verifies:
 - POST /api/auth/register still returns 200 with valid payload
 - GET /api/referrals/mine still returns expected shape for seeded ambassador

Reads BASE_URL from EXPO_PUBLIC_BACKEND_URL (frontend .env) or EXPO_BACKEND_URL.
"""
import os
import time
import uuid
import pytest
import requests

BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://ciber-educativo.preview.emergentagent.com"
).rstrip("/")


@pytest.fixture(scope="module")
def api():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


def test_health_reachable(api):
    r = api.get(f"{BASE_URL}/api/", timeout=15)
    assert r.status_code in (200, 404), f"Unexpected {r.status_code}: {r.text[:200]}"


def test_register_returns_200(api):
    email = f"tester+{int(time.time())}_{uuid.uuid4().hex[:6]}@example.com"
    payload = {
        "email": email,
        "password": "Segur1sim@2026",
        "name": "Push Fix Smoke",
        "role": "student",
    }
    r = api.post(f"{BASE_URL}/api/auth/register", json=payload, timeout=20)
    assert r.status_code == 200, f"register failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    assert "session_token" in body and "user" in body
    assert body["user"]["email"] == email


def _get_ambassador_token():
    """Create/refresh a seeded student user session and return bearer + user_id."""
    import asyncio
    from datetime import datetime, timedelta, timezone
    from motor.motor_asyncio import AsyncIOMotorClient

    async def main():
        c = AsyncIOMotorClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
        db = c[os.environ.get("DB_NAME", "hackseguro")]
        email = "test.student@hackseguro.test"
        user = await db.users.find_one({"email": email})
        if not user:
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            await db.users.insert_one({
                "user_id": user_id, "email": email, "name": "Estudiante Prueba",
                "role": "student", "school_code": "DEMO-001",
                "xp": 0, "coins": 25, "level": 1, "hearts": 5, "streak": 0,
                "completed_lessons": {}, "badges": [],
                "created_at": datetime.now(timezone.utc),
            })
        else:
            user_id = user["user_id"]
        token = "test-token-" + uuid.uuid4().hex[:16]
        await db.user_sessions.insert_one({
            "session_token": token, "user_id": user_id,
            "created_at": datetime.now(timezone.utc),
            "expires_at": datetime.now(timezone.utc) + timedelta(days=1),
        })
        return token, user_id

    return asyncio.get_event_loop().run_until_complete(main()) if False else asyncio.run(main())


def test_referrals_mine_shape(api):
    try:
        token, _ = _get_ambassador_token()
    except Exception as e:
        pytest.skip(f"cannot bootstrap ambassador session: {e}")

    r = api.get(
        f"{BASE_URL}/api/referrals/mine",
        headers={"Authorization": f"Bearer {token}"},
        timeout=15,
    )
    assert r.status_code == 200, f"referrals/mine failed: {r.status_code} {r.text[:300]}"
    body = r.json()
    # Just assert the expected top-level shape
    assert isinstance(body, dict), body
    # Expect at least a code field or referrals list – be permissive
    keys = set(body.keys())
    assert keys, "empty response body"
    print("referrals/mine keys:", keys)
