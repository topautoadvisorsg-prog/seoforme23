"""Cryptographic primitives + cookie helpers.

Kept dependency-light so security.py never needs to import db, models, or
anything app-specific. Pure functions = easy to test in isolation.
"""
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Request, Response

from app.config import (
    ACCESS_TOKEN_MINUTES,
    COOKIE_SAMESITE,
    COOKIE_SECURE,
    JWT_ALGORITHM,
    JWT_SECRET,
    REFRESH_TOKEN_DAYS,
)


def now_utc() -> datetime:
    return datetime.now(timezone.utc)


# ---------- password ----------
def hash_password(p: str) -> str:
    return bcrypt.hashpw(p.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


# ---------- jwt ----------
def create_access_token(operator_id: str, email: str, role: str) -> str:
    payload = {
        "sub": operator_id,
        "email": email,
        "role": role,
        "type": "access",
        "exp": now_utc() + timedelta(minutes=ACCESS_TOKEN_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def create_refresh_token(operator_id: str) -> str:
    payload = {
        "sub": operator_id,
        "type": "refresh",
        "exp": now_utc() + timedelta(days=REFRESH_TOKEN_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_token(token: str) -> dict:
    """Raises jwt.ExpiredSignatureError / jwt.InvalidTokenError on failure."""
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])


# ---------- cookies ----------
# secure=True + SameSite=None lets cookies travel cross-site over HTTPS in prod.
# Driven by COOKIE_SECURE so local http dev (secure=False, SameSite=Lax) works.
COOKIE_KW = {
    "httponly": True,
    "secure": COOKIE_SECURE,
    "samesite": COOKIE_SAMESITE,
    "path": "/",
}


def set_access_cookie(response: Response, access_token: str) -> None:
    response.set_cookie(
        key="access_token",
        value=access_token,
        max_age=ACCESS_TOKEN_MINUTES * 60,
        **COOKIE_KW,
    )


def set_auth_cookies(response: Response, access_token: str, refresh_token: str) -> None:
    set_access_cookie(response, access_token)
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        max_age=REFRESH_TOKEN_DAYS * 86400,
        **COOKIE_KW,
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie("access_token", path="/")
    response.delete_cookie("refresh_token", path="/")


# ---------- client identification ----------
def client_ip(request: Request) -> str:
    """Real client IP. Behind k8s ingress, request.client.host is the upstream
    pod IP (varies per replica), so honor X-Forwarded-For first.
    """
    xff = request.headers.get("x-forwarded-for", "")
    if xff:
        return xff.split(",")[0].strip()
    if request.client:
        return request.client.host
    return "unknown"


def extract_bearer_token(request: Request) -> Optional[str]:
    """Cookie first, then Authorization header (allows curl/CI testing)."""
    token = request.cookies.get("access_token")
    if token:
        return token
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None
