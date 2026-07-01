"""Clients CRUD.

A client is the unit of customer engagement. Each client gets exactly one
workspace (1:1) created atomically on POST.

Reviewers see only clients they own (via clients.assigned_to). Admin/manager
see all.
"""
import logging
from datetime import timedelta

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.authz import authorized_client_ids, can_access_client
from app.db import db
from app.deps import get_current_operator, require_role
from app.models import (
    ClientCreate,
    ClientStatusUpdate,
    ClientUpdate,
    serialize_client,
)
from app.security import now_utc
from app.services_registry import SERVICE_KEYS

logger = logging.getLogger("smartclix.clients")
router = APIRouter()


CHURN_RETENTION_DAYS = 90


async def _get_workspace(client_id: str) -> dict | None:
    return await db.workspaces.find_one({"client_id": client_id})


@router.get("")
async def list_clients(operator: dict = Depends(get_current_operator)):
    scope = await authorized_client_ids(operator)
    query = {} if scope is None else {"_id": {"$in": [ObjectId(i) for i in scope]}}
    docs = await db.clients.find(query).sort("created_at", -1).to_list(500)
    out = []
    for doc in docs:
        ws = await _get_workspace(str(doc["_id"]))
        out.append(serialize_client(doc, ws))
    return out


@router.post("", status_code=201)
async def create_client(
    payload: ClientCreate, _: dict = Depends(require_role("admin", "manager"))
):
    doc = {
        "name": payload.name,
        "website_url": payload.website_url,
        "industry": payload.industry,
        "location": payload.location.model_dump() if payload.location else None,
        "assigned_to": payload.assigned_to,
        "status": "active",
        "created_at": now_utc().isoformat(),
        "churned_at": None,
        "data_deletion_date": None,
    }
    res = await db.clients.insert_one(doc)
    client_id = str(res.inserted_id)
    # 1:1 workspace, all services disabled by default
    ws_doc = {
        "client_id": client_id,
        "seo_enabled": False,
        "gbp_enabled": False,
        "social_enabled": False,
        "meta_ads_enabled": False,
        "google_ads_enabled": False,
        "lsa_enabled": False,
        "linkedin_ads_enabled": False,
        "video_enabled": False,
        "onboarding_complete": False,
        "onboarding_started_at": now_utc().isoformat(),
        "onboarding_completed_at": None,
        "created_at": now_utc().isoformat(),
    }
    ws_res = await db.workspaces.insert_one(ws_doc)
    doc["_id"] = res.inserted_id
    ws_doc["_id"] = ws_res.inserted_id
    return serialize_client(doc, ws_doc)


@router.get("/{client_id}")
async def get_client(
    client_id: str, operator: dict = Depends(get_current_operator)
):
    if not await can_access_client(operator, client_id):
        raise HTTPException(status_code=403, detail="Not authorized for this client")
    doc = await db.clients.find_one({"_id": ObjectId(client_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Client not found")
    ws = await _get_workspace(client_id)
    return serialize_client(doc, ws)


@router.get("/{client_id}/activity")
async def list_client_activity(
    client_id: str,
    operator: dict = Depends(get_current_operator),
    limit: int = Query(default=20, le=100),
):
    """Recent activity_log entries for this client's workspace (audit feed)."""
    if not await can_access_client(operator, client_id):
        raise HTTPException(status_code=403, detail="Not authorized for this client")
    ws = await _get_workspace(client_id)
    if not ws:
        return []
    rows = await db.activity_log.find(
        {"workspace_id": str(ws["_id"])}
    ).sort("created_at", -1).to_list(limit)
    return [
        {
            "id": str(r["_id"]),
            "actor": r.get("actor"),
            "actor_id": r.get("actor_id"),
            "action": r.get("action"),
            "target_type": r.get("target_type"),
            "details": r.get("details"),
            "created_at": r.get("created_at"),
        }
        for r in rows
    ]


@router.patch("/{client_id}")
async def update_client(
    client_id: str,
    payload: ClientUpdate,
    _: dict = Depends(require_role("admin", "manager")),
):
    updates = {k: v for k, v in payload.model_dump(exclude_unset=True).items()}
    if "location" in updates and updates["location"] is not None:
        updates["location"] = payload.location.model_dump()
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")
    res = await db.clients.find_one_and_update(
        {"_id": ObjectId(client_id)}, {"$set": updates}, return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="Client not found")
    ws = await _get_workspace(client_id)
    return serialize_client(res, ws)


@router.patch("/{client_id}/status")
async def update_client_status(
    client_id: str,
    payload: ClientStatusUpdate,
    _: dict = Depends(require_role("admin", "manager")),
):
    updates: dict = {"status": payload.status}
    now = now_utc()
    if payload.status == "churned":
        updates["churned_at"] = now.isoformat()
        updates["data_deletion_date"] = (now + timedelta(days=CHURN_RETENTION_DAYS)).isoformat()
    elif payload.status == "active":
        updates["churned_at"] = None
        updates["data_deletion_date"] = None
    res = await db.clients.find_one_and_update(
        {"_id": ObjectId(client_id)}, {"$set": updates}, return_document=True
    )
    if not res:
        raise HTTPException(status_code=404, detail="Client not found")
    ws = await _get_workspace(client_id)
    return serialize_client(res, ws)


@router.delete("/{client_id}")
async def delete_client(
    client_id: str, _: dict = Depends(require_role("admin"))
):
    """Hard delete — wipes client + workspace + all related data.
    Prefer status='churned' for graceful offboarding. This endpoint is
    intended for test data cleanup and post-retention purges only.
    """
    obj_id = ObjectId(client_id)
    existing = await db.clients.find_one({"_id": obj_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Client not found")

    ws = await _get_workspace(client_id)
    ws_id = str(ws["_id"]) if ws else None

    await db.clients.delete_one({"_id": obj_id})
    if ws_id:
        await db.workspaces.delete_one({"_id": ws["_id"]})
        await db.onboarding_items.delete_many({"workspace_id": ws_id})
        await db.mcp_connections.delete_many({"workspace_id": ws_id})
        await db.approval_queue.delete_many({"workspace_id": ws_id})
        await db.activity_log.delete_many({"workspace_id": ws_id})
        await db.notifications.delete_many({"workspace_id": ws_id})
        await db.analytics_snapshots.delete_many({"workspace_id": ws_id})
        await db.cost_log.delete_many({"workspace_id": ws_id})
        await db.lsa_leads.delete_many({"workspace_id": ws_id})
        await db.lsa_disputes.delete_many({"workspace_id": ws_id})
    await db.client_access.delete_many({"client_id": client_id})
    return {"ok": True}
