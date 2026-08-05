"""Certificates: authenticated PDF + public verification."""
from __future__ import annotations

import io
import uuid
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import HTMLResponse, StreamingResponse

from ..core.config import settings
from ..core.database import db
from ..dependencies import current_user
from ..models import utcnow
from ..services.certificates import draw_certificate, render_verify_html

router = APIRouter()


@router.get("/certificates/verify/{cert_id}")
async def verify_certificate_json(cert_id: str):
    cert = await db.certificates.find_one({"cert_id": cert_id}, {"_id": 0})
    if not cert:
        return {"valid": False, "cert_id": cert_id}
    u = await db.users.find_one(
        {"user_id": cert["user_id"]},
        {"_id": 0, "name": 1, "school_code": 1, "grade": 1, "group": 1},
    )
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
        "module_title": settings.MODULE_TITLES.get(cert["module_id"], cert["module_id"]),
        "issued_at": issued,
    }


@router.get("/verify/{cert_id}")
async def verify_certificate_html(cert_id: str):
    data = await verify_certificate_json(cert_id)
    return HTMLResponse(render_verify_html(cert_id, data))


@router.get("/certificates/{module_id}")
async def get_certificate(module_id: str, t: Optional[str] = None, authorization: Optional[str] = Header(None)):
    auth = authorization or (f"Bearer {t}" if t else None)
    u = await current_user(auth)
    if module_id not in settings.MODULE_IDS:
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

    pdf_bytes = draw_certificate(u.name, settings.MODULE_TITLES[module_id], cert_id, when)
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="hackseguro-{module_id}.pdf"'},
    )
