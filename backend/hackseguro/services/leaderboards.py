"""Leaderboards & seasons."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from ..core.database import db
from .progress import iso_week_start


async def schools_in_scope(scope: str, ref_school_code: Optional[str]) -> Optional[List[str]]:
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


def current_season_bounds(dt: Optional[datetime] = None):
    d = (dt or datetime.now(timezone.utc)).astimezone(timezone.utc)
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


async def weekly_top(scope: str, user_id: str, school_code: Optional[str]):
    week_start = iso_week_start()
    match: dict = {"week_start": week_start}
    codes = await schools_in_scope(scope, school_code)
    if codes is not None:
        if not codes:
            return {"top": [], "me": None, "week_start": week_start.isoformat()}
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

    me_row = await db.weekly_scores.find_one({"user_id": user_id, "week_start": week_start}, {"_id": 0})
    me = None
    if me_row:
        higher_match = {**match, "xp": {"$gt": me_row["xp"]}}
        higher = await db.weekly_scores.count_documents(higher_match)
        me = {"rank": higher + 1, "xp": me_row["xp"]}
    return {"top": top, "me": me, "week_start": week_start.isoformat()}


async def season_top():
    start, end, label = current_season_bounds()
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
        school = await db.schools.find_one({"code": code}, {"_id": 0})
        results.append({
            "school_code": code,
            "school_name": school.get("name") if school else code,
            "city": school.get("city") if school else None,
            "state": school.get("state") if school else None,
            "total_xp": total_xp,
            "active_students": active,
            "avg_xp_per_active_student": round(total_xp / active, 2),
        })
    results.sort(key=lambda x: -x["avg_xp_per_active_student"])
    for i, r in enumerate(results[:10], start=1):
        r["rank"] = i
    return {"season": label, "start": start.isoformat(), "end": end.isoformat(), "top_schools": results[:10]}
