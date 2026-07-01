"""Healthcheck — no auth, no DB call, fast."""
from fastapi import APIRouter

from app.security import now_utc

router = APIRouter()


@router.get("/health")
async def health():
    return {"status": "ok", "service": "smartclix", "time": now_utc().isoformat()}
