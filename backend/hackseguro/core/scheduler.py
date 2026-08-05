"""APScheduler: daily streak reminder push at 18:00 CDMX (00:00 UTC)."""
from __future__ import annotations

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from .config import settings

logger = logging.getLogger("hackseguro.scheduler")

_scheduler: AsyncIOScheduler | None = None


async def _daily_streak_job() -> None:
    # Local import to avoid circular imports at module load.
    from ..services.push import send_streak_reminders
    try:
        result = await send_streak_reminders()
        logger.info("Daily streak reminder result=%s", result)
    except Exception as exc:  # pragma: no cover
        logger.exception("Daily streak reminder failed: %s", exc)


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        _daily_streak_job,
        CronTrigger(
            hour=settings.STREAK_REMINDER_HOUR_UTC,
            minute=settings.STREAK_REMINDER_MINUTE_UTC,
        ),
        id="daily_streak_reminder",
        replace_existing=True,
        misfire_grace_time=3600,
    )
    _scheduler.start()
    logger.info(
        "Scheduler started. Streak reminder at %02d:%02d UTC (18:00 CDMX)",
        settings.STREAK_REMINDER_HOUR_UTC,
        settings.STREAK_REMINDER_MINUTE_UTC,
    )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
