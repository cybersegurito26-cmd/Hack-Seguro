"""Leaderboards and seasons."""
from __future__ import annotations

from typing import Optional
from fastapi import APIRouter, Header, HTTPException

from ..dependencies import current_user
from ..services.leaderboards import current_season_bounds, season_top, weekly_top

router = APIRouter()


@router.get("/leaderboards/weekly")
async def weekly_leaderboard(scope: str = "school", authorization: Optional[str] = Header(None)):
    u = await current_user(authorization)
    if scope not in {"school", "global", "city", "state"}:
        raise HTTPException(400, "scope inválido")
    res = await weekly_top(scope, u.user_id, u.school_code)
    me = res["me"]
    if me:
        me = {**me, "name": u.name}
    return {
        "scope": scope,
        "school_code": u.school_code,
        "week_start": res["week_start"],
        "top": res["top"],
        "me": me,
    }


@router.get("/seasons/current")
async def season_current():
    start, end, label = current_season_bounds()
    return {"season": label, "start": start.isoformat(), "end": end.isoformat()}


@router.get("/seasons/leaderboard")
async def season_leaderboard(authorization: Optional[str] = Header(None)):
    _ = await current_user(authorization)
    return await season_top()
