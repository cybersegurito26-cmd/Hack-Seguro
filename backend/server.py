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

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, Header, HTTPException, Request
from fastapi.responses import StreamingResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field

from reportlab.lib.pagesizes import A4, landscape
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.units import cm

from emergentintegrations.llm.chat import LlmChat, UserMessage

# -------------------------------------------------------------------
# Setup
# -------------------------------------------------------------------
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

MONGO_URL = os.environ["MONGO_URL"]
DB_NAME = os.environ.get("DB_NAME", "hackseguro")
EMERGENT_LLM_KEY = os.environ.get("EMERGENT_LLM_KEY", "")

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
    daily_claim_date: Optional[str] = None  # YYYY-MM-DD
    completed_lessons: dict = Field(default_factory=dict)  # module_id -> count
    badges: List[str] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=utcnow)


class SessionExchange(BaseModel):
    session_id: str


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
    }


# -------------------------------------------------------------------
# Auth endpoints
# -------------------------------------------------------------------
_seen_session_ids: set[str] = set()


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
# Leaderboards
# -------------------------------------------------------------------
@api.get("/leaderboards/weekly")
async def weekly_leaderboard(
    scope: str = "school",
    authorization: Optional[str] = Header(None),
):
    u = await current_user(authorization)
    week_start = _iso_week_start()
    match: dict = {"week_start": week_start}
    if scope == "school":
        if not u.school_code:
            return {"scope": scope, "school_code": None, "week_start": week_start.isoformat(), "top": [], "me": None}
        match["school_code"] = u.school_code
    elif scope == "global":
        pass  # No school filter — designed for future municipal/state scoping
    else:
        raise HTTPException(400, "scope inválido")

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
            "xp": r.get("xp", 0),
        })

    me_row = await db.weekly_scores.find_one({"user_id": u.user_id, "week_start": week_start}, {"_id": 0})
    me = None
    if me_row:
        # Compute my rank within the scope
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


def _draw_certificate(name: str, module_title: str, cert_id: str, when: datetime) -> bytes:
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=landscape(A4))
    W, H = landscape(A4)

    navy = HexColor("#00357a")
    lime = HexColor("#d0e80b")
    ink = HexColor("#0F172A")
    muted = HexColor("#475569")

    # Background band
    c.setFillColor(navy)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # White card
    c.setFillColor(HexColor("#FFFFFF"))
    c.roundRect(1.5 * cm, 1.5 * cm, W - 3 * cm, H - 3 * cm, 20, fill=1, stroke=0)

    # Lime ribbon
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

    c.setFont("Helvetica-Oblique", 10)
    c.drawCentredString(W / 2, H - 16.5 * cm,
                        "App educativa Hack-Seguro · Prevención de ciberdelitos en México")

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
