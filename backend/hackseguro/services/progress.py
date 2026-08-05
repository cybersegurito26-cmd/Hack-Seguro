"""Gamification, referrals & badge unlocking service."""
from __future__ import annotations

import logging
from datetime import timedelta, timezone
from typing import List

from fastapi import HTTPException

from ..core.config import settings
from ..core.database import db
from ..models import User, utcnow

logger = logging.getLogger("hackseguro.progress")


def iso_week_start(dt=None):
    d = (dt or utcnow()).astimezone(timezone.utc)
    monday = d - timedelta(days=d.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


async def apply_xp_coins(user_id: str, xp: int, coins: int) -> User:
    week_start = iso_week_start()
    u_before = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u_before:
        raise HTTPException(404, "User not found")

    new_xp = u_before["xp"] + xp
    new_level = max(1, (new_xp // settings.XP_PER_LEVEL) + 1)
    new_coins = u_before["coins"] + coins

    last = u_before.get("last_activity_at")
    last_date = last.astimezone(timezone.utc).date() if hasattr(last, "astimezone") else None
    today_date = utcnow().date()
    if last_date == today_date:
        new_streak = u_before.get("streak", 0)
    elif last_date == today_date - timedelta(days=1):
        new_streak = u_before.get("streak", 0) + 1
    else:
        new_streak = 1

    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "xp": new_xp, "level": new_level, "coins": new_coins,
            "streak": new_streak, "last_activity_at": utcnow(),
        }},
    )

    if u_before.get("school_code") and xp > 0:
        await db.weekly_scores.update_one(
            {"user_id": user_id, "week_start": week_start},
            {
                "$inc": {"xp": xp},
                "$setOnInsert": {
                    "school_code": u_before["school_code"],
                    "name": u_before["name"],
                    "picture": u_before.get("picture"),
                    "grade": u_before.get("grade"),
                    "group": u_before.get("group"),
                    "created_at": utcnow(),
                },
            },
            upsert=True,
        )

    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return User(**u)


async def maybe_unlock_badges(user_id: str) -> List[str]:
    u = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u:
        return []
    unlocked = set(u.get("badges", []))
    completed: dict = u.get("completed_lessons", {})

    new_badges = []
    if completed.get("passwords", 0) >= 1 and "guardian" not in unlocked:
        new_badges.append("guardian")
    if completed.get("phishing", 0) >= 1 and "phishcazador" not in unlocked:
        new_badges.append("phishcazador")
    if sum(1 for v in completed.values() if v >= 1) >= 3 and "escudo" not in unlocked:
        new_badges.append("escudo")
    if all(completed.get(m, 0) >= 1 for m in settings.MODULE_IDS) and "maestro" not in unlocked:
        new_badges.append("maestro")
    if u.get("streak", 0) >= 7 and "racha7" not in unlocked:
        new_badges.append("racha7")

    # Ambassador badges
    invited_valid = u.get("invited_valid_count", 0)
    if invited_valid >= 3 and "embajador" not in unlocked:
        new_badges.append("embajador")
    if invited_valid >= 10 and "embajador_oro" not in unlocked:
        new_badges.append("embajador_oro")

    if new_badges:
        await db.users.update_one(
            {"user_id": user_id},
            {"$addToSet": {"badges": {"$each": new_badges}}},
        )
    return new_badges


async def credit_referral_if_first_activity(user_id: str) -> None:
    """When an invitee completes their FIRST activity (lesson or game),
    increment inviter's invited_valid_count, award XP to inviter, and mark it."""
    invitee = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "invited_by_user_id": 1, "referral_credited": 1},
    )
    if not invitee:
        return
    inviter_id = invitee.get("invited_by_user_id")
    if not inviter_id or invitee.get("referral_credited"):
        return

    # Mark invitee first
    await db.users.update_one({"user_id": user_id}, {"$set": {"referral_credited": True}})

    # Update inviter: bump valid count + XP + persist analytics
    await db.users.update_one(
        {"user_id": inviter_id},
        {"$inc": {"invited_valid_count": 1}},
    )
    await db.referrals.update_one(
        {"invitee_user_id": user_id},
        {"$set": {"credited_at": utcnow()}},
    )
    await apply_xp_coins(inviter_id, settings.REFERRAL_XP_REWARD, 0)
    await maybe_unlock_badges(inviter_id)
    logger.info("Referral credited: inviter=%s invitee=%s", inviter_id, user_id)


async def register_referral(invitee_user_id: str, inviter_user_id: str, source: str | None) -> bool:
    """Attach an inviter to a NEW invitee at signup / join-school time.
    Returns True if registered. False if invalid (self-ref, already invited, unknown inviter).
    """
    if not inviter_user_id or inviter_user_id == invitee_user_id:
        return False
    inviter = await db.users.find_one({"user_id": inviter_user_id}, {"_id": 0, "user_id": 1})
    if not inviter:
        return False
    invitee = await db.users.find_one({"user_id": invitee_user_id}, {"_id": 0, "invited_by_user_id": 1, "created_at": 1})
    if not invitee or invitee.get("invited_by_user_id"):
        return False
    # Only credit invites for accounts younger than 30 days (anti-abuse against re-inviting old accounts)
    created_at = invitee.get("created_at")
    if created_at is not None and hasattr(created_at, "astimezone"):
        age_days = (utcnow() - created_at.astimezone(timezone.utc)).days
        if age_days > 30:
            return False

    await db.users.update_one(
        {"user_id": invitee_user_id},
        {"$set": {"invited_by_user_id": inviter_user_id, "referral_source": source or "link"}},
    )
    await db.users.update_one(
        {"user_id": inviter_user_id},
        {"$inc": {"invited_count": 1}},
    )
    await db.referrals.insert_one({
        "invitee_user_id": invitee_user_id,
        "inviter_user_id": inviter_user_id,
        "source": source or "link",
        "created_at": utcnow(),
    })
    logger.info("Referral registered: inviter=%s invitee=%s source=%s", inviter_user_id, invitee_user_id, source)
    return True
