import os
import pytest
import requests
import pymongo
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://spec-correct-build.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")

ADMIN_EMAIL = "admin@smartclix.app"
ADMIN_PASSWORD = "Admin#12345"
REVIEWER_EMAIL = "reviewer@smartclix.app"
REVIEWER_PASSWORD = "Reviewer#12345"


@pytest.fixture
def fresh_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture
def admin_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Admin login failed: {r.status_code} {r.text}")
    return s


@pytest.fixture
def reviewer_session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": REVIEWER_EMAIL, "password": REVIEWER_PASSWORD})
    if r.status_code != 200:
        pytest.skip(f"Reviewer login failed: {r.status_code} {r.text}")
    return s


# ---- direct-DB approval seeding (no create endpoint until the Phase 4 webhook) ----
_mongo = pymongo.MongoClient(os.environ.get("MONGO_URL", "mongodb://localhost:27017"))
_db = _mongo[os.environ.get("DB_NAME", "smartclix")]


@pytest.fixture
def approval_factory():
    """Insert approval_queue docs directly and clean them up after the test."""
    created = []

    def _make(workspace_id, **over):
        doc = {
            "workspace_id": workspace_id,
            "item_type": "blog_post",
            "title": "TEST approval",
            "status": "pending",
            "payload": {"title": "draft"},
            "flagged": False,
            "execution_status": "not_started",
            "created_at": "2026-01-01T00:00:00+00:00",
        }
        doc.update(over)
        res = _db.approval_queue.insert_one(doc)
        created.append(res.inserted_id)
        return str(res.inserted_id)

    yield _make
    if created:
        _db.approval_queue.delete_many({"_id": {"$in": created}})
