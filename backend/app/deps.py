"""FastAPI dependencies: who is the current operator + role enforcement.

Routes never decode tokens themselves — they only depend on
`get_current_operator` (any authenticated) or `require_role(...)` (RBAC).
"""
import jwt
from bson import ObjectId
from fastapi import Depends, HTTPException, Request

from app.db import db
from app.security import decode_token, extract_bearer_token


async def get_current_operator(request: Request) -> dict:
    token = extract_bearer_token(request)
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = decode_token(token)
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type")

    op = await db.operators.find_one({"_id": ObjectId(payload["sub"])})
    if not op:
        raise HTTPException(status_code=401, detail="Operator not found")
    return op


def require_role(*allowed_roles: str):
    """Dependency factory. Use as: operator: dict = Depends(require_role("admin"))"""

    async def _checker(operator: dict = Depends(get_current_operator)) -> dict:
        if operator["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return operator

    return _checker
