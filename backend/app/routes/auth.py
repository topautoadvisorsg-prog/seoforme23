"""Auth routes: login, logout, me, refresh, forgot-password, reset-password."""
import logging
import secrets
from datetime import timedelta

import jwt
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.brute_force import check_lockout, clear_failures, register_failure
from app.db import db
from app.deps import get_current_operator
from app.models import (
    ForgotPasswordIn,
    LoginIn,
    ResetPasswordIn,
    serialize_operator,
)
from app.security import (
    client_ip,
    clear_auth_cookies,
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    now_utc,
    set_access_cookie,
    set_auth_cookies,
    verify_password,
)

logger = logging.getLogger("smartclix.auth")
router = APIRouter()


@router.post("/login")
async def login(payload: LoginIn, request: Request, response: Response):
    email = payload.email.lower().strip()
    identifier = f"{client_ip(request)}:{email}"
    await check_lockout(identifier)

    op = await db.operators.find_one({"email": email})
    if not op or not verify_password(payload.password, op["password_hash"]):
        await register_failure(identifier)
        raise HTTPException(
            status_code=401, detail="Incorrect email or password. Try again."
        )

    await clear_failures(identifier)
    await db.operators.update_one(
        {"_id": op["_id"]}, {"$set": {"last_login": now_utc().isoformat()}}
    )

    op_id = str(op["_id"])
    set_auth_cookies(
        response,
        create_access_token(op_id, op["email"], op["role"]),
        create_refresh_token(op_id),
    )
    return serialize_operator(op)


@router.post("/logout")
async def logout(response: Response, _: dict = Depends(get_current_operator)):
    clear_auth_cookies(response)
    return {"ok": True}


@router.get("/me")
async def me(operator: dict = Depends(get_current_operator)):
    return serialize_operator(operator)


@router.post("/refresh")
async def refresh(request: Request, response: Response):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type")

    op = await db.operators.find_one({"_id": ObjectId(payload["sub"])})
    if not op:
        raise HTTPException(status_code=401, detail="Operator not found")

    set_access_cookie(
        response, create_access_token(str(op["_id"]), op["email"], op["role"])
    )
    return {"ok": True}


@router.post("/forgot-password")
async def forgot_password(payload: ForgotPasswordIn):
    """Always returns the same response — never leak whether the email exists."""
    email = payload.email.lower().strip()
    op = await db.operators.find_one({"email": email})
    if op:
        token = secrets.token_urlsafe(32)
        await db.password_reset_tokens.insert_one({
            "operator_id": str(op["_id"]),
            "token": token,
            "expires_at": now_utc() + timedelta(hours=1),
            "used": False,
            "created_at": now_utc().isoformat(),
        })
        # Phase 1: console log; Phase 5 wires Resend.
        logger.info("PASSWORD RESET LINK for %s: /reset-password?token=%s", email, token)
    return {
        "ok": True,
        "message": "If that email is registered, you'll receive a reset link shortly.",
    }


@router.post("/reset-password")
async def reset_password(payload: ResetPasswordIn):
    record = await db.password_reset_tokens.find_one({"token": payload.token})
    if not record or record.get("used"):
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    expires = record["expires_at"]
    if isinstance(expires, str):
        from datetime import datetime
        expires = datetime.fromisoformat(expires)
    if expires.tzinfo is None:
        from datetime import timezone
        expires = expires.replace(tzinfo=timezone.utc)
    if expires < now_utc():
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    await db.operators.update_one(
        {"_id": ObjectId(record["operator_id"])},
        {"$set": {"password_hash": hash_password(payload.new_password)}},
    )
    await db.password_reset_tokens.update_one(
        {"_id": record["_id"]}, {"$set": {"used": True}}
    )
    return {"ok": True}
