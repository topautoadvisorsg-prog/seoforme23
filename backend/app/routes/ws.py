"""WebSocket endpoint for real-time approval/notification events.

Auth: tries the access_token cookie (sent automatically by browsers during
WS handshake), falls back to a `?token=` query param for tools that can't
set cookies.

Channels (one connection serves all — server filters by role/scope before
push, so the client doesn't need to subscribe):
  - approval.created / approval.updated / approval.status_changed
  - notification.created (Phase 7)
"""
import logging

import jwt
from bson import ObjectId
from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from app.db import db
from app.security import decode_token
from app.ws_manager import registry

logger = logging.getLogger("smartclix.ws")
router = APIRouter()


async def _authenticate(ws: WebSocket, token: str | None) -> dict | None:
    """Return the operator dict or None."""
    if not token:
        # Try the access_token cookie sent during the WS handshake
        token = ws.cookies.get("access_token")
    if not token:
        return None
    try:
        payload = decode_token(token)
    except jwt.PyJWTError:
        return None
    if payload.get("type") != "access":
        return None
    op = await db.operators.find_one({"_id": ObjectId(payload["sub"])})
    return op


@router.websocket("/ws")
async def ws_endpoint(websocket: WebSocket, token: str | None = Query(default=None)):
    await websocket.accept()
    operator = await _authenticate(websocket, token)
    if not operator:
        await websocket.send_json({"type": "auth_error", "detail": "unauthenticated"})
        await websocket.close(code=4401)
        return

    operator_id = str(operator["_id"])
    await registry.add(operator_id, websocket)
    await websocket.send_json({
        "type": "hello",
        "operator_id": operator_id,
        "role": operator["role"],
    })

    try:
        while True:
            # Server is push-only for now. We just read & ignore client frames
            # to keep the socket alive and detect disconnect.
            msg = await websocket.receive_text()
            if msg == "ping":
                await websocket.send_text("pong")
    except WebSocketDisconnect:
        pass
    except Exception as exc:
        logger.warning("WS error for %s: %s", operator_id, exc)
    finally:
        await registry.remove(operator_id, websocket)
