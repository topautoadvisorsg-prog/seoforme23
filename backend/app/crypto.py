"""Fernet symmetric encryption for stored credentials.

Credentials (MCP API keys, OAuth tokens) are encrypted at rest. The plaintext
NEVER leaves the server: routes that return connections always send masked
metadata, and only execution handlers (Phase 4) ever call `decrypt_dict`.
"""
import json
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.config import FERNET_KEY


def _fernet() -> Fernet:
    if not FERNET_KEY:
        raise RuntimeError(
            "FERNET_KEY env var is missing. Generate one with: "
            "python -c \"from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())\""
        )
    return Fernet(FERNET_KEY.encode("utf-8"))


def encrypt_dict(data: dict) -> str:
    """Serialize a dict to an encrypted base64-ish string."""
    return _fernet().encrypt(json.dumps(data).encode("utf-8")).decode("utf-8")


def decrypt_dict(blob: str) -> dict:
    """Reverse of encrypt_dict. Raises InvalidToken on tampering / wrong key."""
    return json.loads(_fernet().decrypt(blob.encode("utf-8")).decode("utf-8"))


def mask(value: Optional[str], visible: int = 4) -> str:
    """Mask a credential for safe display in the UI (last N chars)."""
    if not value:
        return ""
    s = str(value)
    if len(s) <= visible:
        return "•" * len(s)
    return "•" * (len(s) - visible) + s[-visible:]
