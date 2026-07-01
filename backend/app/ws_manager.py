"""WebSocket connection manager.

Tracks live connections per operator and provides scoped broadcast helpers.
Lives at module scope so all routes share the same registry.
"""
import asyncio
import json
import logging
from collections import defaultdict
from typing import Optional

from fastapi import WebSocket

from app.authz import authorized_client_ids
from app.db import db

logger = logging.getLogger("smartclix.ws")


class ConnectionRegistry:
    def __init__(self) -> None:
        # operator_id -> set of live WebSocket objects (multiple tabs OK)
        self._conns: dict[str, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def add(self, operator_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._conns[operator_id].add(ws)

    async def remove(self, operator_id: str, ws: WebSocket) -> None:
        async with self._lock:
            self._conns[operator_id].discard(ws)
            if not self._conns[operator_id]:
                self._conns.pop(operator_id, None)

    async def send_to_operator(self, operator_id: str, message: dict) -> None:
        sockets = list(self._conns.get(operator_id, ()))
        for ws in sockets:
            try:
                await ws.send_text(json.dumps(message))
            except Exception as exc:
                logger.warning("WS send to %s failed: %s", operator_id, exc)
                await self.remove(operator_id, ws)

    async def broadcast_to_workspace(
        self, workspace_id: str, message: dict
    ) -> None:
        """Push `message` to every connected operator authorized for the
        workspace's client. Used for approval/notification events.
        """
        ws_doc = await db.workspaces.find_one({"_id": _oid(workspace_id)})
        if not ws_doc:
            return
        client_id = ws_doc["client_id"]
        # Build set of operator_ids who should receive
        recipients = set()
        # Anyone who's an admin/manager: send to all currently connected
        for operator_id in list(self._conns.keys()):
            op = await db.operators.find_one({"_id": _oid(operator_id)})
            if not op:
                continue
            if op["role"] in ("admin", "manager"):
                recipients.add(operator_id)
                continue
            scope = await authorized_client_ids(op)
            if scope is None or client_id in scope:
                recipients.add(operator_id)
        for op_id in recipients:
            await self.send_to_operator(op_id, message)


def _oid(s):
    from bson import ObjectId
    return ObjectId(s)


# Singleton — imported by routes
registry = ConnectionRegistry()
