"""Dev-only seed: inject sample approval-queue items so the Phase 3 UI has
data to show before the Phase 4 Cowork webhook exists.

Run from backend/ with the venv:
    .venv\\Scripts\\python -m scripts.seed_approvals

Idempotent: removes any prior items it created (title prefixed "[DEMO]")
before re-inserting. Creates a "Demo Co" client + workspace if absent.
"""
import os
from datetime import datetime, timedelta, timezone
from pathlib import Path

from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

client = MongoClient(os.environ["MONGO_URL"])
db = client[os.environ.get("DB_NAME", "smartclix")]


def now():
    return datetime.now(timezone.utc).isoformat()


def ensure_demo_workspace() -> str:
    c = db.clients.find_one({"name": "Demo Co"})
    if not c:
        res = db.clients.insert_one({
            "name": "Demo Co",
            "website_url": "https://democo.example",
            "industry": "Home Services",
            "location": {"city": "Austin", "state": "TX", "country": "US"},
            "status": "active",
            "assigned_to": None,
            "created_at": now(),
        })
        client_id = str(res.inserted_id)
    else:
        client_id = str(c["_id"])

    w = db.workspaces.find_one({"client_id": client_id})
    if not w:
        res = db.workspaces.insert_one({
            "client_id": client_id,
            "seo_enabled": True, "gbp_enabled": True, "social_enabled": True,
            "meta_ads_enabled": True, "google_ads_enabled": False,
            "lsa_enabled": False, "linkedin_ads_enabled": False, "video_enabled": True,
            "onboarding_complete": True,
            "created_at": now(),
        })
        return str(res.inserted_id)
    return str(w["_id"])


def seed(workspace_id: str):
    db.approval_queue.delete_many({"title": {"$regex": "^\\[DEMO\\]"}})

    future = (datetime.now(timezone.utc) + timedelta(days=1)).isoformat()
    long_past = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()

    items = [
        {
            "item_type": "social_batch",
            "title": "[DEMO] Weekly social batch — 3 posts",
            "status": "pending",
            "original_scheduled_time": future,
            "payload": {"posts": [
                {"platform": "instagram", "caption": "Spring AC tune-up season is here ☀️ Book now and beat the heat.", "scheduled": future},
                {"platform": "facebook", "caption": "Did you know a clogged filter can raise your power bill 15%? We'll sort it.", "scheduled": future},
                {"platform": "linkedin", "caption": "We just wrapped a full commercial HVAC retrofit downtown. Case study soon.", "scheduled": future},
            ]},
        },
        {
            "item_type": "blog_post",
            "title": "[DEMO] Blog: 7 Signs Your AC Needs Repair",
            "status": "pending",
            "payload": {"title": "7 Signs Your AC Needs Repair Before Summer",
                        "meta_description": "Spot these warning signs early and avoid a costly breakdown.",
                        "body": "Your air conditioner rarely fails without warning. Here are the seven signs...\n\n1. Warm air from the vents\n2. Weak airflow\n3. Strange noises\n4. Bad odors\n5. High humidity indoors\n6. Frequent cycling\n7. Rising energy bills"},
        },
        {
            "item_type": "ads_recommendation",
            "title": "[DEMO] Google Ads: shift budget to 'emergency AC repair'",
            "status": "pending",
            "payload": {"recommendation": "Move $400/mo from the broad 'HVAC' campaign to the high-intent 'emergency AC repair' ad group.",
                        "rationale": "Emergency intent converts at 8.2% vs 2.1% for broad terms over the last 30 days.",
                        "estimated_impact": "+11 leads/mo at a lower CPL"},
        },
        {
            "item_type": "video_script",
            "title": "[DEMO] Video script: 'Meet the Team' 30s",
            "status": "pending",
            "payload": {"duration": "30s",
                        "script": "[Open on tech waving]\nVO: At Demo Co, we treat your home like our own.\n[Shots of work]\nVO: Licensed, insured, and on time — every time.\n[Logo]\nVO: Demo Co. Comfort you can count on."},
        },
        {
            "item_type": "gbp_review",
            "title": "[DEMO] Reply to 3-star Google review",
            "status": "pending",
            "payload": {"review_rating": 3,
                        "review_text": "Service was fine but they showed up an hour late.",
                        "draft_reply": "Thank you for the feedback, and we're sorry about the delay. We've tightened our scheduling and would love to make it right — please reach out to us directly."},
        },
        {
            "item_type": "social_post",
            "title": "[DEMO] Stale post (scheduled 2 days ago)",
            "status": "pending",
            "original_scheduled_time": long_past,
            "payload": {"platform": "instagram", "caption": "This one is past its scheduled time — approving should flag it stale."},
        },
        {
            "item_type": "blog_post",
            "title": "[DEMO] Already approved: Furnace maintenance guide",
            "status": "approved",
            "reviewed_at": now(),
            "payload": {"title": "Furnace Maintenance 101"},
        },
        {
            "item_type": "ads_recommendation",
            "title": "[DEMO] Rejected: increase display spend",
            "status": "rejected",
            "reviewed_at": now(),
            "review_notes": "Display has poor ROAS for this client — skip.",
            "payload": {"recommendation": "Add $600/mo display campaign."},
        },
    ]

    for it in items:
        it.setdefault("workspace_id", workspace_id)
        it.setdefault("flagged", False)
        it.setdefault("execution_status", "not_started")
        it.setdefault("created_at", now())
        it["workspace_id"] = workspace_id
    db.approval_queue.insert_many(items)
    return len(items)


if __name__ == "__main__":
    ws_id = ensure_demo_workspace()
    n = seed(ws_id)
    print(f"Seeded {n} demo approval items into workspace {ws_id}")
