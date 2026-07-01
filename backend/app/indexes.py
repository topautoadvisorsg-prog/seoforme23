"""MongoDB index creation. Runs once at app startup.

A failure here MUST NOT crash the app — log it and continue. Indexes are an
optimization, not a correctness requirement. The app can serve traffic while
indexes build in the background.
"""
import logging

from pymongo.errors import OperationFailure

from app.db import db

logger = logging.getLogger("smartclix.indexes")


INDEX_SPECS = [
    # (collection_name, [keys], kwargs)
    ("operators", "email", {"unique": True}),
    ("login_attempts", "identifier", {"unique": True}),
    ("password_reset_tokens", "expires_at", {"expireAfterSeconds": 0}),
    ("password_reset_tokens", "token", {}),
    ("clients", "assigned_to", {}),
    ("clients", "status", {}),
    ("workspaces", "client_id", {"unique": True}),
    ("client_access", [("client_id", 1), ("operator_id", 1)], {"unique": True}),
    ("mcp_connections", [("workspace_id", 1), ("service_name", 1)], {"unique": True}),
    ("onboarding_items", [("workspace_id", 1), ("item_key", 1)], {"unique": True}),
    ("approval_queue", "workspace_id", {}),
    ("approval_queue", [("status", 1), ("created_at", -1)], {}),
    ("notifications", [("operator_id", 1), ("read_at", 1)], {}),
    ("activity_log", [("workspace_id", 1), ("created_at", -1)], {}),
]


async def ensure_indexes() -> None:
    for collection, keys, kwargs in INDEX_SPECS:
        try:
            await db[collection].create_index(keys, **kwargs)
        except OperationFailure as exc:
            logger.warning(
                "Index creation failed on %s(%s): %s — continuing",
                collection,
                keys,
                exc,
            )
