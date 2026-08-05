"""Chatbot router (Claude Sonnet 4.6)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Header

from ..core.database import db
from ..dependencies import current_user
from ..models import ChatIn, utcnow
from ..services.chatbot import chat_reply

router = APIRouter()


@router.post("/chatbot")
async def chatbot(body: ChatIn, authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    session_id = f"{u.user_id}:{body.session_id}"
    await db.chat_messages.insert_one({
        "user_id": u.user_id, "session_id": session_id,
        "role": "user", "text": body.message, "created_at": utcnow(),
    })
    reply_text = await chat_reply(u.user_id, body.session_id, body.message)
    await db.chat_messages.insert_one({
        "user_id": u.user_id, "session_id": session_id,
        "role": "assistant", "text": reply_text, "created_at": utcnow(),
    })
    return {"reply": reply_text}


@router.get("/chatbot/history")
async def chat_history(session_id: str, authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    scoped = f"{u.user_id}:{session_id}"
    cur = db.chat_messages.find(
        {"user_id": u.user_id, "session_id": scoped},
        {"_id": 0},
    ).sort("created_at", 1).limit(200)
    msgs = await cur.to_list(length=200)
    for m in msgs:
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()
    return {"messages": msgs}
