"""Brute-force protection for /auth/login.

Tracks failures per `{client_ip}:{email}` in MongoDB. After
LOCKOUT_THRESHOLD failures, locks the identifier for LOCKOUT_MINUTES.

This module is intentionally side-effect-free except for Mongo writes —
import-safe everywhere.
"""
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException

from app.config import LOCKOUT_MINUTES, LOCKOUT_THRESHOLD
from app.db import db
from app.security import now_utc


def _as_aware(dt) -> datetime:
    if isinstance(dt, str):
        dt = datetime.fromisoformat(dt)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


async def check_lockout(identifier: str) -> None:
    entry = await db.login_attempts.find_one({"identifier": identifier})
    if not entry or not entry.get("locked_until"):
        return
    locked_until = _as_aware(entry["locked_until"])
    if locked_until > now_utc():
        minutes = max(1, int((locked_until - now_utc()).total_seconds() // 60) + 1)
        raise HTTPException(
            status_code=429,
            detail=f"Too many attempts. Try again in {minutes} minutes.",
        )


async def register_failure(identifier: str) -> None:
    entry = await db.login_attempts.find_one({"identifier": identifier})
    count = (entry.get("count", 0) if entry else 0) + 1
    update = {"count": count, "updated_at": now_utc().isoformat()}
    if count >= LOCKOUT_THRESHOLD:
        update["locked_until"] = (
            now_utc() + timedelta(minutes=LOCKOUT_MINUTES)
        ).isoformat()
        update["count"] = 0  # reset; locked_until is the source of truth now
    await db.login_attempts.update_one(
        {"identifier": identifier}, {"$set": update}, upsert=True
    )


async def clear_failures(identifier: str) -> None:
    await db.login_attempts.delete_one({"identifier": identifier})
