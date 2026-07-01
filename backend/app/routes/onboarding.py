"""Onboarding checklist endpoints.

List items for a client's workspace and mark items complete / uncomplete.
When the last item is checked, the workspace flips to onboarding_complete.
"""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.authz import can_access_client
from app.db import db
from app.deps import get_current_operator, require_role
from app.models import OnboardingItemUpdate, serialize_onboarding_item
from app.routes.workspaces import _recompute_onboarding_status, _workspace_for_client
from app.security import now_utc

# Client-scoped list endpoint
router = APIRouter()
# Item-scoped patch endpoint (no /clients prefix)
items_router = APIRouter()


@router.get("/{client_id}/onboarding")
async def list_items(
    client_id: str, operator: dict = Depends(get_current_operator)
):
    if not await can_access_client(operator, client_id):
        raise HTTPException(status_code=403, detail="Not authorized for this client")
    ws = await _workspace_for_client(client_id)
    items = await db.onboarding_items.find(
        {"workspace_id": str(ws["_id"])}
    ).to_list(500)
    # Sort: common first, then by service alphabetic, then by item_key
    items.sort(key=lambda d: (0 if d["service"] == "common" else 1, d["service"], d["item_key"]))
    return {
        "workspace_id": str(ws["_id"]),
        "items": [serialize_onboarding_item(i) for i in items],
        "completed_count": sum(1 for i in items if i.get("completed")),
        "total_count": len(items),
        "onboarding_complete": ws.get("onboarding_complete", False),
    }


@items_router.patch("/onboarding-items/{item_id}")
async def update_item(
    item_id: str,
    payload: OnboardingItemUpdate,
    operator: dict = Depends(require_role("admin", "manager", "reviewer")),
):
    item = await db.onboarding_items.find_one({"_id": ObjectId(item_id)})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Reviewer can only edit items for clients they own
    ws = await db.workspaces.find_one({"_id": ObjectId(item["workspace_id"])})
    if ws and not await can_access_client(operator, ws["client_id"]):
        raise HTTPException(status_code=403, detail="Not authorized")

    updates: dict = {"completed": payload.completed}
    if payload.completed:
        updates["completed_at"] = now_utc().isoformat()
        updates["completed_by"] = str(operator["_id"])
    else:
        updates["completed_at"] = None
        updates["completed_by"] = None

    res = await db.onboarding_items.find_one_and_update(
        {"_id": ObjectId(item_id)}, {"$set": updates}, return_document=True
    )
    await _recompute_onboarding_status(item["workspace_id"])
    return serialize_onboarding_item(res)
