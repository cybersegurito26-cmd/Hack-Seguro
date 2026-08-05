"""Progress: lessons/complete, games/complete, daily/claim, /progress."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Header, HTTPException

from ..core.config import settings
from ..core.database import db
from ..dependencies import current_user
from ..models import GameCompleteIn, LessonCompleteIn, User, user_public, utcnow
from ..services.progress import (
    apply_xp_coins, credit_referral_if_first_activity, maybe_unlock_badges,
)

router = APIRouter()


@router.get("/progress")
async def get_progress(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    return {"user": user_public(u)}


@router.post("/lessons/complete")
async def complete_lesson(body: LessonCompleteIn, authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    if body.module_id not in settings.MODULE_IDS:
        raise HTTPException(400, "Módulo inválido")
    xp = max(0, body.correct) * 10
    coins = 5 + max(0, body.correct)

    await db.users.update_one(
        {"user_id": u.user_id},
        {"$inc": {f"completed_lessons.{body.module_id}": 1}},
    )
    await db.lesson_events.insert_one({
        "user_id": u.user_id,
        "module_id": body.module_id,
        "correct": body.correct,
        "total": body.total,
        "xp": xp,
        "coins": coins,
        "created_at": utcnow(),
    })
    await apply_xp_coins(u.user_id, xp, coins)
    new_badges = await maybe_unlock_badges(u.user_id)
    await credit_referral_if_first_activity(u.user_id)
    u3 = await db.users.find_one({"user_id": u.user_id}, {"_id": 0})
    return {"user": user_public(User(**u3)), "xp": xp, "coins": coins, "new_badges": new_badges}


@router.post("/games/complete")
async def complete_game(body: GameCompleteIn, authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    xp_map = {"fraude": 30, "memorama": 25, "password": 20, "escape": 40}
    xp = xp_map.get(body.game_id, 15)
    coins = max(5, body.score * 2)
    await db.game_events.insert_one({
        "user_id": u.user_id,
        "game_id": body.game_id,
        "score": body.score,
        "total": body.total,
        "xp": xp,
        "coins": coins,
        "created_at": utcnow(),
    })
    await apply_xp_coins(u.user_id, xp, coins)
    if body.game_id == "fraude" and body.score >= max(4, body.total - 1):
        await db.users.update_one({"user_id": u.user_id}, {"$addToSet": {"badges": "detective"}})
    if body.game_id == "password" and body.score >= 5:
        await db.users.update_one({"user_id": u.user_id}, {"$addToSet": {"badges": "guardian"}})
    await maybe_unlock_badges(u.user_id)
    await credit_referral_if_first_activity(u.user_id)
    u3 = await db.users.find_one({"user_id": u.user_id}, {"_id": 0})
    return {"user": user_public(User(**u3)), "xp": xp, "coins": coins}


@router.post("/daily/claim")
async def daily_claim(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    today = utcnow().date().isoformat()
    if u.daily_claim_date == today:
        raise HTTPException(400, "Ya reclamaste el cofre de hoy")
    await db.users.update_one(
        {"user_id": u.user_id},
        {"$set": {"daily_claim_date": today}},
    )
    await apply_xp_coins(u.user_id, 20, 15)
    u2 = await db.users.find_one({"user_id": u.user_id}, {"_id": 0})
    return {"user": user_public(User(**u2)), "xp": 20, "coins": 15}
