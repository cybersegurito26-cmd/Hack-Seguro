"""Hack-Seguro FastAPI backend.

Endpoints (all under /api):
  Auth:
    POST /auth/session         Exchange Emergent session_id for session_token
    GET  /auth/me              Get current authenticated user
    POST /auth/logout          Invalidate session
  Schools:
    POST /schools/join         Join school by code
    GET  /schools/mine         Info about current user's school
  Progress:
    GET  /progress             Full progress snapshot
    POST /lessons/complete     Record lesson completion
    POST /games/complete       Record game completion
    POST /daily/claim          Claim daily chest
  Leaderboards:
    GET  /leaderboards/weekly  School weekly Top 10
  Certificates:
    GET  /certificates/{module_id}   Generate & download PDF certificate
  Chatbot:
    POST /chatbot              Multi-turn Claude Sonnet 4.6
  Teacher:
    GET  /teacher/roster       Class roster grouped by grade/group
"""
from __future__ import annotations

import os
import io
import uuid
import logging
from pathlib import Path
from datetime import datetime, timedelta, timezone
from typing import Optional, List

import bcrypt
import httpx
import qrcode
from PIL import Image, ImageDraw, ImageFont
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse, HTMLResponse, Response
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, EmailStr, Field

from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm
from reportlab.lib.utils import ImageReader

from emergentintegrations.llm.chat import LlmChat, UserMessage

# -------------------------------------------------------------------
# Setup
# -------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "hackseguro")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")
EMERGENT_PUSH_KEY = os.environ.get("EMERGENT_PUSH_KEY", "placeholder")
PUSH_BASE_URL = "https://integrations.emergentagent.com"
EMAIL_BASE_URL = "https://integrations.emergentagent.com"
EMERGENT_EMAIL_KEY = os.environ.get("EMERGENT_EMAIL_KEY", "placeholder")
EMAIL_FROM_NAME = os.environ.get("EMAIL_FROM_NAME", "Hack-Seguro")
PUBLIC_BASE_URL = os.environ.get("PUBLIC_BASE_URL") or "https://ciber-educativo.preview.emergentagent.com"

client = AsyncIOMotorClient(MONGO_URL)
db = client[DB_NAME]

app = FastAPI(title="Hack-Seguro API")
api = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("hackseguro")

# -------------------------------------------------------------------
# Constants
# -------------------------------------------------------------------
XP_PER_LEVEL = 100
MODULE_IDS = [
    "passwords", "phishing", "whatsapp", "redes", "videojuegos",
    "bancos", "compras", "privacidad", "ia", "ciberacoso",
]

CIBERBOT_SYSTEM_PROMPT = (
    "Eres Hack-Bot, el asistente educativo de la app Hack-Seguro. "
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

# -------------------------------------------------------------------
# Models
# -------------------------------------------------------------------
def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def _iso_week_start(dt: Optional[datetime] = None) -> datetime:
    """Return the Monday 00:00 UTC of the week containing `dt` (default: now)."""
    d = (dt or utcnow()).astimezone(timezone.utc)
    monday = d - timedelta(days=d.weekday())
    return monday.replace(hour=0, minute=0, second=0, microsecond=0)


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "student"  # student | parent | teacher
    school_code: Optional[str] = None
    grade: Optional[str] = None   # e.g. "6°"
    group: Optional[str] = None   # e.g. "A"
    xp: int = 0
    coins: int = 25
    level: int = 1
    hearts: int = 5
    streak: int = 0
    last_activity_at: Optional[datetime] = None
    first_activity_at: Optional[datetime] = None
    daily_claim_date: Optional[str] = None  # YYYY-MM-DD
    completed_lessons: dict = Field(default_factory=dict)  # module_id -> count
    badges: List[str] = Field(default_factory=list)
    invited_by_user_id: Optional[str] = None
    referrals_valid: int = 0
    referrals_pending: int = 0
    referral_counted: bool = False  # True once this user has been counted for their inviter
    created_at: datetime = Field(default_factory=utcnow)


class SessionExchange(BaseModel):
    session_id: str
    ref: Optional[str] = None  # inviter user_id from ambassador link


class JoinSchoolIn(BaseModel):
    school_code: str
    role: Optional[str] = "student"
    grade: Optional[str] = None
    group: Optional[str] = None


class LessonCompleteIn(BaseModel):
    module_id: str
    correct: int
    total: int


class GameCompleteIn(BaseModel):
    game_id: str  # "fraude" | "memorama" | "password" | "escape"
    score: int
    total: int


class ChatIn(BaseModel):
    session_id: str
    message: str


# -------------------------------------------------------------------
# DB setup
# -------------------------------------------------------------------
@app.on_event("startup")
async def on_startup():
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
    await db.otp_codes.create_index("expires_at", expireAfterSeconds=0)
    await db.otp_codes.create_index([("email", 1), ("created_at", -1)])
    await db.referral_events.create_index([("inviter_id", 1), ("created_at", -1)])
    await db.referral_events.create_index("invitee_id")
    # Seed a few sample schools for the demo
    seeds = [
        {"code": "COL-LEON-001", "name": "Colegio de León", "city": "León", "state": "Guanajuato"},
        {"code": "SEC-CDMX-042", "name": "Secundaria CDMX 042", "city": "Ciudad de México", "state": "CDMX"},
        {"code": "PRIM-GDL-101", "name": "Primaria Guadalajara 101", "city": "Guadalajara", "state": "Jalisco"},
        {"code": "DEMO-001", "name": "Escuela Demo Hack-Seguro", "city": "Demo", "state": "MX"},
    ]
    for s in seeds:
        await db.schools.update_one({"code": s["code"]}, {"$setOnInsert": s}, upsert=True)
    logger.info("Hack-Seguro DB indexes ensured. DB_NAME=%s", DB_NAME)


@app.on_event("shutdown")
async def on_shutdown():
    client.close()


# -------------------------------------------------------------------
# Auth helpers
# -------------------------------------------------------------------
async def current_user(authorization: Optional[str] = Header(None)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.split(" ", 1)[1].strip()
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    expires_at = session["expires_at"]
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < utcnow():
        raise HTTPException(status_code=401, detail="Session expired")
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return User(**user)


def user_public(u: User) -> dict:
    return {
        "user_id": u.user_id,
        "email": u.email,
        "name": u.name,
        "picture": u.picture,
        "role": u.role,
        "school_code": u.school_code,
        "grade": u.grade,
        "group": u.group,
        "xp": u.xp,
        "coins": u.coins,
        "level": u.level,
        "hearts": u.hearts,
        "streak": u.streak,
        "daily_claim_date": u.daily_claim_date,
        "completed_lessons": u.completed_lessons,
        "badges": u.badges,
        "referrals_valid": u.referrals_valid,
        "referrals_pending": u.referrals_pending,
        "invited_by_user_id": u.invited_by_user_id,
    }


# -------------------------------------------------------------------
# Auth endpoints
# -------------------------------------------------------------------
_seen_session_ids: set[str] = set()


# ---- Email helper (Emergent Resend proxy) ----------------------------------
async def _send_email_html(recipient: str, subject: str, html: str) -> None:
    if EMERGENT_EMAIL_KEY == "placeholder":
        logger.warning("EMERGENT_EMAIL_KEY is placeholder — email skipped for %s", recipient)
        return
    payload = {
        "to": [recipient],
        "subject": subject,
        "html": html,
        "from_name": EMAIL_FROM_NAME,
    }
    try:
        async with httpx.AsyncClient(timeout=15) as http:
            r = await http.post(
                f"{EMAIL_BASE_URL}/api/v1/email/send",
                headers={"X-Email-Key": EMERGENT_EMAIL_KEY},
                json=payload,
            )
        r.raise_for_status()
    except Exception as exc:
        logger.exception("email send failed: %s", exc)
        raise HTTPException(502, "No se pudo enviar el correo")


def _hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt(rounds=12)).decode("utf-8")


def _check_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


async def _issue_session(user_id: str) -> str:
    token = f"hs_{uuid.uuid4().hex}{uuid.uuid4().hex}"
    await db.user_sessions.insert_one({
        "session_token": token,
        "user_id": user_id,
        "created_at": utcnow(),
        "expires_at": utcnow() + timedelta(days=7),
    })
    return token


# ---- Ambassadors / Referrals -----------------------------------------------
async def _attach_inviter(user_id: str, ref: Optional[str]) -> None:
    """If `ref` points to a real user that's different from user_id, set
    invited_by_user_id on the invitee (only if not already set) and bump the
    inviter's pending counter. No-op otherwise. Safe to call multiple times."""
    if not ref:
        return
    ref = ref.strip()
    if not ref or ref == user_id:
        return
    inviter = await db.users.find_one({"user_id": ref}, {"_id": 0, "user_id": 1})
    if not inviter:
        return
    invitee = await db.users.find_one({"user_id": user_id}, {"_id": 0, "invited_by_user_id": 1})
    if not invitee:
        return
    if invitee.get("invited_by_user_id"):
        return  # already set — do not overwrite
    await db.users.update_one(
        {"user_id": user_id, "invited_by_user_id": {"$in": [None, ""]}},
        {"$set": {"invited_by_user_id": ref}},
    )
    # Only bump pending if we actually stored the inviter
    updated = await db.users.find_one({"user_id": user_id}, {"_id": 0, "invited_by_user_id": 1})
    if updated and updated.get("invited_by_user_id") == ref:
        await db.users.update_one({"user_id": ref}, {"$inc": {"referrals_pending": 1}})
        await db.referral_events.insert_one({
            "inviter_id": ref,
            "invitee_id": user_id,
            "status": "pending",
            "created_at": utcnow(),
        })
        logger.info("referral pending: inviter=%s invitee=%s", ref, user_id)


async def _maybe_confirm_referral(user_id: str) -> None:
    """Called after a successful lesson/game completion. If this user hasn't been
    counted yet AND has an inviter, promote referral to `valid`, increment the
    inviter's counter and unlock ambassador badges when thresholds are met."""
    user = await db.users.find_one(
        {"user_id": user_id},
        {"_id": 0, "invited_by_user_id": 1, "referral_counted": 1},
    )
    if not user:
        return
    if user.get("referral_counted"):
        return
    inviter_id = user.get("invited_by_user_id")
    if not inviter_id:
        return
    # Mark this invitee as counted (atomic guard)
    res = await db.users.update_one(
        {"user_id": user_id, "referral_counted": {"$ne": True}},
        {"$set": {"referral_counted": True, "first_activity_at": utcnow()}},
    )
    if res.modified_count == 0:
        return
    # Update inviter counters and badges
    inv_before = await db.users.find_one({"user_id": inviter_id}, {"_id": 0, "referrals_valid": 1, "badges": 1})
    if not inv_before:
        return
    new_valid = int(inv_before.get("referrals_valid", 0)) + 1
    new_badges = set(inv_before.get("badges") or [])
    unlocked_now: List[str] = []
    if new_valid >= 3 and "embajador_digital" not in new_badges:
        new_badges.add("embajador_digital")
        unlocked_now.append("embajador_digital")
    if new_valid >= 10 and "embajador_oro" not in new_badges:
        new_badges.add("embajador_oro")
        unlocked_now.append("embajador_oro")
    update: dict = {
        "$set": {"referrals_valid": new_valid},
        "$inc": {"referrals_pending": -1},
    }
    if unlocked_now:
        update["$addToSet"] = {"badges": {"$each": unlocked_now}}
    await db.users.update_one({"user_id": inviter_id}, update)
    await db.referral_events.update_one(
        {"inviter_id": inviter_id, "invitee_id": user_id},
        {"$set": {"status": "valid", "confirmed_at": utcnow()}},
        upsert=True,
    )
    logger.info(
        "referral confirmed: inviter=%s invitee=%s total=%d new_badges=%s",
        inviter_id, user_id, new_valid, unlocked_now,
    )


# ---- Email + password models -----------------------------------------------
ALLOWED_ROLES = {"student", "teenager", "parent", "teacher"}


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=60)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    role: Optional[str] = "student"
    ref: Optional[str] = None  # inviter user_id from ambassador link


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=4, max_length=8)
    new_password: str = Field(min_length=8, max_length=128)


# ---- Auth endpoints --------------------------------------------------------
@api.post("/auth/register")
async def auth_register(body: RegisterIn):
    email = body.email.lower().strip()
    name = body.name.strip()[:60]
    if not name:
        raise HTTPException(422, "El nombre no puede estar vacío")
    role = (body.role or "student").lower()
    if role not in ALLOWED_ROLES:
        raise HTTPException(422, "Rol inválido")
    existing = await db.users.find_one({"email": email}, {"_id": 0, "password_hash": 1, "user_id": 1})
    if existing and existing.get("password_hash"):
        raise HTTPException(409, "Ya existe una cuenta con este correo")
    if existing:
        user_id = existing.get("user_id")
    else:
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        new_user = User(user_id=user_id, email=email, name=name, role=role)
        await db.users.insert_one(new_user.dict())
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {
            "name": name,
            "role": role,
            "password_hash": _hash_password(body.password),
            "auth_provider": "email",
        }},
    )
    # Attach ambassador inviter (safe no-op if invalid)
    await _attach_inviter(user_id, body.ref)
    token = await _issue_session(user_id)
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    logger.info("auth/register success email=%s user_id=%s role=%s", email, user_id, role)
    return {"session_token": token, "user": user_public(User(**user))}


@api.post("/auth/login")
async def auth_login(body: LoginIn):
    email = body.email.lower().strip()
    u = await db.users.find_one({"email": email}, {"_id": 0})
    if not u or not u.get("password_hash"):
        raise HTTPException(401, "Correo o contraseña incorrectos")
    if not _check_password(body.password, u["password_hash"]):
        raise HTTPException(401, "Correo o contraseña incorrectos")
    token = await _issue_session(u["user_id"])
    return {"session_token": token, "user": user_public(User(**u))}


@api.post("/auth/forgot-password")
async def auth_forgot(body: ForgotIn, request: Request):
    email = body.email.lower().strip()
    # Rate limit: max 3 codes per 15 min per email
    since = utcnow() - timedelta(minutes=15)
    recent = await db.otp_codes.count_documents({"email": email, "created_at": {"$gte": since}})
    if recent >= 3:
        raise HTTPException(429, "Demasiados intentos. Prueba en 15 minutos.")
    u = await db.users.find_one({"email": email}, {"_id": 0, "name": 1})
    # Respond OK regardless of whether the user exists (avoid email enumeration)
    if u:
        import random
        code = f"{random.randint(0, 999999):06d}"
        await db.otp_codes.insert_one({
            "email": email,
            "code_hash": _hash_password(code),
            "used": False,
            "created_at": utcnow(),
            "expires_at": utcnow() + timedelta(minutes=10),
        })
        try:
            await _send_email_html(
                recipient=email,
                subject="Tu código de Hack-Seguro",
                html=(
                    f"<div style=\"font-family:sans-serif;background:#00357a;color:#fff;padding:32px;text-align:center\">"
                    f"<h1 style=\"color:#d0e80b;margin:0\">Hack-Seguro</h1>"
                    f"<p>Hola {u.get('name', 'explorador')}, tu código para restablecer tu contraseña es:</p>"
                    f"<div style=\"background:#fff;color:#00357a;font-size:42px;font-weight:800;letter-spacing:8px;padding:20px;border-radius:16px;margin:24px auto;max-width:280px\">{code}</div>"
                    f"<p style=\"opacity:0.85\">Este código caduca en 10 minutos. Si no lo pediste, ignora este correo.</p>"
                    f"</div>"
                ),
            )
        except HTTPException:
            # If email fails and key is real, surface it. If placeholder, we already logged.
            pass
    return {"ok": True, "sent_to": email}


@api.post("/auth/reset-password")
async def auth_reset(body: ResetIn):
    email = body.email.lower().strip()
    cursor = db.otp_codes.find(
        {"email": email, "used": False, "expires_at": {"$gte": utcnow()}}
    ).sort("created_at", -1).limit(5)
    candidates = await cursor.to_list(length=5)
    matched = None
    for row in candidates:
        if _check_password(body.code, row["code_hash"]):
            matched = row
            break
    if not matched:
        raise HTTPException(400, "Código inválido o expirado")
    await db.otp_codes.update_one({"_id": matched["_id"]}, {"$set": {"used": True, "used_at": utcnow()}})
    u = await db.users.find_one({"email": email}, {"_id": 0, "user_id": 1})
    if not u:
        raise HTTPException(404, "Cuenta no encontrada")
    await db.users.update_one(
        {"user_id": u["user_id"]},
        {"$set": {"password_hash": _hash_password(body.new_password), "auth_provider": "email"}},
    )
    # Invalidate old sessions
    await db.user_sessions.delete_many({"user_id": u["user_id"]})
    token = await _issue_session(u["user_id"])
    user = await db.users.find_one({"user_id": u["user_id"]}, {"_id": 0})
    return {"session_token": token, "user": user_public(User(**user))}


@api.post("/auth/session")
async def auth_session(body: SessionExchange):
    """Exchange a fresh Emergent session_id for our own session_token."""
    if not body.session_id or body.session_id in _seen_session_ids:
        # Prevent double-exchange; still, we return 401 to keep flow secure.
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

    # Refresh basic info in case name/picture changed
    await db.users.update_one({"user_id": user_id}, {"$set": {"name": name, "picture": picture}})

    # Attach ambassador inviter (safe no-op if invalid or already invited)
    await _attach_inviter(user_id, body.ref)

    await db.user_sessions.insert_one({
        "session_token": session_token,
        "user_id": user_id,
        "created_at": utcnow(),
        "expires_at": utcnow() + timedelta(days=7),
    })

    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"session_token": session_token, "user": user_public(User(**user))}


@api.get("/auth/me")
async def auth_me(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    return {"user": user_public(u)}


@api.post("/auth/logout")
async def auth_logout(authorization: Optional[str] = Header(None)):
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
        await db.user_sessions.delete_one({"session_token": token})
    return {"ok": True}


# -------------------------------------------------------------------
# Schools
# -------------------------------------------------------------------
@api.get("/schools/mine")
async def my_school(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    if not u.school_code:
        return {"school": None}
    s = await db.schools.find_one({"code": u.school_code}, {"_id": 0})
    return {"school": s}


@api.get("/schools/{code}")
async def school_by_code(code: str):
    s = await db.schools.find_one({"code": code.upper()}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Escuela no encontrada")
    return s


@api.post("/schools/join")
async def join_school(body: JoinSchoolIn, authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    code = body.school_code.upper().strip()
    school = await db.schools.find_one({"code": code}, {"_id": 0})
    if not school:
        raise HTTPException(status_code=404, detail="Código de escuela no encontrado. Prueba con DEMO-001.")

    update = {
        "school_code": code,
        "role": body.role or u.role or "student",
    }
    if body.grade:
        update["grade"] = body.grade
    if body.group:
        update["group"] = body.group

    await db.users.update_one({"user_id": u.user_id}, {"$set": update})
    user = await db.users.find_one({"user_id": u.user_id}, {"_id": 0})
    return {"user": user_public(User(**user)), "school": school}


# -------------------------------------------------------------------
# Progress + gamification helpers
# -------------------------------------------------------------------
async def _apply_xp_coins(user_id: str, xp: int, coins: int) -> User:
    week_start = _iso_week_start()
    # user counters
    u_before = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not u_before:
        raise HTTPException(404, "User not found")

    new_xp = u_before["xp"] + xp
    new_level = max(1, (new_xp // XP_PER_LEVEL) + 1)
    new_coins = u_before["coins"] + coins

    # streak
    today = utcnow().date().isoformat()
    last = u_before.get("last_activity_at")
    if isinstance(last, datetime):
        last_date = last.astimezone(timezone.utc).date()
    else:
        last_date = None
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
            "xp": new_xp,
            "level": new_level,
            "coins": new_coins,
            "streak": new_streak,
            "last_activity_at": utcnow(),
        }},
    )

    # weekly leaderboard
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


async def _maybe_unlock_badges(user_id: str) -> List[str]:
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
    if all(completed.get(m, 0) >= 1 for m in MODULE_IDS) and "maestro" not in unlocked:
        new_badges.append("maestro")
    if u.get("streak", 0) >= 7 and "racha7" not in unlocked:
        new_badges.append("racha7")
    if new_badges:
        await db.users.update_one(
            {"user_id": user_id},
            {"$addToSet": {"badges": {"$each": new_badges}}},
        )
    return new_badges


@api.get("/progress")
async def get_progress(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    return {"user": user_public(u)}


@api.post("/lessons/complete")
async def complete_lesson(body: LessonCompleteIn, authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    if body.module_id not in MODULE_IDS:
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
    u2 = await _apply_xp_coins(u.user_id, xp, coins)
    new_badges = await _maybe_unlock_badges(u.user_id)
    # Ambassador: confirm the invite if this is the invitee's first activity
    await _maybe_confirm_referral(u.user_id)
    u3 = await db.users.find_one({"user_id": u.user_id}, {"_id": 0})
    return {"user": user_public(User(**u3)), "xp": xp, "coins": coins, "new_badges": new_badges}


@api.post("/games/complete")
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
    u2 = await _apply_xp_coins(u.user_id, xp, coins)
    # Badges
    if body.game_id == "fraude" and body.score >= max(4, body.total - 1):
        await db.users.update_one({"user_id": u.user_id}, {"$addToSet": {"badges": "detective"}})
    if body.game_id == "password" and body.score >= 5:
        await db.users.update_one({"user_id": u.user_id}, {"$addToSet": {"badges": "guardian"}})
    # Ambassador: confirm the invite if this is the invitee's first activity
    await _maybe_confirm_referral(u.user_id)
    u3 = await db.users.find_one({"user_id": u.user_id}, {"_id": 0})
    return {"user": user_public(User(**u3)), "xp": xp, "coins": coins}


@api.post("/daily/claim")
async def daily_claim(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    today = utcnow().date().isoformat()
    if u.daily_claim_date == today:
        raise HTTPException(400, "Ya reclamaste el cofre de hoy")
    await db.users.update_one(
        {"user_id": u.user_id},
        {"$set": {"daily_claim_date": today}},
    )
    await _apply_xp_coins(u.user_id, 20, 15)
    u2 = await db.users.find_one({"user_id": u.user_id}, {"_id": 0})
    return {"user": user_public(User(**u2)), "xp": 20, "coins": 15}


# -------------------------------------------------------------------
# Leaderboards (school | global | city | state)
# -------------------------------------------------------------------
async def _schools_in_scope(scope: str, ref_school_code: Optional[str]) -> Optional[List[str]]:
    """Return list of school_codes matching the scope; None means no filter (global)."""
    if scope == "global":
        return None
    if not ref_school_code:
        return []
    my_school = await db.schools.find_one({"code": ref_school_code}, {"_id": 0})
    if not my_school:
        return []
    if scope == "school":
        return [ref_school_code]
    if scope == "city":
        cur = db.schools.find({"city": my_school.get("city")}, {"_id": 0, "code": 1})
        rows = await cur.to_list(length=1000)
        return [r["code"] for r in rows]
    if scope == "state":
        cur = db.schools.find({"state": my_school.get("state")}, {"_id": 0, "code": 1})
        rows = await cur.to_list(length=1000)
        return [r["code"] for r in rows]
    return []


@api.get("/leaderboards/weekly")
async def weekly_leaderboard(
    scope: str = "school",
    authorization: Optional[str] = Header(None),
):
    u = await current_user(authorization)
    if scope not in {"school", "global", "city", "state"}:
        raise HTTPException(400, "scope inválido")

    week_start = _iso_week_start()
    match: dict = {"week_start": week_start}
    codes = await _schools_in_scope(scope, u.school_code)
    if codes is not None:
        if not codes:
            return {"scope": scope, "school_code": u.school_code, "week_start": week_start.isoformat(), "top": [], "me": None}
        match["school_code"] = {"$in": codes}

    cur = db.weekly_scores.find(match, {"_id": 0}).sort("xp", -1).limit(10)
    top_rows = await cur.to_list(length=10)
    top = []
    for i, r in enumerate(top_rows, start=1):
        top.append({
            "rank": i,
            "user_id": r["user_id"],
            "name": r.get("name"),
            "picture": r.get("picture"),
            "grade": r.get("grade"),
            "group": r.get("group"),
            "school_code": r.get("school_code"),
            "xp": r.get("xp", 0),
        })

    me_row = await db.weekly_scores.find_one({"user_id": u.user_id, "week_start": week_start}, {"_id": 0})
    me = None
    if me_row:
        higher_match = {**match, "xp": {"$gt": me_row["xp"]}}
        higher = await db.weekly_scores.count_documents(higher_match)
        me = {"rank": higher + 1, "xp": me_row["xp"], "name": u.name}

    return {
        "scope": scope,
        "school_code": u.school_code,
        "week_start": week_start.isoformat(),
        "top": top,
        "me": me,
    }


# -------------------------------------------------------------------
# Certificates (PDF)
# -------------------------------------------------------------------
MODULE_TITLES = {
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


def _qr_png_bytes(url: str, size: int = 240) -> bytes:
    qr = qrcode.QRCode(border=1, box_size=8)
    qr.add_data(url)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#00357a", back_color="white").convert("RGB")
    img = img.resize((size, size))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


def _draw_certificate(name: str, module_title: str, cert_id: str, when: datetime) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(A4))
    W, H = landscape(A4)

    navy = HexColor("#00357a")
    lime = HexColor("#d0e80b")
    ink = HexColor("#0F172A")
    muted = HexColor("#475569")

    c.setFillColor(navy)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    c.setFillColor(HexColor("#FFFFFF"))
    c.roundRect(1.5 * cm, 1.5 * cm, W - 3 * cm, H - 3 * cm, 20, fill=1, stroke=0)

    c.setFillColor(lime)
    c.roundRect(1.5 * cm, H - 4.5 * cm, W - 3 * cm, 1.6 * cm, 10, fill=1, stroke=0)

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 26)
    c.drawCentredString(W / 2, H - 3.6 * cm, "HACK-SEGURO")

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 40)
    c.drawCentredString(W / 2, H - 6.5 * cm, "Certificado de participación")

    c.setFillColor(muted)
    c.setFont("Helvetica", 14)
    c.drawCentredString(W / 2, H - 8 * cm, "Otorgado a")

    c.setFillColor(ink)
    c.setFont("Helvetica-Bold", 32)
    c.drawCentredString(W / 2, H - 10 * cm, name)

    c.setFillColor(muted)
    c.setFont("Helvetica", 14)
    c.drawCentredString(W / 2, H - 11.4 * cm, "por completar exitosamente el módulo")

    c.setFillColor(navy)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(W / 2, H - 13 * cm, module_title)

    c.setFillColor(muted)
    c.setFont("Helvetica", 11)
    c.drawCentredString(W / 2, H - 15.5 * cm,
                        f"Emitido el {when.strftime('%d/%m/%Y')} · ID: {cert_id}")

    # QR code for verification
    verify_url = f"{PUBLIC_BASE_URL}/api/verify/{cert_id}"
    try:
        qr_png = _qr_png_bytes(verify_url, 220)
        qr_img = ImageReader(io.BytesIO(qr_png))
        c.drawImage(qr_img, W - 5.5 * cm, 1.8 * cm, width=3.5 * cm, height=3.5 * cm, mask="auto")
        c.setFillColor(muted)
        c.setFont("Helvetica", 8)
        c.drawRightString(W - 1.8 * cm, 1.6 * cm, "Escanea para verificar")
    except Exception:
        pass

    c.setFont("Helvetica-Oblique", 10)
    c.setFillColor(muted)
    c.drawString(2 * cm, 1.8 * cm, "App educativa Hack-Seguro · Prevención de ciberdelitos en México")

    c.showPage()
    c.save()
    return buf.getvalue()


@api.get("/certificates/{module_id}")
async def get_certificate(module_id: str, t: Optional[str] = None, authorization: Optional[str] = Header(None)):
    # Allow token via query param (for browser links) or Authorization header.
    auth = authorization or (f"Bearer {t}" if t else None)
    u = await current_user(auth)
    if module_id not in MODULE_IDS:
        raise HTTPException(404, "Módulo no encontrado")
    if (u.completed_lessons or {}).get(module_id, 0) < 1:
        raise HTTPException(400, "Aún no has completado este módulo")

    existing = await db.certificates.find_one({"user_id": u.user_id, "module_id": module_id}, {"_id": 0})
    if existing:
        cert_id = existing["cert_id"]
        when = existing["issued_at"]
        if isinstance(when, datetime) and when.tzinfo is None:
            when = when.replace(tzinfo=timezone.utc)
    else:
        cert_id = f"HS-{uuid.uuid4().hex[:8].upper()}"
        when = utcnow()
        await db.certificates.insert_one({
            "user_id": u.user_id,
            "module_id": module_id,
            "cert_id": cert_id,
            "issued_at": when,
        })

    pdf_bytes = _draw_certificate(u.name, MODULE_TITLES[module_id], cert_id, when)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="hackseguro-{module_id}.pdf"'},
    )


# -------------------------------------------------------------------
# Chatbot (Claude Sonnet 4.6)
# -------------------------------------------------------------------
@api.post("/chatbot")
async def chatbot(body: ChatIn, authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    session_id = f"{u.user_id}:{body.session_id}"

    # Store user message
    await db.chat_messages.insert_one({
        "user_id": u.user_id,
        "session_id": session_id,
        "role": "user",
        "text": body.message,
        "created_at": utcnow(),
    })

    if not EMERGENT_LLM_KEY:
        raise HTTPException(500, "EMERGENT_LLM_KEY no configurado")

    chat = LlmChat(
        api_key=EMERGENT_LLM_KEY,
        session_id=session_id,
        system_message=CIBERBOT_SYSTEM_PROMPT,
    ).with_model("anthropic", "claude-sonnet-4-6")

    try:
        reply = await chat.send_message(UserMessage(text=body.message))
    except Exception as exc:  # pragma: no cover
        logger.exception("Claude call failed: %s", exc)
        raise HTTPException(502, "El asistente no está disponible en este momento")

    reply_text = str(reply).strip() if reply else "Lo siento, no pude generar respuesta."

    await db.chat_messages.insert_one({
        "user_id": u.user_id,
        "session_id": session_id,
        "role": "assistant",
        "text": reply_text,
        "created_at": utcnow(),
    })

    return {"reply": reply_text}


@api.get("/chatbot/history")
async def chat_history(session_id: str, authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    scoped = f"{u.user_id}:{session_id}"
    cur = db.chat_messages.find({"user_id": u.user_id, "session_id": scoped}, {"_id": 0}).sort("created_at", 1).limit(200)
    msgs = await cur.to_list(length=200)
    for m in msgs:
        if isinstance(m.get("created_at"), datetime):
            m["created_at"] = m["created_at"].isoformat()
    return {"messages": msgs}


# -------------------------------------------------------------------
# Teacher panel
# -------------------------------------------------------------------
@api.get("/teacher/roster")
async def teacher_roster(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    if u.role not in {"teacher", "parent"}:
        raise HTTPException(403, "Solo docentes o padres pueden ver esta información")
    if not u.school_code:
        return {"school_code": None, "groups": []}

    cur = db.users.find(
        {"school_code": u.school_code, "role": "student"},
        {"_id": 0, "user_id": 1, "name": 1, "grade": 1, "group": 1, "xp": 1, "level": 1, "streak": 1, "badges": 1, "completed_lessons": 1},
    )
    students = await cur.to_list(length=500)

    groups: dict = {}
    for s in students:
        key = f"{s.get('grade') or '?'}-{s.get('group') or '?'}"
        groups.setdefault(key, []).append(s)
    grouped_list = [
        {"grade_group": k, "students": sorted(v, key=lambda x: -x.get("xp", 0))}
        for k, v in sorted(groups.items())
    ]
    return {"school_code": u.school_code, "groups": grouped_list}


# -------------------------------------------------------------------
# Certificate verification (public)
# -------------------------------------------------------------------
@api.get("/certificates/verify/{cert_id}")
async def verify_certificate_json(cert_id: str):
    cert = await db.certificates.find_one({"cert_id": cert_id}, {"_id": 0})
    if not cert:
        return {"valid": False, "cert_id": cert_id}
    u = await db.users.find_one({"user_id": cert["user_id"]}, {"_id": 0, "name": 1, "school_code": 1, "grade": 1, "group": 1})
    school = None
    if u and u.get("school_code"):
        school = await db.schools.find_one({"code": u["school_code"]}, {"_id": 0})
    issued = cert.get("issued_at")
    if isinstance(issued, datetime):
        issued = issued.isoformat()
    return {
        "valid": True,
        "cert_id": cert_id,
        "student_name": u.get("name") if u else None,
        "grade": u.get("grade") if u else None,
        "group": u.get("group") if u else None,
        "school": school,
        "module_id": cert["module_id"],
        "module_title": MODULE_TITLES.get(cert["module_id"], cert["module_id"]),
        "issued_at": issued,
    }


VERIFY_HTML_TEMPLATE = """<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Verificar certificado · Hack-Seguro</title>
<style>
  :root {{
    --navy: #00357a; --lime: #d0e80b; --ink: #0f172a;
    --muted: #475569; --surface: #f8fafc; --white: #ffffff;
    --success: #16a34a; --danger: #ef4444;
  }}
  * {{ box-sizing: border-box }}
  body {{
    margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    background: var(--navy); color: var(--ink); min-height: 100vh;
    display: flex; align-items: center; justify-content: center; padding: 24px;
  }}
  .card {{
    background: var(--white); border-radius: 24px; max-width: 560px; width: 100%;
    padding: 32px; box-shadow: 0 30px 80px rgba(0,0,0,0.35);
  }}
  .badge {{
    display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 999px;
    font-weight: 800; font-size: 14px; margin-bottom: 20px;
  }}
  .badge.valid {{ background: #dcfce7; color: var(--success) }}
  .badge.invalid {{ background: #fee2e2; color: var(--danger) }}
  h1 {{ margin: 0 0 8px 0; font-size: 26px; color: var(--navy) }}
  h2 {{ margin: 24px 0 8px 0; font-size: 15px; color: var(--muted); text-transform: uppercase; letter-spacing: 1px; font-weight: 800 }}
  .name {{ font-size: 28px; font-weight: 800; color: var(--ink); margin: 4px 0 0 0 }}
  .row {{ margin: 6px 0; color: var(--muted); font-size: 15px }}
  .row strong {{ color: var(--ink) }}
  .footer {{
    margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0;
    color: var(--muted); font-size: 13px;
  }}
  .brand {{ display: flex; align-items: center; gap: 12px; margin-bottom: 24px }}
  .brand .logo {{
    width: 44px; height: 44px; border-radius: 22px; background: var(--lime);
    display: inline-flex; align-items: center; justify-content: center; color: var(--navy);
    font-weight: 900;
  }}
  .brand span {{ color: var(--navy); font-weight: 800; letter-spacing: 0.5px }}
</style></head><body>
<div class="card">
  <div class="brand"><div class="logo">HS</div><span>Hack-Seguro</span></div>
  {content}
  <div class="footer">
    App educativa Hack-Seguro · Prevención de ciberdelitos en México · ID {cert_id}
  </div>
</div>
</body></html>"""


@api.get("/verify/{cert_id}")
async def verify_certificate_html(cert_id: str):
    data = await verify_certificate_json(cert_id)
    if not data["valid"]:
        content = (
            '<span class="badge invalid">✗ Certificado no encontrado</span>'
            "<h1>Este certificado no existe en Hack-Seguro</h1>"
            "<p style=\"color:#475569;line-height:1.5\">Verifica el ID de nuevo o pídele a la persona un enlace fresco. "
            "Los certificados válidos siempre se emiten desde <strong>hackseguro.app</strong>.</p>"
        )
    else:
        school_line = ""
        if data.get("school"):
            s = data["school"]
            school_line = f'<div class="row">Escuela: <strong>{s.get("name")}</strong> · {s.get("city", "")} {s.get("state", "")}</div>'
        grade_line = ""
        if data.get("grade") or data.get("group"):
            grade_line = f'<div class="row">Grupo: <strong>{data.get("grade") or "?"} {data.get("group") or ""}</strong></div>'
        issued = (data.get("issued_at") or "")[:10]
        content = f"""
          <span class="badge valid">✓ Certificado válido</span>
          <h1>{data.get("module_title")}</h1>
          <h2>Otorgado a</h2>
          <div class="name">{data.get("student_name")}</div>
          {grade_line}
          {school_line}
          <div class="row">Emitido: <strong>{issued}</strong></div>
        """
    html = VERIFY_HTML_TEMPLATE.format(content=content, cert_id=cert_id)
    return HTMLResponse(html)


# -------------------------------------------------------------------
# Shareable school poster (server-side PNG)
# -------------------------------------------------------------------
def _generate_school_poster(school: dict, share_url: str) -> bytes:
    W, H = 1080, 1920
    img = Image.new("RGB", (W, H), "#00357a")
    d = ImageDraw.Draw(img)

    def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
        candidates = [
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
        for p in candidates:
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
        return ImageFont.load_default()

    # Lime accent band top
    d.rectangle([(0, 0), (W, 12)], fill="#d0e80b")

    # Logo circle
    d.ellipse([(W // 2 - 130, 220), (W // 2 + 130, 480)], fill="#d0e80b")
    d.text((W // 2, 340), "HS", fill="#00357a", font=font(120, True), anchor="mm")

    # Titles
    d.text((W // 2, 570), "HACK-SEGURO", fill="#FFFFFF", font=font(72, True), anchor="mm")
    d.text((W // 2, 640), "Aprende ciberseguridad jugando", fill="#d0e80b", font=font(36), anchor="mm")

    # School name
    school_name = school.get("name", "")
    d.text((W // 2, 830), "Únete a mi escuela", fill="#FFFFFF", font=font(42), anchor="mm")
    d.text((W // 2, 900), school_name[:34], fill="#FFFFFF", font=font(52, True), anchor="mm")

    # Code card
    card_top, card_bottom = 1000, 1240
    d.rounded_rectangle([(120, card_top), (W - 120, card_bottom)], radius=40, fill="#FFFFFF")
    d.text((W // 2, card_top + 60), "Código de escuela", fill="#475569", font=font(30), anchor="mm")
    d.text((W // 2, card_top + 150), school.get("code", ""), fill="#00357a", font=font(88, True), anchor="mm")

    # QR
    qr_size = 480
    qr_png = _qr_png_bytes(share_url, qr_size)
    qr_img = Image.open(io.BytesIO(qr_png)).convert("RGB")
    img.paste(qr_img, ((W - qr_size) // 2, 1310))

    # Footer
    d.text((W // 2, 1840), "Escanea para descargar Hack-Seguro", fill="#d0e80b", font=font(32), anchor="mm")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


@api.get("/schools/{code}/poster.png")
async def school_poster(code: str):
    school = await db.schools.find_one({"code": code.upper()}, {"_id": 0})
    if not school:
        raise HTTPException(404, "Escuela no encontrada")
    share_url = f"{PUBLIC_BASE_URL}/api/join?code={code.upper()}"
    png = _generate_school_poster(school, share_url)
    return Response(
        content=png,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="hackseguro-{code}.png"'},
    )


def _generate_referral_poster(user: "User", school: Optional[dict], share_url: str) -> bytes:
    """Personal invitation poster for ambassadors (shared via native share sheet)."""
    W, H = 1080, 1920
    img = Image.new("RGB", (W, H), "#00357a")
    d = ImageDraw.Draw(img)

    def font(size: int, bold: bool = False) -> ImageFont.ImageFont:
        candidates = [
            "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
            "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf" if bold else "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        ]
        for p in candidates:
            try:
                return ImageFont.truetype(p, size)
            except Exception:
                continue
        return ImageFont.load_default()

    # Lime accent band
    d.rectangle([(0, 0), (W, 12)], fill="#d0e80b")

    # Header
    d.ellipse([(W // 2 - 90, 180), (W // 2 + 90, 360)], fill="#d0e80b")
    d.text((W // 2, 270), "🛡️", fill="#00357a", font=font(96, True), anchor="mm")

    d.text((W // 2, 440), "HACK-SEGURO", fill="#FFFFFF", font=font(64, True), anchor="mm")
    d.text((W // 2, 505), "Aprende ciberseguridad jugando", fill="#d0e80b", font=font(32), anchor="mm")

    # Invitation title
    first_name = (user.name or "Un guardián").split(" ")[0][:20]
    d.text((W // 2, 660), "Te invita a ser", fill="#FFFFFF", font=font(38), anchor="mm")
    d.text((W // 2, 730), f"{first_name}", fill="#d0e80b", font=font(72, True), anchor="mm")
    d.text((W // 2, 810), "un Guardián Digital", fill="#FFFFFF", font=font(46, True), anchor="mm")

    # School line
    if school:
        d.text((W // 2, 900), f"Escuela: {school.get('name','')[:34]}", fill="#FFFFFF", font=font(32), anchor="mm")

    # Card
    card_top, card_bottom = 970, 1210
    d.rounded_rectangle([(120, card_top), (W - 120, card_bottom)], radius=40, fill="#FFFFFF")
    d.text((W // 2, card_top + 50), "Bono al aceptar", fill="#475569", font=font(26), anchor="mm")
    d.text((W // 2, card_top + 120), "+50 XP para ambos", fill="#00357a", font=font(56, True), anchor="mm")
    d.text((W // 2, card_top + 190), "al completar tu primera lección", fill="#475569", font=font(24), anchor="mm")

    # QR
    qr_size = 480
    qr_png = _qr_png_bytes(share_url, qr_size)
    qr_img = Image.open(io.BytesIO(qr_png)).convert("RGB")
    img.paste(qr_img, ((W - qr_size) // 2, 1280))

    # Footer
    d.text((W // 2, 1810), "Escanea con la cámara de tu celular", fill="#d0e80b", font=font(30), anchor="mm")
    d.text((W // 2, 1860), "o abre hackseguro.app", fill="#FFFFFF", font=font(26), anchor="mm")

    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    return buf.getvalue()


@api.get("/join")
async def join_landing(code: Optional[str] = None, ref: Optional[str] = None):
    """Public landing page that install prompts scan opens to.
    Accepts optional `code` (school) and `ref` (inviter user_id).
    Redirects to the mobile deep-link scheme AND falls back to a friendly page."""
    code = (code or "").upper()
    school_line = ""
    if code:
        school = await db.schools.find_one({"code": code}, {"_id": 0})
        if school:
            school_line = f"<h2>Únete a {school['name']}</h2><p>Código: <strong>{code}</strong></p>"
    inviter_line = ""
    if ref:
        inviter = await db.users.find_one({"user_id": ref.strip()}, {"_id": 0, "name": 1})
        if inviter:
            inviter_line = (
                f"<p style='margin-top:16px'>🎁 <strong>{inviter.get('name','Un amigo')}</strong> te invitó a Hack-Seguro. "
                f"Al completar tu primera lección, ambos suman puntos.</p>"
            )
    # Build the target URL with the params so the client can read them
    params = []
    if code:
        params.append(f"code={code}")
    if ref:
        params.append(f"ref={ref.strip()}")
    query = ("?" + "&".join(params)) if params else ""
    open_url = f"{PUBLIC_BASE_URL}/{query}"
    html = f"""<!doctype html><html lang="es"><head><meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Únete a Hack-Seguro</title>
    <style>body{{background:#00357a;color:#fff;font-family:sans-serif;margin:0;min-height:100vh;
    display:flex;align-items:center;justify-content:center;padding:24px;text-align:center}}
    .card{{background:#fff;color:#0f172a;padding:32px;border-radius:24px;max-width:500px}}
    h1{{color:#00357a}} .cta{{display:inline-block;margin-top:20px;padding:14px 28px;background:#d0e80b;color:#00357a;
    border-radius:999px;font-weight:800;text-decoration:none}}
    </style></head><body><div class="card">
    <h1>🛡️ Hack-Seguro</h1>{school_line}{inviter_line}
    <p>Aprende ciberseguridad jugando cada día. Compite con tu escuela y gana insignias.</p>
    <a class="cta" href="{open_url}">Abrir Hack-Seguro</a>
    </div></body></html>"""
    return HTMLResponse(html)


# -------------------------------------------------------------------
# Ambassadors / Referrals endpoints
# -------------------------------------------------------------------
def _referral_share_url(user_id: str, school_code: Optional[str]) -> str:
    parts = [f"ref={user_id}"]
    if school_code:
        parts.append(f"code={school_code}")
    return f"{PUBLIC_BASE_URL}/api/join?" + "&".join(parts)


@api.get("/referrals/mine")
async def referrals_mine(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    share_url = _referral_share_url(u.user_id, u.school_code)
    # Fetch recent invitees for the "friends" list
    cur = db.referral_events.find(
        {"inviter_id": u.user_id},
        {"_id": 0, "invitee_id": 1, "status": 1, "confirmed_at": 1, "created_at": 1},
    ).sort("created_at", -1).limit(20)
    events = await cur.to_list(length=20)
    invitee_ids = [e["invitee_id"] for e in events]
    invitees_by_id: dict = {}
    if invitee_ids:
        cur2 = db.users.find(
            {"user_id": {"$in": invitee_ids}},
            {"_id": 0, "user_id": 1, "name": 1, "picture": 1},
        )
        for row in await cur2.to_list(length=len(invitee_ids)):
            invitees_by_id[row["user_id"]] = row
    invitees = []
    for e in events:
        info = invitees_by_id.get(e["invitee_id"], {})
        first_name = (info.get("name") or "").split(" ")[0] or "Amigo/a"
        confirmed = e.get("confirmed_at")
        if isinstance(confirmed, datetime):
            confirmed = confirmed.isoformat()
        invitees.append({
            "name": first_name,
            "picture": info.get("picture"),
            "status": e.get("status", "pending"),
            "confirmed_at": confirmed,
        })
    goals = [
        {"badge": "embajador_digital", "threshold": 3, "unlocked": u.referrals_valid >= 3},
        {"badge": "embajador_oro", "threshold": 10, "unlocked": u.referrals_valid >= 10},
    ]
    next_goal_threshold = None
    for g in goals:
        if not g["unlocked"]:
            next_goal_threshold = g["threshold"]
            break
    return {
        "user_id": u.user_id,
        "valid": u.referrals_valid,
        "pending": u.referrals_pending,
        "next_goal": next_goal_threshold,
        "goals": goals,
        "share_url": share_url,
        "poster_url": f"{PUBLIC_BASE_URL}/api/referrals/poster.png",
        "invitees": invitees,
    }


@api.get("/referrals/poster.png")
async def referral_poster(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    school = None
    if u.school_code:
        school = await db.schools.find_one({"code": u.school_code}, {"_id": 0})
    share_url = _referral_share_url(u.user_id, u.school_code)
    png = _generate_referral_poster(u, school, share_url)
    return Response(
        content=png,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="hackseguro-invita-{u.user_id}.png"'},
    )


# -------------------------------------------------------------------
# Seasons (trimestrales, XP promedio por estudiante activo)
# -------------------------------------------------------------------
def _current_season_bounds(dt: Optional[datetime] = None):
    d = (dt or utcnow()).astimezone(timezone.utc)
    year = d.year
    q = (d.month - 1) // 3 + 1
    start_month = (q - 1) * 3 + 1
    start = datetime(year, start_month, 1, tzinfo=timezone.utc)
    if q == 4:
        end = datetime(year + 1, 1, 1, tzinfo=timezone.utc)
    else:
        end = datetime(year, start_month + 3, 1, tzinfo=timezone.utc)
    label = f"{year}-Q{q}"
    return start, end, label


@api.get("/seasons/current")
async def season_current():
    start, end, label = _current_season_bounds()
    return {"season": label, "start": start.isoformat(), "end": end.isoformat()}


@api.get("/seasons/leaderboard")
async def season_leaderboard(authorization: Optional[str] = Header(None)):
    _ = await current_user(authorization)
    start, end, label = _current_season_bounds()

    ws_pipeline = [
        {"$match": {"created_at": {"$gte": start, "$lt": end}}},
        {"$group": {
            "_id": {"school_code": "$school_code", "user_id": "$user_id"},
            "user_xp": {"$sum": "$xp"},
        }},
        {"$group": {
            "_id": "$_id.school_code",
            "total_xp": {"$sum": "$user_xp"},
            "active_students": {"$sum": 1},
        }},
        {"$match": {"_id": {"$ne": None}}},
    ]
    rows = await db.weekly_scores.aggregate(ws_pipeline).to_list(length=1000)

    results = []
    for r in rows:
        code = r["_id"]
        total_xp = r.get("total_xp", 0)
        active = max(1, r.get("active_students", 1))
        avg = total_xp / active
        school = await db.schools.find_one({"code": code}, {"_id": 0})
        results.append({
            "school_code": code,
            "school_name": school.get("name") if school else code,
            "city": school.get("city") if school else None,
            "state": school.get("state") if school else None,
            "total_xp": total_xp,
            "active_students": active,
            "avg_xp_per_active_student": round(avg, 2),
        })
    results.sort(key=lambda x: -x["avg_xp_per_active_student"])
    for i, r in enumerate(results[:10], start=1):
        r["rank"] = i
    return {"season": label, "start": start.isoformat(), "end": end.isoformat(), "top_schools": results[:10]}


# -------------------------------------------------------------------
# Push notifications (Emergent SuprSend relay)
# -------------------------------------------------------------------
_push_client = httpx.AsyncClient(
    base_url=PUSH_BASE_URL,
    headers={"X-Push-Key": EMERGENT_PUSH_KEY},
    timeout=10.0,
)


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


@api.post("/register-push", status_code=201)
async def register_push(body: RegisterPushBody, authorization: Optional[str] = Header(None)):
    # Require an authenticated user; ensure user_id matches
    u = await current_user(authorization)
    if body.user_id != u.user_id:
        raise HTTPException(403, "user_id mismatch")
    try:
        resp = await _push_client.post("/api/v1/push/users/register", json=body.model_dump())
        if resp.status_code == 401:
            raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
        if resp.status_code >= 500:
            raise HTTPException(502, "Push provider unavailable")
        resp.raise_for_status()
    except HTTPException:
        raise
    except Exception as e:
        logger.warning("register-push failed: %s", e)
        raise HTTPException(502, "Push provider unreachable")
    await db.users.update_one({"user_id": u.user_id}, {"$set": {"push_platform": body.platform}})
    return {"status": "registered"}


async def send_push(recipients: List[str], data: dict, idempotency_key: Optional[str] = None):
    if not recipients:
        return
    if len(recipients) > 100:
        raise ValueError("max 100 recipients per /trigger call")
    if "title" not in data or "message" not in data:
        raise ValueError("data must include title and message")
    payload: dict = {"recipients": recipients, "data": data}
    if idempotency_key:
        payload["$idempotency_key"] = idempotency_key
    resp = await _push_client.post("/api/v1/push/trigger", json=payload)
    if resp.status_code == 401:
        raise HTTPException(500, "EMERGENT_PUSH_KEY missing or invalid")
    if resp.status_code >= 500:
        raise HTTPException(502, "Push provider unavailable")
    resp.raise_for_status()


@api.post("/push/streak-reminder")
async def push_streak_reminder(authorization: Optional[str] = Header(None)):
    """Send a daily streak reminder to users who have a streak but haven't been active today.
    Callable manually or by a cron job. Requires an authenticated user (any role)."""
    _ = await current_user(authorization)
    today = utcnow().date()
    cursor = db.users.find(
        {"streak": {"$gte": 1}, "push_platform": {"$exists": True}},
        {"_id": 0, "user_id": 1, "name": 1, "last_activity_at": 1, "streak": 1},
    )
    users = await cursor.to_list(length=1000)
    to_notify = []
    for user in users:
        la = user.get("last_activity_at")
        if isinstance(la, datetime):
            if la.astimezone(timezone.utc).date() == today:
                continue
        to_notify.append(user["user_id"])

    sent = 0
    for chunk_start in range(0, len(to_notify), 100):
        chunk = to_notify[chunk_start:chunk_start + 100]
        try:
            await send_push(
                recipients=chunk,
                data={
                    "title": "¡Tu racha te espera! 🔥",
                    "message": "Practica 5 minutos hoy para no perder tu racha en Hack-Seguro.",
                    "action_url": "/(tabs)/",
                },
                idempotency_key=f"streak-{today.isoformat()}-{chunk_start}",
            )
            sent += len(chunk)
        except Exception as e:
            logger.warning("push chunk failed: %s", e)
    return {"scheduled": len(to_notify), "sent": sent, "date": today.isoformat()}


# -------------------------------------------------------------------
# Health
# -------------------------------------------------------------------
@api.get("/")
async def root():
    return {"app": "Hack-Seguro", "ok": True, "time": utcnow().isoformat()}


# Register router + CORS
app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
