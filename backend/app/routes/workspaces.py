"""Workspaces — services toggles + onboarding state.

A workspace is created automatically with each client (see routes/clients.py).
This module manages the service flags and recomputes onboarding completion.
"""
from datetime import datetime

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.authz import can_access_client
from app.db import db
from app.deps import get_current_operator, require_role
from app.models import ServicesToggleIn, serialize_workspace
from app.security import now_utc
from app.services_registry import SERVICE_KEYS, template_for

router = APIRouter()


async def _workspace_for_client(client_id: str) -> dict:
    ws = await db.workspaces.find_one({"client_id": client_id})
    if not ws:
        raise HTTPException(status_code=404, detail="Workspace not found")
    return ws


async def _generate_onboarding(workspace_id: str, service: str) -> None:
    """Idempotent — adds checklist items for a service if missing."""
    # Common items are added the first time any service is enabled
    existing_keys = {
        d["item_key"]
        for d in await db.onboarding_items.find(
            {"workspace_id": workspace_id}, {"item_key": 1}
        ).to_list(500)
    }
    if not existing_keys:
        for key, label in template_for("common"):
            await db.onboarding_items.insert_one({
                "workspace_id": workspace_id,
                "service": "common",
                "item_key": key,
                "label": label,
                "completed": False,
                "completed_at": None,
                "completed_by": None,
            })
            existing_keys.add(key)

    for key, label in template_for(service):
        if key in existing_keys:
            continue
        try:
            await db.onboarding_items.insert_one({
                "workspace_id": workspace_id,
                "service": service,
                "item_key": key,
                "label": label,
                "completed": False,
                "completed_at": None,
                "completed_by": None,
            })
        except Exception:
            pass  # unique index race — safe to ignore


async def _purge_onboarding(workspace_id: str, service: str) -> None:
    await db.onboarding_items.delete_many({
        "workspace_id": workspace_id, "service": service
    })


async def _recompute_onboarding_status(workspace_id: str) -> dict:
    items = await db.onboarding_items.find(
        {"workspace_id": workspace_id}
    ).to_list(500)
    if not items:
        complete = False
    else:
        complete = all(i.get("completed") for i in items)
    updates: dict = {"onboarding_complete": complete}
    if complete:
        updates["onboarding_completed_at"] = now_utc().isoformat()
    else:
        updates["onboarding_completed_at"] = None
    res = await db.workspaces.find_one_and_update(
        {"_id": ObjectId(workspace_id)}, {"$set": updates}, return_document=True
    )
    return res


@router.get("/{client_id}/workspace")
async def get_workspace(
    client_id: str, operator: dict = Depends(get_current_operator)
):
    if not await can_access_client(operator, client_id):
        raise HTTPException(status_code=403, detail="Not authorized for this client")
    ws = await _workspace_for_client(client_id)
    return serialize_workspace(ws)


@router.patch("/{client_id}/workspace/services")
async def toggle_services(
    client_id: str,
    payload: ServicesToggleIn,
    _: dict = Depends(require_role("admin", "manager")),
):
    ws = await _workspace_for_client(client_id)
    ws_id = str(ws["_id"])

    requested = payload.model_dump(exclude_unset=True)
    if not requested:
        raise HTTPException(status_code=400, detail="No services specified")

    updates: dict = {}
    for service, enabled in requested.items():
        if service not in SERVICE_KEYS:
            continue
        flag = f"{service}_enabled"
        was_on = bool(ws.get(flag))
        updates[flag] = bool(enabled)
        if enabled and not was_on:
            await _generate_onboarding(ws_id, service)
        elif not enabled and was_on:
            await _purge_onboarding(ws_id, service)

    if updates:
        await db.workspaces.update_one(
            {"_id": ws["_id"]}, {"$set": updates}
        )

    # If every service is now disabled, also purge the 'common' bucket so the
    # workspace doesn't sit forever with un-completable items.
    fresh = await db.workspaces.find_one({"_id": ws["_id"]}) or ws
    if not any(fresh.get(f"{s}_enabled") for s in SERVICE_KEYS):
        await _purge_onboarding(ws_id, "common")

    # Recompute onboarding_complete (may flip if all remaining items done)
    updated_ws = await _recompute_onboarding_status(ws_id)
    return serialize_workspace(updated_ws or ws)
