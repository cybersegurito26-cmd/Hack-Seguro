"""Auth: Emergent Google OAuth exchange + session management."""
from __future__ import annotations

import uuid
import logging
from datetime import timedelta
from typing import Optional

import httpx
from fastapi import APIRouter, Header, HTTPException

from ..core.database import db
from ..dependencies import current_user
from ..models import SessionExchange, User, user_public, utcnow

router = APIRouter()
logger = logging.getLogger("hackseguro.auth")

_seen_session_ids: set[str] = set()


@router.post("/auth/session")
async def auth_session(body: SessionExchange):
    if not body.session_id or body.session_id in _seen_session_ids:
        raise HTTPException(status_code=401, detail="session_id already used or empty")
    _seen_session_ids.add(body.session_id)

    async with httpx.AsyncClient(timeout=15) as http:
        r = await http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": body.session_id},
        )
    if r.status_code != 200:
        raise HTTPException(status_code=401, detail="Invalid session_id")
    data = r.json()

    email = data["email"].lower()
    name = data.get("name") or email.split("@")[0]
    picture = data.get("picture")
    session_token = data["session_token"]

    existing = await db.users.find_one({"email": email}, {"_id": 0})
    if existing:
        user_id = existing["user_id"]
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = User(user_id=user_id, email=email, name=name, picture=picture)
        await db.users.insert_one(new_user.dict())

    await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})
    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": utcnow(),
        "expires_at": utcnow() + timedelta(days=7),
    })

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user_public(User(**user))}


@router.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    return {"user": user_public(u)}


@router.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}
