"""CiberBot chat service (Claude Sonnet 4.6 via emergentintegrations)."""
from __future__ import annotations

import logging

from fastapi import HTTPException

from ..core.config import settings, CIBERBOT_SYSTEM_PROMPT
from emergentintegrations.llm.chat import LlmChat, UserMessage

logger = logging.getLogger("hackseguro.chatbot")


async def chat_reply(user_id: str, session_id: str, message: str) -> str:
    if not settings.EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY no configurado")
    scoped = f"{user_id}:{session_id}"
    chat = LlmChat(
        api_key=settings.EMERGENT_LLM_KEY,
        session_id=scoped,
        system_message=CIBERBOT_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-6")
    try:
        reply = await chat.send_message(UserMessage(text=message))
    except Exception as exc:
        logger.exception("Claude call failed: %s", exc)
        raise HTTPException(502, "El asistente no está disponible en este momento")
    return str(reply).strip() if reply else "Lo siento, no pude generar respuesta."
