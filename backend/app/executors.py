"""Execution layer (Phase 4).

When an operator approves an item, the dashboard "executes" it against the
target platform (Zernio / AdKit / WordPress / Google Business Profile / …).

Real per-service API calls land later. Today every executor is **mocked**
behind `USE_MOCK_EXECUTORS` (default true): it logs the call, simulates a
little latency, writes to activity_log exactly as the real call would, and
returns success. Going live is a per-service env flip — the approval→execution
loop is identical either way.

Paused clients are never auto-executed: the item is approved but left for the
operator to run manually (spec §14).
"""
import asyncio
import logging

from app.config import USE_MOCK_EXECUTORS
from app.db import db
from app.security import now_utc

logger = logging.getLogger("smartclix.exec")

# item_type → the external system that would carry it out
EXECUTION_TARGET = {
    "social_post": "Zernio",
    "social_batch": "Zernio",
    "blog_post": "WordPress",
    "gbp_post": "Google Business Profile",
    "gbp_review": "Google Business Profile",
    "gbp_qa": "Google Business Profile",
    "review_response": "Google Business Profile",
    "ads_recommendation": "AdKit",
    "ads_creative": "AdKit",
    "video_script": "Render Pipeline",
    "video_final": "Publisher",
    "backlink_outreach": "Outreach",
    "lsa_dispute": "Google LSA",
}


async def _log(workspace_id: str, action: str, approval: dict, operator: dict, details: dict | None = None):
    await db.activity_log.insert_one({
        "workspace_id": workspace_id,
        "actor": "system",
        "actor_id": str(operator["_id"]) if operator else None,
        "action": action,
        "target_type": "approval_queue",
        "target_id": str(approval["_id"]),
        "details": {"item_type": approval.get("item_type"), "title": approval.get("title"), **(details or {})},
        "created_at": now_utc().isoformat(),
    })


async def execute_approval(approval: dict, workspace: dict, client: dict, operator: dict) -> dict:
    """Run (or mock) execution for a freshly-approved item. Returns the
    updated approval document with execution_status set."""
    aid = approval["_id"]
    ws_id = str(workspace["_id"])
    target = EXECUTION_TARGET.get(approval["item_type"], "Unknown")

    # Paused client → do not auto-execute; operator runs manually.
    if client and client.get("status") == "paused":
        await db.approval_queue.update_one(
            {"_id": aid}, {"$set": {"execution_status": "not_started", "execution_error": None}}
        )
        await _log(ws_id, "execution.skipped_paused", approval, operator, {"target": target})
        logger.info("Execution skipped (client paused): %s", aid)
        return await db.approval_queue.find_one({"_id": aid})

    await db.approval_queue.update_one({"_id": aid}, {"$set": {"execution_status": "in_progress"}})
    try:
        if USE_MOCK_EXECUTORS:
            await asyncio.sleep(0.1)  # simulate the round-trip
            logger.info("[MOCK] executed %s via %s", approval["item_type"], target)
        else:
            raise NotImplementedError(f"Live executor for {target} is not configured")

        await db.approval_queue.update_one({"_id": aid}, {"$set": {
            "execution_status": "success",
            "actual_scheduled_time": now_utc().isoformat(),
            "execution_error": None,
            "execution_target": target,
        }})
        await _log(ws_id, "execution.success", approval, operator, {"target": target, "mock": USE_MOCK_EXECUTORS})
    except Exception as exc:  # noqa: BLE001 — executors must never crash the approve flow
        await db.approval_queue.update_one({"_id": aid}, {"$set": {
            "execution_status": "failed", "execution_error": str(exc), "execution_target": target,
        }})
        await _log(ws_id, "execution.failed", approval, operator, {"target": target, "error": str(exc)})
        await db.notifications.insert_one({
            "workspace_id": ws_id,
            "operator_id": None,
            "type": "execution_failed",
            "title": f"Execution failed: {approval.get('title')}",
            "body": f"{target} execution failed: {exc}",
            "urgency": "urgent",
            "read_at": None,
            "created_at": now_utc().isoformat(),
        })
        logger.warning("Execution failed for %s: %s", aid, exc)

    return await db.approval_queue.find_one({"_id": aid})
