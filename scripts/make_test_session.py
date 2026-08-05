"""Utility to regenerate seeded test sessions for backend testing.

Run: `python /app/scripts/make_test_session.py`
Prints STUDENT_TOKEN and TEACHER_TOKEN for use with /app/backend/tests/test_backend.py.
"""
import asyncio, uuid
from motor.motor_asyncio import AsyncIOMotorClient
from datetime import datetime, timedelta, timezone

async def main():
    c = AsyncIOMotorClient("mongodb://localhost:27017")
    db = c["hackseguro"]

    email = "test.student@hackseguro.test"
    user = await db.users.find_one({"email": email})
    if not user:
        uid = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": uid, "email": email, "name": "Estudiante Prueba",
            "role": "student", "school_code": "DEMO-001", "grade": "6°", "group": "A",
            "xp": 0, "coins": 25, "level": 1, "hearts": 5, "streak": 0,
            "completed_lessons": {}, "badges": [],
            "created_at": datetime.now(timezone.utc),
        })
    else:
        uid = user["user_id"]
        await db.users.update_one({"user_id": uid}, {"$set": {
            "role": "student", "school_code": "DEMO-001", "grade": "6°", "group": "A",
            "xp": 0, "coins": 25, "level": 1, "hearts": 5, "streak": 0,
            "completed_lessons": {}, "badges": [], "daily_claim_date": None,
        }})
    await db.weekly_scores.delete_many({"user_id": uid})
    stok = "test-token-" + uuid.uuid4().hex[:16]
    await db.user_sessions.insert_one({
        "session_token": stok, "user_id": uid,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })

    t_email = "test.teacher@hackseguro.test"
    t = await db.users.find_one({"email": t_email})
    if not t:
        tid = f"user_{uuid.uuid4().hex[:12]}"
        await db.users.insert_one({
            "user_id": tid, "email": t_email, "name": "Docente Prueba",
            "role": "teacher", "school_code": "DEMO-001", "grade": None, "group": None,
            "xp": 0, "coins": 25, "level": 1, "hearts": 5, "streak": 0,
            "completed_lessons": {}, "badges": [],
            "created_at": datetime.now(timezone.utc),
        })
    else:
        tid = t["user_id"]
        await db.users.update_one({"user_id": tid}, {"$set": {"role": "teacher", "school_code": "DEMO-001"}})
    ttok = "test-token-" + uuid.uuid4().hex[:16]
    await db.user_sessions.insert_one({
        "session_token": ttok, "user_id": tid,
        "created_at": datetime.now(timezone.utc),
        "expires_at": datetime.now(timezone.utc) + timedelta(days=7),
    })

    print("STUDENT_TOKEN=" + stok)
    print("STUDENT_UID=" + uid)
    print("TEACHER_TOKEN=" + ttok)
    print("TEACHER_UID=" + tid)

asyncio.run(main())
