"""Operators CRUD — admin only.

Future polish (tracked in PRD): prevent demotion/deletion of the last admin.
"""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.config import VALID_ROLES
from app.db import db
from app.deps import require_role
from app.models import OperatorCreate, OperatorUpdate, serialize_operator
from app.security import hash_password, now_utc

router = APIRouter()


@router.get("")
async def list_operators(_: dict = Depends(require_role("admin"))):
    items = await db.operators.find().sort("created_at", -1).to_list(500)
    return [serialize_operator(o) for o in items]


@router.post("", status_code=201)
async def create_operator(
    payload: OperatorCreate, admin: dict = Depends(require_role("admin"))
):
    if payload.role not in VALID_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    email = payload.email.lower().strip()
    if await db.operators.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Email already registered")
    doc = {
        "email": email,
        "name": payload.name,
        "role": payload.role,
        "password_hash": hash_password(payload.password),
        "created_at": now_utc().isoformat(),
        "created_by": str(admin["_id"]),
        "last_login": None,
    }
    res = await db.operators.insert_one(doc)
    doc["_id"] = res.inserted_id
    return serialize_operator(doc)


@router.patch("/{operator_id}")
async def update_operator(
    operator_id: str,
    payload: OperatorUpdate,
    _: dict = Depends(require_role("admin")),
):
    updates = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.role is not None:
        if payload.role not in VALID_ROLES:
            raise HTTPException(status_code=400, detail="Invalid role")
        updates["role"] = payload.role
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.operators.find_one_and_update(
        {"_id": ObjectId(operator_id)},
        {"$set": updates},
        return_document=True,
    )
    if not res:
        raise HTTPException(status_code=404, detail="Operator not found")
    return serialize_operator(res)


@router.delete("/{operator_id}")
async def delete_operator(
    operator_id: str, admin: dict = Depends(require_role("admin"))
):
    if operator_id == str(admin["_id"]):
        raise HTTPException(status_code=400, detail="Cannot delete yourself")
    res = await db.operators.delete_one({"_id": ObjectId(operator_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Operator not found")
    return {"ok": True}
