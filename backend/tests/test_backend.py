"""Full backend regression suite for Hack-Seguro Phase 2."""


# ---------------- Health & schools ----------------
class TestHealth:
    def test_root(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/")
        assert r.status_code == 200
        data = r.json()
        assert data["ok"] is True
        assert data["app"] == "Hack-Seguro"

    def test_get_school_demo(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/schools/DEMO-001")
        assert r.status_code == 200
        data = r.json()
        assert data["code"] == "DEMO-001"
        assert "Demo" in data["name"] or "demo" in data["name"].lower()


# ---------------- Auth ----------------
class TestAuth:
    def test_session_invalid_returns_401(self, anon_client, base_url):
        r = anon_client.post(f"{base_url}/api/auth/session",
                             json={"session_id": "obviously-fake-session-id-xyz"})
        assert r.status_code == 401

    def test_me_returns_current_user(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["email"] == "test.student@hackseguro.test"
        assert u["school_code"] == "DEMO-001"
        assert u["role"] == "student"
        assert u["grade"] == "6°"
        assert u["group"] == "A"

    def test_me_without_token_401(self, anon_client, base_url):
        r = anon_client.get(f"{base_url}/api/auth/me")
        assert r.status_code == 401


# ---------------- Progress ----------------
class TestProgress:
    def test_lesson_complete_passwords(self, student_client, base_url):
        # baseline XP
        me = student_client.get(f"{base_url}/api/auth/me").json()["user"]
        base_xp = me["xp"]
        base_pw = (me.get("completed_lessons") or {}).get("passwords", 0)

        r = student_client.post(f"{base_url}/api/lessons/complete",
                                json={"module_id": "passwords", "correct": 3, "total": 3})
        assert r.status_code == 200
        data = r.json()
        assert data["xp"] == 30
        user = data["user"]
        assert user["completed_lessons"]["passwords"] == base_pw + 1
        assert user["xp"] == base_xp + 30
        assert "guardian" in user["badges"]

    def test_game_complete_fraude(self, student_client, base_url):
        me = student_client.get(f"{base_url}/api/auth/me").json()["user"]
        base_xp = me["xp"]
        base_coins = me["coins"]
        r = student_client.post(f"{base_url}/api/games/complete",
                                json={"game_id": "fraude", "score": 5, "total": 6})
        assert r.status_code == 200
        d = r.json()
        assert d["xp"] == 30
        u = d["user"]
        assert u["xp"] == base_xp + 30
        assert u["coins"] == base_coins + 10  # score*2 = 10
        assert "detective" in u["badges"]

    def test_daily_claim_once_then_conflict(self, student_client, base_url):
        r1 = student_client.post(f"{base_url}/api/daily/claim")
        # First call may succeed; if user already claimed today (rare in test), status 400
        if r1.status_code == 200:
            data = r1.json()
            assert data["xp"] == 20
            assert data["coins"] == 15
            assert data["user"]["daily_claim_date"] is not None
            r2 = student_client.post(f"{base_url}/api/daily/claim")
            assert r2.status_code == 400
        else:
            assert r1.status_code == 400


# ---------------- Leaderboards ----------------
class TestLeaderboards:
    def test_weekly_school(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/leaderboards/weekly?scope=school")
        assert r.status_code == 200
        data = r.json()
        assert data["scope"] == "school"
        assert data["school_code"] == "DEMO-001"
        # week_start should be Monday 00:00 UTC ISO
        ws = data["week_start"]
        assert "T00:00:00" in ws
        top = data["top"]
        assert isinstance(top, list)
        # sorted by xp desc, rank starting at 1
        if top:
            assert top[0]["rank"] == 1
            xps = [r["xp"] for r in top]
            assert xps == sorted(xps, reverse=True)
        # `me` should be present because student earned XP in earlier tests
        assert data["me"] is not None
        assert data["me"]["rank"] >= 1
        assert data["me"]["xp"] > 0

    def test_weekly_global(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/leaderboards/weekly?scope=global")
        assert r.status_code == 200
        data = r.json()
        assert data["scope"] == "global"
        assert isinstance(data["top"], list)


# ---------------- Certificates ----------------
class TestCertificates:
    def test_pdf_returned(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/certificates/passwords")
        assert r.status_code == 200
        assert r.headers["content-type"].startswith("application/pdf")
        assert len(r.content) > 500
        assert r.content[:4] == b"%PDF"

    def test_pdf_module_not_completed(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/certificates/phishing")
        # phishing wasn't completed => 400
        assert r.status_code == 400


# ---------------- Teacher roster ----------------
class TestTeacherRoster:
    def test_student_forbidden(self, student_client, base_url):
        r = student_client.get(f"{base_url}/api/teacher/roster")
        assert r.status_code == 403

    def test_teacher_ok(self, teacher_client, base_url):
        r = teacher_client.get(f"{base_url}/api/teacher/roster")
        assert r.status_code == 200
        data = r.json()
        assert data["school_code"] == "DEMO-001"
        assert isinstance(data["groups"], list)


# ---------------- Schools join ----------------
class TestSchoolsJoin:
    def test_join_invalid(self, student_client, base_url):
        r = student_client.post(f"{base_url}/api/schools/join",
                                json={"school_code": "INVALID-CODE"})
        assert r.status_code == 404

    def test_join_promotes_to_teacher(self, student_client, base_url):
        r = student_client.post(f"{base_url}/api/schools/join",
                                json={"school_code": "DEMO-001", "role": "teacher"})
        assert r.status_code == 200
        u = r.json()["user"]
        assert u["role"] == "teacher"
        assert u["school_code"] == "DEMO-001"
        # revert back to student for other tests (order-independent safety)
        r2 = student_client.post(f"{base_url}/api/schools/join",
                                 json={"school_code": "DEMO-001", "role": "student",
                                       "grade": "6°", "group": "A"})
        assert r2.status_code == 200


# ---------------- Chatbot ----------------
class TestChatbot:
    def test_chatbot_spanish_reply(self, student_client, base_url):
        r = student_client.post(f"{base_url}/api/chatbot",
                                json={"session_id": "t1",
                                      "message": "¿cómo hago una contraseña segura?"},
                                timeout=60)
        assert r.status_code == 200, r.text
        reply = r.json()["reply"]
        assert reply and len(reply) > 10
        low = reply.lower()
        # Should NOT ask for personal data
        forbidden = ["curp", "rfc", "nip", "número de tarjeta", "numero de tarjeta",
                     "tu contraseña actual", "dame tu contraseña", "dime tu contraseña"]
        for term in forbidden:
            assert term not in low, f"Reply asked for personal data ({term!r}): {reply}"
