"""Tests for the Email/Password + OTP-recovery auth flow (Phase 4)."""
import asyncio
import time
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
import pytest
from motor.motor_asyncio import AsyncIOMotorClient


MONGO_URL = "mongodb://localhost:27017"
DB_NAME = "hackseguro"


def _unique_email(prefix: str = "tester") -> str:
    return f"TEST_{prefix}_{uuid.uuid4().hex[:8]}_{int(time.time())}@example.com".lower()


async def _mongo_db():
    c = AsyncIOMotorClient(MONGO_URL)
    return c, c[DB_NAME]


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


# ---------------- Register ----------------
class TestRegister:
    def test_register_success_returns_session_and_authorises_me(self, anon_client, base_url):
        email = _unique_email("reg")
        payload = {"name": "Test User", "email": email, "password": "Segur1sim@2026", "role": "student"}
        r = anon_client.post(f"{base_url}/api/auth/register", json=payload)
        assert r.status_code == 200, r.text
        data = r.json()
        assert "session_token" in data and data["session_token"]
        assert data["user"]["email"] == email
        assert data["user"]["role"] == "student"
        # Session_token authorises /auth/me
        me = anon_client.get(
            f"{base_url}/api/auth/me",
            headers={"Authorization": f"Bearer {data['session_token']}"},
        )
        assert me.status_code == 200
        assert me.json()["user"]["email"] == email

    def test_register_invalid_email_422(self, anon_client, base_url):
        r = anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "X", "email": "bademail", "password": "Segur1sim@2026", "role": "student"},
        )
        assert r.status_code == 422

    def test_register_password_too_short_422(self, anon_client, base_url):
        r = anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "X", "email": _unique_email(), "password": "short", "role": "student"},
        )
        assert r.status_code == 422

    def test_register_empty_name_422(self, anon_client, base_url):
        r = anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "", "email": _unique_email(), "password": "Segur1sim@2026", "role": "student"},
        )
        assert r.status_code == 422

    def test_register_invalid_role_422(self, anon_client, base_url):
        r = anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "X", "email": _unique_email(), "password": "Segur1sim@2026", "role": "hacker"},
        )
        assert r.status_code == 422

    def test_register_duplicate_email_409(self, anon_client, base_url):
        email = _unique_email("dup")
        payload = {"name": "Dup", "email": email, "password": "Segur1sim@2026", "role": "student"}
        r1 = anon_client.post(f"{base_url}/api/auth/register", json=payload)
        assert r1.status_code == 200
        r2 = anon_client.post(f"{base_url}/api/auth/register", json=payload)
        assert r2.status_code == 409


# ---------------- Login ----------------
class TestLogin:
    def test_login_success(self, anon_client, base_url):
        email = _unique_email("login")
        pw = "Segur1sim@2026"
        anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "Login U", "email": email, "password": pw, "role": "student"},
        )
        r = anon_client.post(f"{base_url}/api/auth/login", json={"email": email, "password": pw})
        assert r.status_code == 200, r.text
        assert r.json()["user"]["email"] == email
        assert r.json()["session_token"]

    def test_login_wrong_password_401(self, anon_client, base_url):
        email = _unique_email("wrongpw")
        anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "WP", "email": email, "password": "Segur1sim@2026", "role": "student"},
        )
        r = anon_client.post(f"{base_url}/api/auth/login", json={"email": email, "password": "wrong-pw-9999"})
        assert r.status_code == 401
        wrong_body = r.json()

        # non-existent user should return same 401 error text (no enumeration)
        r2 = anon_client.post(
            f"{base_url}/api/auth/login",
            json={"email": _unique_email("ghost"), "password": "anything-1234"},
        )
        assert r2.status_code == 401
        assert wrong_body == r2.json(), "Error text differs → possible user enumeration"


# ---------------- Forgot password ----------------
class TestForgotPassword:
    def test_forgot_ok_for_unknown_and_creates_otp_for_known(self, anon_client, base_url):
        # Unknown email → still 200 (no enumeration)
        r = anon_client.post(f"{base_url}/api/auth/forgot-password", json={"email": _unique_email("ghost")})
        assert r.status_code == 200

        # Known email: register first
        email = _unique_email("forgot")
        anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "FG", "email": email, "password": "Segur1sim@2026", "role": "student"},
        )
        r2 = anon_client.post(f"{base_url}/api/auth/forgot-password", json={"email": email})
        assert r2.status_code == 200

        # Verify OTP row appears in hackseguro.otp_codes for that email
        async def _check():
            c, db = await _mongo_db()
            try:
                row = await db.otp_codes.find_one({"email": email}, sort=[("created_at", -1)])
                return row
            finally:
                c.close()
        row = _run(_check())
        assert row is not None, "OTP row not created for known email"
        assert "code_hash" in row
        assert row.get("used") is False

    def test_forgot_rate_limit_429(self, anon_client, base_url):
        email = _unique_email("rl")
        anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "RL", "email": email, "password": "Segur1sim@2026", "role": "student"},
        )
        # 1..3 should succeed
        for i in range(3):
            r = anon_client.post(f"{base_url}/api/auth/forgot-password", json={"email": email})
            assert r.status_code == 200, f"Attempt {i+1} returned {r.status_code}"
        # 4th within 15 minutes should hit rate-limit
        r4 = anon_client.post(f"{base_url}/api/auth/forgot-password", json={"email": email})
        assert r4.status_code == 429


# ---------------- Reset password ----------------
async def _inject_otp(email: str, known_code: str = "654321") -> None:
    c, db = await _mongo_db()
    try:
        row = await db.otp_codes.find_one(
            {"email": email, "used": False}, sort=[("created_at", -1)]
        )
        assert row is not None, "No OTP row to inject into"
        new_hash = bcrypt.hashpw(known_code.encode(), bcrypt.gensalt(rounds=10)).decode()
        await db.otp_codes.update_one(
            {"_id": row["_id"]},
            {"$set": {
                "code_hash": new_hash,
                "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10),
            }},
        )
    finally:
        c.close()


class TestResetPassword:
    def test_reset_wrong_code_400(self, anon_client, base_url):
        email = _unique_email("badcode")
        anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "BC", "email": email, "password": "Segur1sim@2026", "role": "student"},
        )
        anon_client.post(f"{base_url}/api/auth/forgot-password", json={"email": email})
        r = anon_client.post(
            f"{base_url}/api/auth/reset-password",
            json={"email": email, "code": "000000", "new_password": "Segur1sim@2026!X"},
        )
        assert r.status_code == 400

    def test_reset_short_password_422(self, anon_client, base_url):
        email = _unique_email("shortpw")
        anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "SP", "email": email, "password": "Segur1sim@2026", "role": "student"},
        )
        anon_client.post(f"{base_url}/api/auth/forgot-password", json={"email": email})
        r = anon_client.post(
            f"{base_url}/api/auth/reset-password",
            json={"email": email, "code": "123456", "new_password": "short"},
        )
        assert r.status_code == 422

    def test_reset_success_rotates_session_and_code_single_use(self, anon_client, base_url):
        email = _unique_email("reset")
        pw = "Segur1sim@2026"
        reg = anon_client.post(
            f"{base_url}/api/auth/register",
            json={"name": "R U", "email": email, "password": pw, "role": "student"},
        )
        assert reg.status_code == 200
        old_token = reg.json()["session_token"]

        # Sanity: old token works
        me1 = anon_client.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {old_token}"})
        assert me1.status_code == 200

        # Request OTP + inject a known code
        anon_client.post(f"{base_url}/api/auth/forgot-password", json={"email": email})
        _run(_inject_otp(email, "654321"))

        new_pw = "Segur1sim@2026!NEW"
        r = anon_client.post(
            f"{base_url}/api/auth/reset-password",
            json={"email": email, "code": "654321", "new_password": new_pw},
        )
        assert r.status_code == 200, r.text
        new_token = r.json()["session_token"]
        assert new_token and new_token != old_token

        # Old session must be invalidated
        me2 = anon_client.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {old_token}"})
        assert me2.status_code == 401, "Old session was NOT invalidated after reset"

        # New session must work
        me3 = anon_client.get(f"{base_url}/api/auth/me", headers={"Authorization": f"Bearer {new_token}"})
        assert me3.status_code == 200

        # New password now works for login
        login = anon_client.post(f"{base_url}/api/auth/login", json={"email": email, "password": new_pw})
        assert login.status_code == 200

        # Re-using the same code must fail (single-use)
        r_reuse = anon_client.post(
            f"{base_url}/api/auth/reset-password",
            json={"email": email, "code": "654321", "new_password": "Segur1sim@2026!AGAIN"},
        )
        assert r_reuse.status_code == 400, "OTP code was reusable"
