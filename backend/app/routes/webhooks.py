"""Cowork → Dashboard webhook (Phase 4).

Single endpoint, many item types. Cowork's desktop agents POST their output
here; the dashboard routes each item to the right collection (spec §4).

Auth: a shared secret in the `x-webhook-secret` header, compared in constant
time against WEBHOOK_SECRET. This is the only unauthenticated-by-cookie route,
so the secret is the whole gate.
"""
import hmac
import logging

from bson import ObjectId
from bson.errors import InvalidId
from fastapi import APIRouter, Header, HTTPException

from app.config import WEBHOOK_SECRET
from app.db import db
from app.models import WebhookIn, serialize_approval
from app.security import now_utc
from app.ws_manager import registry

logger = logging.getLogger("smartclix.webhook")
router = APIRouter()

APPROVAL_TYPES = {
    "social_post", "social_batch", "blog_post", "gbp_post", "gbp_review",
    "gbp_qa", "ads_recommendation", "ads_creative", "video_script",
    "video_final", "review_response", "backlink_outreach", "lsa_dispute",
}


def _verify_secret(provided: str | None) -> None:
    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Webhook secret not configured")
    if not provided or not hmac.compare_digest(provided, WEBHOOK_SECRET):
        raise HTTPException(status_code=401, detail="Invalid webhook secret")


async def _notify(workspace_id: str, type_: str, title: str, body: str, urgency: str = "info"):
    await db.notifications.insert_one({
        "workspace_id": workspace_id,
        "operator_id": None,
        "type": type_,
        "title": title,
        "body": body,
        "urgency": urgency,
        "read_at": None,
        "created_at": now_utc().isoformat(),
    })


@router.post("/cowork")
async def cowork_webhook(payload: WebhookIn, x_webhook_secret: str = Header(default=None)):
    _verify_secret(x_webhook_secret)

    try:
        ws_oid = ObjectId(payload.workspace_id)
    except (InvalidId, TypeError):
        raise HTTPException(status_code=404, detail="Workspace not found")

    workspace = await db.workspaces.find_one({"_id": ws_oid})
    if not workspace:
        raise HTTPException(status_code=404, detail="Workspace not found")
    ws_id = str(workspace["_id"])

    client = await db.clients.find_one({"_id": ObjectId(workspace["client_id"])})
    if client and client.get("status") == "churned":
        raise HTTPException(status_code=410, detail="Client churned — workspace no longer accepts items")
    is_paused = bool(client and client.get("status") == "paused")

    it = payload.item_type
    now = now_utc().isoformat()

    # ---- approval-queue items ----
    if it in APPROVAL_TYPES:
        body = dict(payload.payload or {})
        if is_paused:
            body["_client_paused"] = True
        doc = {
            "workspace_id": ws_id,
            "item_type": it,
            "title": payload.title or it.replace("_", " ").title(),
            "status": "pending",
            "payload": body,
            "flagged": False,
            "execution_status": "not_started",
            "expires_at": payload.expires_at,
            "original_scheduled_time": payload.original_scheduled_time,
            "created_at": now,
        }
        res = await db.approval_queue.insert_one(doc)
        doc["_id"] = res.inserted_id
        # If Cowork delivered a finished video, mark its source script rendered
        # so it drops out of the "awaiting render" work list.
        if it == "video_final" and body.get("source_script_id"):
            try:
                await db.approval_queue.update_one(
                    {"_id": ObjectId(body["source_script_id"])},
                    {"$set": {"execution_status": "rendered"}},
                )
            except (InvalidId, TypeError):
                pass
        serialized = serialize_approval(doc, client)
        await registry.broadcast_to_workspace(ws_id, {"type": "approval.created", "approval": serialized})
        await _notify(ws_id, "new_approval", f"New {doc['title']}", "Awaiting your review.",
                      urgency="warning" if is_paused else "info")
        return {"ok": True, "routed_to": "approval_queue", "id": str(res.inserted_id), "client_paused": is_paused}

    # ---- analytics snapshot (silent) ----
    if it == "analytics_snapshot":
        await db.analytics_snapshots.insert_one({
            "workspace_id": ws_id,
            "snapshot_type": payload.payload.get("snapshot_type", "generic"),
            "snapshot_date": payload.payload.get("snapshot_date", now),
            "data": payload.payload,
            "created_at": now,
        })
        return {"ok": True, "routed_to": "analytics_snapshots"}

    # ---- cost report (upsert by workspace+month+service) ----
    if it == "cost_report":
        p = payload.payload or {}
        month = p.get("month", now[:7] + "-01")
        service = p.get("service", "all")
        await db.cost_log.update_one(
            {"workspace_id": ws_id, "month": month, "service": service},
            {"$set": {
                "units_used": p.get("units_used", 0),
                "estimated_cost": p.get("estimated_cost", 0),
                "updated_at": now,
            }},
            upsert=True,
        )
        if p.get("estimated_cost", 0) and p.get("budget", 0):
            pct = p["estimated_cost"] / p["budget"]
            if pct >= 0.8:
                await _notify(ws_id, "cost_threshold", "Budget at 80%+",
                              f"{service} spend is {round(pct * 100)}% of budget.", "warning")
        return {"ok": True, "routed_to": "cost_log"}

    # ---- agent failure → notification ----
    if it == "agent_failure":
        await _notify(ws_id, "agent_failure", payload.title or "Agent failure",
                      payload.payload.get("error", "An agent run failed."), "warning")
        await registry.broadcast_to_workspace(ws_id, {"type": "notification.created"})
        return {"ok": True, "routed_to": "notifications"}

    # ---- agent run → activity log ----
    if it == "agent_run":
        await db.activity_log.insert_one({
            "workspace_id": ws_id,
            "actor": "agent",
            "actor_id": None,
            "action": payload.payload.get("action", "agent.run"),
            "target_type": "agent",
            "target_id": None,
            "details": payload.payload,
            "created_at": now,
        })
        return {"ok": True, "routed_to": "activity_log"}

    raise HTTPException(status_code=400, detail=f"Unknown item_type: {it}")
