"""Simulate a Cowork agent posting to the dashboard webhook.

This is the reference for what Cowork must send: POST to /api/webhooks/cowork
with the shared `x-webhook-secret` header and a {workspace_id, item_type,
title, payload} body. Run it to drop a live item into a client's queue.

    .venv\\Scripts\\python -m scripts.send_test_webhook

Picks the "Demo Co" workspace (or the first one) automatically.
"""
import os
from pathlib import Path

import requests
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

SECRET = os.environ["WEBHOOK_SECRET"]
BASE = os.environ.get("BACKEND_URL", "http://127.0.0.1:8001")

db = MongoClient(os.environ["MONGO_URL"])[os.environ.get("DB_NAME", "smartclix")]
client = db.clients.find_one({"name": "Demo Co"}) or db.clients.find_one({})
if not client:
    raise SystemExit("No clients found — create one in the dashboard first.")
ws = db.workspaces.find_one({"client_id": str(client["_id"])})
workspace_id = str(ws["_id"])

payload = {
    "workspace_id": workspace_id,
    "item_type": "social_batch",
    "title": "Webhook demo — weekly social batch",
    "payload": {
        "posts": [
            {"platform": "instagram", "caption": "Posted by a simulated Cowork agent 🤖"},
            {"platform": "facebook", "caption": "This arrived via POST /api/webhooks/cowork"},
        ]
    },
}

r = requests.post(
    f"{BASE}/api/webhooks/cowork",
    json=payload,
    headers={"x-webhook-secret": SECRET},
    timeout=15,
)
print(f"-> {client['name']} (workspace {workspace_id})")
print(f"{r.status_code}: {r.text}")
