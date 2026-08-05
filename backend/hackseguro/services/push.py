"""Push notifications (Emergent-managed relay)."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import List, Optional

import httpx
from fastapi import HTTPException

from ..core.config import settings
from ..core.database import db
from ..models import utcnow

logger = logging.getLogger("hackseguro.push")

_client = httpx.AsyncClient(
    base_url=settings.PUSH_BASE_URL,
    headers={"X-Push-Key": settings.EMERGENT_PUSH_KEY},
    timeout=10.0,
)


async def register(user_id: str, platform: str, device_token: str) -> None:
    try:
        resp = await _client.post(
            "/api/v1/push/users/register",
            json={"user_id": user_id, "platform": platform, "device_token": device_token},
        )
    except Exception as e:
        logger.warning("register-push transport error: %s", e)
        raise HTTPException(502, "Push provider unreachable")
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()
    await db.users.update_one({"user_id": user_id}, {"$set": {"push_platform": platform}})


async def send(recipients: List[str], data: dict, idempotency_key: Optional[str] = None):
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


async def send_streak_reminders() -> dict:
    today = utcnow().date()
    cursor = db.users.find(
        {"streak": {"$gte": 1}, "push_platform": {"$exists": True}},
        {"_id": 0, "user_id": 1, "last_activity_at": 1, "streak": 1},
    )
    users = await cursor.to_list(length=5000)
    to_notify = []
    for u in users:
        la = u.get("last_activity_at")
        if isinstance(la, datetime) and la.astimezone(timezone.utc).date() == today:
            continue
        to_notify.append(u["user_id"])

    sent = 0
    for i in range(0, len(to_notify), 100):
        chunk = to_notify[i:i + 100]
        try:
            await send(
                recipients=chunk,
                data={
                    "title": "¡Tu racha te espera! 🔥",
                    "message": "Practica 5 minutos hoy para no perder tu racha en Hack-Seguro.",
                    "action_url": "/(tabs)/",
                },
                idempotency_key=f"streak-{today.isoformat()}-{i}",
            )
            sent += len(chunk)
        except Exception as e:
            logger.warning("push chunk failed: %s", e)
    return {"scheduled": len(to_notify), "sent": sent, "date": today.isoformat()}
