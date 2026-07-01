"""Authorization helpers.

`authorized_client_ids(operator)` returns:
  - None  if operator is admin/manager (no scope filter — sees everything)
  - list[str] if operator is reviewer (only their assigned clients)

Use in every list query that scopes by client/workspace.
"""
from typing import Optional

from app.db import db


async def authorized_client_ids(operator: dict) -> Optional[list[str]]:
    """None = unrestricted (admin/manager). List = scoped to these ids."""
    if operator["role"] in ("admin", "manager"):
        return None
    op_id = str(operator["_id"])
    # Primary: clients where operator is the owner
    own = await db.clients.find({"assigned_to": op_id}, {"_id": 1}).to_list(500)
    own_ids = [str(c["_id"]) for c in own]
    # client_access join (Phase 2+ multi-reviewer support — table may be empty)
    extra = await db.client_access.find(
        {"operator_id": op_id}, {"client_id": 1}
    ).to_list(500)
    extra_ids = [c["client_id"] for c in extra]
    return list(set(own_ids + extra_ids))


async def can_access_client(operator: dict, client_id: str) -> bool:
    scope = await authorized_client_ids(operator)
    if scope is None:
        return True
    return client_id in scope
