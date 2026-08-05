"""Phase 3 backend tests for Hack-Seguro:
- Public certificate verification (JSON + HTML)
- Municipal/state leaderboard scopes
- Quarterly seasons
- Server-generated school poster PNG + /join landing
- Push notification endpoints (Emergent Push)

Prereq: /app/backend/tests/conftest.py provides base_url, student/teacher clients.
"""
import io
import re
import pytest
from PIL import Image


# ----------------- Shareable poster + join landing -----------------
class TestSchoolPoster:
    def test_poster_png(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/schools/DEMO-001/poster.png")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("image/png")
        assert len(r.content) > 10_000, f"expected >10KB, got {len(r.content)}"
        im = Image.open(io.BytesIO(r.content))
        assert im.size == (1080, 1920), f"expected 1080x1920, got {im.size}"

    def test_poster_unknown_school_404(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/schools/BOGUS-999/poster.png")
        assert r.status_code == 404

    def test_join_landing_html(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/join?code=DEMO-001")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")
        body = r.text
        assert "DEMO-001" in body, "landing HTML must mention DEMO-001"

    def test_join_landing_generic(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/join")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", "")


# ----------------- Certificate public verification -----------------
class TestCertificateVerify:
    def test_verify_bad_id_json(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/certificates/verify/HS-BAD-ID")
        assert r.status_code == 200
        data = r.json()
        assert data["valid"] is False
        assert data.get("cert_id") == "HS-BAD-ID"

    def test_verify_bad_id_html(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/verify/HS-BAD-ID")
        assert r.status_code == 200
        assert "text/html" in r.headers.get("content-type", ""), r.headers
        assert "Certificado no encontrado" in r.text

    def test_verify_valid_json_and_html(self, student_client, anon_client, base_url):
        # 1) Ensure the student has completed the passwords module.
        student_client.post(
            f"{base_url}/api/lessons/complete",
            json={"module_id": "passwords", "correct": 3, "total": 3},
        )
        # 2) Trigger PDF creation which inserts a certificate row.
        pdf = student_client.get(f"{base_url}/api/certificates/passwords")
        assert pdf.status_code == 200
        assert pdf.headers["content-type"].startswith("application/pdf")
        assert pdf.content[:4] == b"%PDF"
        # 3) Look up cert_id from Mongo (source of truth).
        import asyncio
        from motor.motor_asyncio import AsyncIOMotorClient
        me = student_client.get(f"{base_url}/api/auth/me").json()["user"]
        async def _get():
            c = AsyncIOMotorClient("mongodb://localhost:27017")
            row = await c["hackseguro"].certificates.find_one(
                {"user_id": me["user_id"], "module_id": "passwords"}, {"_id": 0}
            )
            return row["cert_id"] if row else None
        cert_id = asyncio.run(_get())
        assert cert_id, "certificate row not found for user in db.certificates"

        # JSON endpoint
        j = anon_client.get(f"{base_url}/api/certificates/verify/{cert_id}")
        assert j.status_code == 200
        data = j.json()
        assert data["valid"] is True
        assert data["cert_id"] == cert_id
        assert data["student_name"]
        assert data["module_title"]
        assert data["school"] is not None
        assert data["school"]["code"] == "DEMO-001"

        # HTML endpoint
        h = anon_client.get(f"{base_url}/api/verify/{cert_id}")
        assert h.status_code == 200
        assert "text/html" in h.headers.get("content-type", ""), h.headers
        assert "Certificado v" in h.text  # 'válido' (utf-8)
        assert data["student_name"] in h.text


# ----------------- Leaderboard scopes -----------------
class TestLeaderboardScopes:
    def test_scope_city(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/leaderboards/weekly?scope=city")
        assert r.status_code == 200
        d = r.json()
        assert d["scope"] == "city"
        assert d["school_code"] == "DEMO-001"
        assert isinstance(d["top"], list)
        # DEMO-001 city == "Demo"; all rows must belong to schools in same city.
        for row in d["top"]:
            assert row.get("school_code") == "DEMO-001"

    def test_scope_state(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/leaderboards/weekly?scope=state")
        assert r.status_code == 200
        d = r.json()
        assert d["scope"] == "state"
        # DEMO-001 state == "MX"; only DEMO-001 school lives in state=MX
        for row in d["top"]:
            assert row.get("school_code") == "DEMO-001"

    def test_scope_school_still_works(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/leaderboards/weekly?scope=school")
        assert r.status_code == 200
        d = r.json()
        assert d["scope"] == "school"
        assert d["school_code"] == "DEMO-001"

    def test_scope_bogus(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/leaderboards/weekly?scope=bogus")
        assert r.status_code == 400


# ----------------- Seasons -----------------
class TestSeasons:
    def test_seasons_current(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/seasons/current")
        assert r.status_code == 200
        d = r.json()
        assert re.fullmatch(r"\d{4}-Q[1-4]", d["season"]), d["season"]
        assert d["start"].endswith("+00:00")
        assert d["end"].endswith("+00:00")
        assert d["start"] < d["end"]

    def test_seasons_leaderboard(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/seasons/leaderboard")
        assert r.status_code == 200
        d = r.json()
        assert "top_schools" in d
        top = d["top_schools"]
        assert isinstance(top, list)
        # Sorted by avg_xp_per_active_student desc; rank starts at 1
        if top:
            keys = {"school_code", "school_name", "total_xp",
                    "active_students", "avg_xp_per_active_student", "rank"}
            for row in top:
                assert keys.issubset(row.keys()), f"missing keys in {row}"
            avgs = [r["avg_xp_per_active_student"] for r in top]
            assert avgs == sorted(avgs, reverse=True)
            assert top[0]["rank"] == 1

    def test_seasons_leaderboard_requires_auth(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/seasons/leaderboard")
        assert r.status_code == 401


# ----------------- Push -----------------
class TestPush:
    def test_register_push_user_mismatch(self, student_client, base_url):
        r = student_client.post(
            f"{base_url}/api/register-push",
            json={"user_id": "user_NOT_ME", "platform": "android", "device_token": "abc"},
        )
        assert r.status_code == 403

    def test_register_push_self_with_placeholder_key(self, student_client, base_url):
        # Get real user_id from /me
        me = student_client.get(f"{base_url}/api/auth/me").json()["user"]
        uid = me["user_id"]
        r = student_client.post(
            f"{base_url}/api/register-push",
            json={"user_id": uid, "platform": "android", "device_token": "abc"},
        )
        # EMERGENT_PUSH_KEY=placeholder in preview → 500 or 401 acceptable.
        # If real key is present → 201.
        assert r.status_code in (201, 401, 500, 502), r.text

    def test_register_push_requires_auth(self, anon_client, base_url):
        r = anon_client.post(
            f"{base_url}/api/register-push",
            json={"user_id": "user_x", "platform": "android", "device_token": "abc"},
        )
        assert r.status_code == 401

    def test_streak_reminder(self, student_client, base_url):
        r = student_client.post(f"{base_url}/api/push/streak-reminder")
        assert r.status_code == 200
        d = r.json()
        assert "scheduled" in d and "sent" in d and "date" in d
        assert isinstance(d["scheduled"], int)
        assert isinstance(d["sent"], int)
        # With placeholder key + no push_platform on users, both should be 0.
        assert d["scheduled"] >= 0


# ----------------- Regression: PDF certificate still works -----------------
class TestCertificatePdfRegression:
    def test_pdf_still_returns_application_pdf(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/certificates/passwords")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert r.content[:4] == b"%PDF"
        assert len(r.content) > 1000
