"""MongoDB client + index management."""
from __future__ import annotations

import logging
from motor.motor_asyncio import AsyncIOMotorClient

from .config import settings

logger = logging.getLogger("hackseguro.db")

client = AsyncIOMotorClient(settings.MONGO_URL)
db = client[settings.DB_NAME]


async def ensure_indexes() -> None:
    await db.users.create_index("email", unique=True)
    await db.users.create_index("user_id", unique=True)
    await db.user_sessions.create_index("session_token", unique=True)
    await db.user_sessions.create_index("user_id")
    await db.user_sessions.create_index("expires_at", expireAfterSeconds=0)
    await db.weekly_scores.create_index([("school_code", 1), ("week_start", 1), ("xp", -1)])
    await db.weekly_scores.create_index([("user_id", 1), ("week_start", 1)], unique=True)
    await db.chat_messages.create_index([("user_id", 1), ("session_id", 1), ("created_at", 1)])
    await db.certificates.create_index([("user_id", 1), ("module_id", 1)])
    await db.schools.create_index("code", unique=True)
    await db.referrals.create_index([("invitee_user_id", 1)], unique=True)
    await db.referrals.create_index([("inviter_user_id", 1), ("created_at", -1)])
    logger.info("MongoDB indexes ensured (db=%s)", settings.DB_NAME)


async def seed_demo_schools() -> None:
    seeds = [
        {"code": "COL-LEON-001", "name": "Colegio de León", "city": "León", "state": "Guanajuato"},
        {"code": "SEC-CDMX-042", "name": "Secundaria CDMX 042", "city": "Ciudad de México", "state": "CDMX"},
        {"code": "PRIM-GDL-101", "name": "Primaria Guadalajara 101", "city": "Guadalajara", "state": "Jalisco"},
        {"code": "DEMO-001", "name": "Escuela Demo Hack-Seguro", "city": "Demo", "state": "MX"},
    ]
    for s in seeds:
        await db.schools.update_one({"code": s["code"]}, {"$setOnInsert": s}, upsert=True)


async def close_client() -> None:
    client.close()
