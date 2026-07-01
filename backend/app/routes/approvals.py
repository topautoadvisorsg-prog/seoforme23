"""Approval Queue endpoints.

State machine:
  pending → approved          (POST /approve, optional edited payload)
  pending → rejected          (POST /reject, notes required)
  pending → flagged (toggle)  (POST /flag)
  pending → stale             (set by /approve when item is time-sensitive and
                              the scheduled time is > 24h in the past)

Real execution (Zernio/AdKit/GBP/etc.) ships in Phase 4. Today, /approve
just records the decision and emits a WS event.
"""
from datetime import datetime, timezone

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query

from app.authz import authorized_client_ids, can_access_client
from app.db import db
from app.deps import get_current_operator, require_role
from app.models import (
    ApprovalDecisionIn,
    ApprovalRejectIn,
    ApprovalUpdateIn,
    serialize_approval,
)
from app.executors import execute_approval
from app.security import now_utc
from app.ws_manager import registry

router = APIRouter()

STALE_THRESHOLD_HOURS = 24
TIME_SENSITIVE_TYPES = {"social_batch", "social_post"}


# ---------- helpers ----------
async def _authorized_workspace_filter(operator: dict) -> dict | None:
    """Return a Mongo filter clause limiting to authorized workspaces.
    None = no scope filter (admin/manager).
    {} = no workspaces visible (reviewer with zero assignments).
    """
    if operator["role"] in ("admin", "manager"):
        return None
    client_ids = await authorized_client_ids(operator)
    if not client_ids:
        return {"workspace_id": {"$in": []}}
    workspaces = await db.workspaces.find(
        {"client_id": {"$in": client_ids}}, {"_id": 1}
    ).to_list(500)
    ws_ids = [str(w["_id"]) for w in workspaces]
    return {"workspace_id": {"$in": ws_ids}}


async def _get_with_workspace(approval_id: str) -> tuple[dict, dict, dict]:
    """Returns (approval, workspace, client). Raises 404 if missing."""
    doc = await db.approval_queue.find_one({"_id": ObjectId(approval_id)})
    if not doc:
        raise HTTPException(status_code=404, detail="Approval not found")
    ws = await db.workspaces.find_one({"_id": ObjectId(doc["workspace_id"])})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace missing")
    client = await db.clients.find_one({"_id": ObjectId(ws["client_id"])})
    if not client:
        raise HTTPException(status_code=404, detail="Client missing")
    return doc, ws, client


async def _enrich_list(items: list[dict]) -> list[dict]:
    """Attach client info to each approval doc for the list view."""
    ws_ids = {ObjectId(i["workspace_id"]) for i in items}
    workspaces = await db.workspaces.find(
        {"_id": {"$in": list(ws_ids)}}
    ).to_list(500)
    ws_by_id = {str(w["_id"]): w for w in workspaces}
    client_ids = {ObjectId(w["client_id"]) for w in workspaces}
    clients = await db.clients.find({"_id": {"$in": list(client_ids)}}).to_list(500)
    clients_by_id = {str(c["_id"]): c for c in clients}
    out = []
    for item in items:
        ws = ws_by_id.get(item["workspace_id"])
        client = clients_by_id.get(ws["client_id"]) if ws else None
        out.append(serialize_approval(item, client))
    return out


def _is_stale(item: dict) -> bool:
    if item.get("item_type") not in TIME_SENSITIVE_TYPES:
        return False
    sched = item.get("original_scheduled_time")
    if not sched:
        return False
    if isinstance(sched, str):
        sched = datetime.fromisoformat(sched)
    if sched.tzinfo is None:
        sched = sched.replace(tzinfo=timezone.utc)
    delta = (now_utc() - sched).total_seconds() / 3600
    return delta > STALE_THRESHOLD_HOURS


async def _broadcast(workspace_id: str, event_type: str, approval: dict) -> None:
    await registry.broadcast_to_workspace(
        workspace_id,
        {"type": event_type, "approval": approval},
    )


# ---------- list / get ----------
@router.get("")
async def list_approvals(
    operator: dict = Depends(get_current_operator),
    status: str | None = Query(default=None),
    item_type: str | None = Query(default=None),
    workspace_id: str | None = Query(default=None),
    flagged: bool | None = Query(default=None),
    limit: int = Query(default=50, le=200),
):
    scope_filter = await _authorized_workspace_filter(operator)
    query: dict = {} if scope_filter is None else dict(scope_filter)
    if status:
        query["status"] = status
    if item_type:
        query["item_type"] = item_type
    if workspace_id:
        # Combine with scope (intersect): only return if also in scope
        if scope_filter and workspace_id not in scope_filter.get("workspace_id", {}).get("$in", []):
            return {"items": [], "counts": {}, "total": 0}
        query["workspace_id"] = workspace_id
    if flagged is not None:
        query["flagged"] = flagged

    items = await db.approval_queue.find(query).sort("created_at", -1).to_list(limit)
    enriched = await _enrich_list(items)

    # Counts across all statuses (for tab badges)
    counts_query = {} if scope_filter is None else dict(scope_filter)
    pipeline = [
        {"$match": counts_query},
        {"$group": {"_id": "$status", "count": {"$sum": 1}}},
    ]
    counts: dict = {}
    async for row in db.approval_queue.aggregate(pipeline):
        counts[row["_id"]] = row["count"]
    counts["all"] = sum(counts.values())

    return {"items": enriched, "counts": counts, "total": len(enriched)}


@router.get("/{approval_id}")
async def get_approval(
    approval_id: str, operator: dict = Depends(get_current_operator)
):
    doc, ws, client = await _get_with_workspace(approval_id)
    if not await can_access_client(operator, ws["client_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    return serialize_approval(doc, client)


# ---------- decisions ----------
@router.patch("/{approval_id}")
async def update_approval(
    approval_id: str,
    payload: ApprovalUpdateIn,
    operator: dict = Depends(get_current_operator),
):
    """Save edits in-place (status stays pending)."""
    doc, ws, client = await _get_with_workspace(approval_id)
    if not await can_access_client(operator, ws["client_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    if doc["status"] != "pending":
        raise HTTPException(status_code=400, detail="Only pending items can be edited")
    updated = await db.approval_queue.find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {"payload": payload.payload}},
        return_document=True,
    )
    serialized = serialize_approval(updated, client)
    await _broadcast(str(ws["_id"]), "approval.updated", serialized)
    return serialized


@router.post("/{approval_id}/approve")
async def approve(
    approval_id: str,
    payload: ApprovalDecisionIn,
    operator: dict = Depends(get_current_operator),
):
    doc, ws, client = await _get_with_workspace(approval_id)
    if not await can_access_client(operator, ws["client_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    if doc["status"] not in ("pending", "flagged"):
        raise HTTPException(
            status_code=400, detail=f"Cannot approve from status={doc['status']}"
        )

    # Stale check for time-sensitive items
    if _is_stale(doc):
        await db.approval_queue.update_one(
            {"_id": doc["_id"]}, {"$set": {"status": "stale"}}
        )
        raise HTTPException(
            status_code=409,
            detail="Item is stale (>24h past scheduled time). Re-queue or delete.",
        )

    updates: dict = {
        "status": "approved",
        "reviewed_by": str(operator["_id"]),
        "reviewed_at": now_utc().isoformat(),
        "execution_status": "not_started",  # Phase 4 will flip to in_progress
    }
    if payload.final_payload is not None:
        updates["final_payload"] = payload.final_payload
    if payload.review_notes:
        updates["review_notes"] = payload.review_notes

    updated = await db.approval_queue.find_one_and_update(
        {"_id": doc["_id"]}, {"$set": updates}, return_document=True
    )

    # Activity log
    await db.activity_log.insert_one({
        "workspace_id": doc["workspace_id"],
        "actor": "operator",
        "actor_id": str(operator["_id"]),
        "action": "approval.approved",
        "target_type": "approval_queue",
        "target_id": str(doc["_id"]),
        "details": {"item_type": doc["item_type"], "title": doc.get("title")},
        "created_at": now_utc().isoformat(),
    })

    # Phase 4: run (or mock) execution against the target platform. Paused
    # clients are approved but left for manual execution (handled inside).
    final = await execute_approval(updated, ws, client, operator)

    serialized = serialize_approval(final, client)
    await _broadcast(str(ws["_id"]), "approval.status_changed", serialized)
    return serialized


@router.post("/{approval_id}/reject")
async def reject(
    approval_id: str,
    payload: ApprovalRejectIn,
    operator: dict = Depends(get_current_operator),
):
    doc, ws, client = await _get_with_workspace(approval_id)
    if not await can_access_client(operator, ws["client_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    if doc["status"] not in ("pending", "flagged"):
        raise HTTPException(
            status_code=400, detail=f"Cannot reject from status={doc['status']}"
        )
    updated = await db.approval_queue.find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {
            "status": "rejected",
            "reviewed_by": str(operator["_id"]),
            "reviewed_at": now_utc().isoformat(),
            "review_notes": payload.review_notes,
        }},
        return_document=True,
    )
    await db.activity_log.insert_one({
        "workspace_id": doc["workspace_id"],
        "actor": "operator",
        "actor_id": str(operator["_id"]),
        "action": "approval.rejected",
        "target_type": "approval_queue",
        "target_id": str(doc["_id"]),
        "details": {"item_type": doc["item_type"], "notes": payload.review_notes},
        "created_at": now_utc().isoformat(),
    })
    serialized = serialize_approval(updated, client)
    await _broadcast(str(ws["_id"]), "approval.status_changed", serialized)
    return serialized


@router.post("/{approval_id}/flag")
async def toggle_flag(
    approval_id: str, operator: dict = Depends(get_current_operator)
):
    doc, ws, client = await _get_with_workspace(approval_id)
    if not await can_access_client(operator, ws["client_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    new_flag = not bool(doc.get("flagged"))
    updated = await db.approval_queue.find_one_and_update(
        {"_id": doc["_id"]}, {"$set": {"flagged": new_flag}}, return_document=True
    )
    serialized = serialize_approval(updated, client)
    await _broadcast(str(ws["_id"]), "approval.updated", serialized)
    return serialized


@router.post("/{approval_id}/requeue")
async def requeue(
    approval_id: str,
    operator: dict = Depends(require_role("admin", "manager")),
):
    """Reset a stale or rejected item to pending with a fresh scheduled_time = now+24h."""
    doc, ws, client = await _get_with_workspace(approval_id)
    if not await can_access_client(operator, ws["client_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")
    from datetime import timedelta
    new_sched = (now_utc() + timedelta(days=1)).isoformat()
    updated = await db.approval_queue.find_one_and_update(
        {"_id": doc["_id"]},
        {"$set": {
            "status": "pending",
            "original_scheduled_time": new_sched,
            "review_notes": None,
            "reviewed_at": None,
            "reviewed_by": None,
        }},
        return_document=True,
    )
    serialized = serialize_approval(updated, client)
    await _broadcast(str(ws["_id"]), "approval.status_changed", serialized)
    return serialized


@router.delete("/{approval_id}")
async def delete_approval(
    approval_id: str, _: dict = Depends(require_role("admin", "manager"))
):
    res = await db.approval_queue.delete_one({"_id": ObjectId(approval_id)})
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Approval not found")
    return {"ok": True}
