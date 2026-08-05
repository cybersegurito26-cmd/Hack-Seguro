"""Central configuration for Hack-Seguro backend.

Reads environment variables once at import time so that the rest of the app
never touches `os.environ` directly. Missing critical values fail fast.
"""
from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(BACKEND_DIR / ".env")


class Settings:
    # Storage
    MONGO_URL: str = os.environ["MONGO_URL"]
    DB_NAME: str = os.environ.get("DB_NAME", "hackseguro")

    # Integrations
    EMERGENT_LLM_KEY: str = os.environ.get("EMERGENT_LLM_KEY", "")
    EMERGENT_PUSH_KEY: str = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
    PUSH_BASE_URL: str = "https://integrations.emergentagent.com"

    # Public host used to build QR / share URLs
    PUBLIC_BASE_URL: str = os.environ.get(
        "PUBLIC_BASE_URL",
        "https://ciber-educativo.preview.emergentagent.com",
    )

    # Gamification tunables
    XP_PER_LEVEL: int = 100
    REFERRAL_XP_REWARD: int = 15  # awarded to inviter when invitee completes 1st activity

    # Streak reminder schedule (18:00 CDMX = 00:00 UTC)
    STREAK_REMINDER_HOUR_UTC: int = 0
    STREAK_REMINDER_MINUTE_UTC: int = 0

    # Module identifiers (source of truth for validation)
    MODULE_IDS: list[str] = [
        "passwords", "phishing", "whatsapp", "redes", "videojuegos",
        "bancos", "compras", "privacidad", "ia", "ciberacoso",
    ]

    MODULE_TITLES: dict[str, str] = {
        "passwords": "Contraseñas seguras",
        "phishing": "Phishing",
        "whatsapp": "WhatsApp seguro",
        "redes": "Redes sociales",
        "videojuegos": "Videojuegos seguros",
        "bancos": "Fraudes bancarios",
        "compras": "Compras en línea",
        "privacidad": "Privacidad digital",
        "ia": "Inteligencia Artificial segura",
        "ciberacoso": "Ciberacoso y denuncia",
    }


settings = Settings()

CIBERBOT_SYSTEM_PROMPT = (
    "Eres CiberBot, el asistente educativo de la app Hack-Seguro. "
    "Hablas en español mexicano, cálido y motivador. "
    "Tu misión es enseñar a NIÑOS, ADOLESCENTES, PADRES y ADULTOS MAYORES de México "
    "a prevenir ciberdelitos (phishing, fraudes bancarios, ciberacoso, robo de identidad, "
    "estafas de paquetería, becas falsas y suplantación en WhatsApp). "
    "REGLAS OBLIGATORIAS:\n"
    "1) NUNCA pidas datos personales (nombre, dirección, CURP, RFC, NIP, tarjetas, contraseñas, ubicación).\n"
    "2) Si el usuario ofrece datos sensibles, pídele con amabilidad que NO los comparta.\n"
    "3) Da consejos preventivos, pasos concretos y ejemplos mexicanos reales.\n"
    "4) Menciona 088 (Policía Cibernética) y CONDUSEF cuando aplique a denuncias/bancos.\n"
    "5) Respuestas breves y claras (máx. 6 líneas), con emojis suaves si ayudan.\n"
    "6) Si detectas una emergencia (violencia, extorsión, grooming) recomienda hablar con un adulto de confianza y llamar al 088 o 911.\n"
    "7) No inventes datos ni URLs. Si dudas, dile al usuario que verifique con la fuente oficial."
)
