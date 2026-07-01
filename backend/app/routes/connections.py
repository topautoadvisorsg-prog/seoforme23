"""MCP connections — encrypted credential storage per service per workspace.

Credentials are encrypted with Fernet (see app/crypto.py). They are NEVER
returned to the client in plaintext. The GET endpoint returns metadata + a
`display_fields` map where secret fields are masked.

Phase 4 will add `POST /test` which decrypts and pings the actual service.
"""
from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException

from app.authz import can_access_client
from app.crypto import encrypt_dict, mask
from app.db import db
from app.deps import get_current_operator, require_role
from app.models import ConnectionUpsert, serialize_connection
from app.routes.workspaces import _workspace_for_client
from app.security import now_utc
from app.services_registry import MCP_FIELDS, applicable_mcps

router = APIRouter()


def _display_fields(service_name: str, plaintext: dict) -> dict:
    """Return a UI-safe view: secrets masked, non-secrets passthrough."""
    spec = MCP_FIELDS.get(service_name, {}).get("fields", [])
    out: dict = {}
    for f in spec:
        key = f["key"]
        value = plaintext.get(key)
        if f.get("secret"):
            out[key] = mask(value) if value else ""
        else:
            out[key] = value
    return out


@router.get("/{client_id}/connections")
async def list_connections(
    client_id: str, operator: dict = Depends(get_current_operator)
):
    if not await can_access_client(operator, client_id):
        raise HTTPException(status_code=403, detail="Not authorized for this client")
    ws = await _workspace_for_client(client_id)
    ws_id = str(ws["_id"])

    applicable = applicable_mcps(ws)
    existing = {
        c["service_name"]: c
        for c in await db.mcp_connections.find({"workspace_id": ws_id}).to_list(50)
    }

    out = []
    for service_name in applicable:
        cfg = MCP_FIELDS[service_name]
        doc = existing.get(service_name)
        if doc is None:
            # Not yet configured — return a placeholder so the UI renders the form
            out.append({
                "id": None,
                "workspace_id": ws_id,
                "service_name": service_name,
                "label": cfg["label"],
                "status": "not_configured",
                "display_fields": {},
                "fields_spec": cfg["fields"],
                "token_last_verified": None,
                "token_expires_at": None,
                "last_error": None,
            })
        else:
            serialized = serialize_connection(doc, cfg["fields"])
            serialized["label"] = cfg["label"]
            out.append(serialized)
    return {"workspace_id": ws_id, "connections": out}


@router.put("/{client_id}/connections/{service_name}")
async def upsert_connection(
    client_id: str,
    service_name: str,
    payload: ConnectionUpsert,
    _: dict = Depends(require_role("admin", "manager")),
):
    if service_name not in MCP_FIELDS:
        raise HTTPException(status_code=400, detail="Unknown service")
    ws = await _workspace_for_client(client_id)
    ws_id = str(ws["_id"])

    # Only accept keys defined in the field spec — silently drop unknowns
    allowed_keys = {f["key"] for f in MCP_FIELDS[service_name]["fields"]}
    clean = {k: v for k, v in payload.credentials.items() if k in allowed_keys}

    doc = {
        "workspace_id": ws_id,
        "service_name": service_name,
        "status": "connected",
        "credentials_enc": encrypt_dict(clean),
        "display_fields": _display_fields(service_name, clean),
        "token_last_verified": now_utc().isoformat(),
        "last_error": None,
        "updated_at": now_utc().isoformat(),
    }
    existing = await db.mcp_connections.find_one(
        {"workspace_id": ws_id, "service_name": service_name}
    )
    if existing:
        await db.mcp_connections.update_one(
            {"_id": existing["_id"]}, {"$set": doc}
        )
        doc["_id"] = existing["_id"]
        doc["created_at"] = existing.get("created_at")
    else:
        doc["created_at"] = now_utc().isoformat()
        res = await db.mcp_connections.insert_one(doc)
        doc["_id"] = res.inserted_id

    serialized = serialize_connection(doc, MCP_FIELDS[service_name]["fields"])
    serialized["label"] = MCP_FIELDS[service_name]["label"]
    return serialized


@router.delete("/{client_id}/connections/{service_name}")
async def delete_connection(
    client_id: str,
    service_name: str,
    _: dict = Depends(require_role("admin", "manager")),
):
    ws = await _workspace_for_client(client_id)
    res = await db.mcp_connections.delete_one({
        "workspace_id": str(ws["_id"]),
        "service_name": service_name,
    })
    if res.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Connection not found")
    return {"ok": True}


@router.post("/{client_id}/connections/{service_name}/test")
async def test_connection(
    client_id: str,
    service_name: str,
    _: dict = Depends(require_role("admin", "manager")),
):
    """Phase 2: smoke test — confirms credentials exist & decrypt cleanly.
    Phase 4: will actually ping the upstream service.
    """
    from app.crypto import decrypt_dict
    from cryptography.fernet import InvalidToken

    ws = await _workspace_for_client(client_id)
    record = await db.mcp_connections.find_one({
        "workspace_id": str(ws["_id"]),
        "service_name": service_name,
    })
    if not record:
        raise HTTPException(status_code=404, detail="Connection not configured")
    try:
        decrypted = decrypt_dict(record["credentials_enc"])
    except InvalidToken:
        raise HTTPException(
            status_code=500,
            detail="Credentials cannot be decrypted — FERNET_KEY may have changed.",
        )
    # Stub success — Phase 4 will replace with real ping
    await db.mcp_connections.update_one(
        {"_id": record["_id"]},
        {"$set": {
            "token_last_verified": now_utc().isoformat(),
            "status": "connected",
        }},
    )
    return {
        "ok": True,
        "tested_at": now_utc().isoformat(),
        "stub": True,
        "field_count": len(decrypted),
    }
