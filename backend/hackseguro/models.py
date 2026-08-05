"""Pydantic + typed models used across routers and services."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional, List
from pydantic import BaseModel, Field


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(BaseModel):
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "student"  # student | parent | teacher
    school_code: Optional[str] = None
    grade: Optional[str] = None
    group: Optional[str] = None
    xp: int = 0
    coins: int = 25
    level: int = 1
    hearts: int = 5
    streak: int = 0
    last_activity_at: Optional[datetime] = None
    daily_claim_date: Optional[str] = None
    completed_lessons: dict = Field(default_factory=dict)
    badges: List[str] = Field(default_factory=list)
    # Referrals
    invited_by_user_id: Optional[str] = None
    referral_source: Optional[str] = None  # whatsapp | telegram | email | link | direct
    referral_credited: bool = False        # true when invitee's first activity has counted
    invited_count: int = 0                 # invitees registered
    invited_valid_count: int = 0           # invitees that completed at least 1 activity
    push_platform: Optional[str] = None
    created_at: datetime = Field(default_factory=utcnow)


class SessionExchange(BaseModel):
    session_id: str


class JoinSchoolIn(BaseModel):
    school_code: str
    role: Optional[str] = "student"
    grade: Optional[str] = None
    group: Optional[str] = None
    ref: Optional[str] = None            # inviter user_id
    referral_source: Optional[str] = None  # "whatsapp" | "telegram" | ...


class LessonCompleteIn(BaseModel):
    module_id: str
    correct: int
    total: int


class GameCompleteIn(BaseModel):
    game_id: str
    score: int
    total: int


class ChatIn(BaseModel):
    session_id: str
    message: str


class RegisterPushBody(BaseModel):
    user_id: str
    platform: str
    device_token: str


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
        "invited_by_user_id": u.invited_by_user_id,
        "referral_source": u.referral_source,
        "invited_count": u.invited_count,
        "invited_valid_count": u.invited_valid_count,
    }
