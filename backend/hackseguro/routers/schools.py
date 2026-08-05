"""Schools: catalog, join, my school, poster, public landing."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import HTMLResponse, Response

from ..core.config import settings
from ..core.database import db
from ..dependencies import current_user
from ..models import JoinSchoolIn, User, user_public
from ..services.progress import register_referral
from ..services.posters import generate_school_poster, render_join_landing_html

router = APIRouter()


@router.get("/schools/mine")
async def my_school(authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    if not u.school_code:
        return {"school": None}
    s = await db.schools.find_one({"code": u.school_code}, {"_id": 0})
    return {"school": s}


@router.get("/schools/{code}")
async def school_by_code(code: str):
    s = await db.schools.find_one({"code": code.upper()}, {"_id": 0})
    if not s:
        raise HTTPException(status_code=404, detail="Escuela no encontrada")
    return s


@router.post("/schools/join")
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

    referral_registered = False
    if body.ref:
        referral_registered = await register_referral(u.user_id, body.ref, body.referral_source)

    user = await db.users.find_one({"user_id": u.user_id}, {"_id": 0})
    return {"user": user_public(User(**user)), "school": school, "referral_registered": referral_registered}


@router.get("/schools/{code}/poster.png")
async def school_poster(code: str):
    school = await db.schools.find_one({"code": code.upper()}, {"_id": 0})
    if not school:
        raise HTTPException(404, "Escuela no encontrada")
    share_url = f"{settings.PUBLIC_BASE_URL}/api/join?code={code.upper()}"
    png = generate_school_poster(school, share_url)
    return Response(
        content=png,
        media_type="image/png",
        headers={"Content-Disposition": f'inline; filename="hackseguro-{code}.png"'},
    )


@router.get("/join")
async def join_landing(code: Optional[str] = None, ref: Optional[str] = None):
    code = (code or "").upper()
    school = await db.schools.find_one({"code": code}, {"_id": 0}) if code else None
    html = render_join_landing_html(school, code, ref)
    return HTMLResponse(html)
