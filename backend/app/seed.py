"""Seeding: idempotent admin + test reviewer accounts on startup.

Failure to seed an account is logged and skipped — it does NOT prevent the
app from booting. (e.g. transient mongo error → next startup retries.)
"""
import logging

from app.config import (
    ADMIN_EMAIL,
    ADMIN_PASSWORD,
    TEST_REVIEWER_EMAIL,
    TEST_REVIEWER_PASSWORD,
)
from app.db import db
from app.security import hash_password, now_utc, verify_password

logger = logging.getLogger("smartclix.seed")


async def _upsert_operator(email: str, name: str, role: str, password: str) -> None:
    try:
        existing = await db.operators.find_one({"email": email})
        if existing is None:
            await db.operators.insert_one({
                "email": email,
                "name": name,
                "role": role,
                "password_hash": hash_password(password),
                "created_at": now_utc().isoformat(),
                "last_login": None,
            })
            logger.info("Seeded operator: %s (%s)", email, role)
            return

        # If env password changed, sync the hash. Never reset name/role here.
        if not verify_password(password, existing["password_hash"]):
            await db.operators.update_one(
                {"email": email},
                {"$set": {"password_hash": hash_password(password)}},
            )
            logger.info("Updated password for %s from env", email)
    except Exception as exc:  # pragma: no cover
        logger.error("Seeding %s failed: %s", email, exc)


async def seed_operators() -> None:
    await _upsert_operator(ADMIN_EMAIL, "Platform Admin", "admin", ADMIN_PASSWORD)
    await _upsert_operator(TEST_REVIEWER_EMAIL, "Test Reviewer", "reviewer", TEST_REVIEWER_PASSWORD)
