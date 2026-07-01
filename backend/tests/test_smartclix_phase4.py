"""SmartClix Phase 4 tests — Cowork webhook receiver + mocked execution."""
import uuid

import pytest
import requests
from conftest import API, WEBHOOK_SECRET, _db


pytestmark = pytest.mark.skipif(not WEBHOOK_SECRET, reason="WEBHOOK_SECRET not set")

WH = f"{API}/webhooks/cowork"
HDR = {"x-webhook-secret": WEBHOOK_SECRET}


@pytest.fixture
def wh_client(admin_session):
    """Create a client, yield (client_id, workspace_id), wipe side collections after."""
    body = admin_session.post(f"{API}/clients", json={"name": f"TEST_WH_{uuid.uuid4().hex[:6]}"}).json()
    cid, ws_id = body["id"], body["workspace_id"]
    yield cid, ws_id
    admin_session.delete(f"{API}/clients/{cid}")
    for coll in ("analytics_snapshots", "cost_log", "notifications", "activity_log", "approval_queue"):
        _db[coll].delete_many({"workspace_id": ws_id})


class TestWebhookAuth:
    def test_missing_secret_401(self, wh_client):
        _, ws_id = wh_client
        r = requests.post(WH, json={"workspace_id": ws_id, "item_type": "blog_post", "payload": {}})
        assert r.status_code == 401

    def test_wrong_secret_401(self, wh_client):
        _, ws_id = wh_client
        r = requests.post(WH, json={"workspace_id": ws_id, "item_type": "blog_post", "payload": {}},
                          headers={"x-webhook-secret": "wrong"})
        assert r.status_code == 401

    def test_unknown_workspace_404(self):
        r = requests.post(WH, json={"workspace_id": "ffffffffffffffffffffffff", "item_type": "blog_post", "payload": {}}, headers=HDR)
        assert r.status_code == 404

    def test_bad_workspace_id_404(self):
        r = requests.post(WH, json={"workspace_id": "not-an-objectid", "item_type": "blog_post", "payload": {}}, headers=HDR)
        assert r.status_code == 404


class TestWebhookRouting:
    def test_approval_item_lands_in_queue(self, admin_session, wh_client):
        _, ws_id = wh_client
        r = requests.post(WH, json={"workspace_id": ws_id, "item_type": "social_batch",
                                    "title": "WH batch", "payload": {"posts": []}}, headers=HDR)
        assert r.status_code == 200, r.text
        assert r.json()["routed_to"] == "approval_queue"
        items = admin_session.get(f"{API}/approvals", params={"workspace_id": ws_id}).json()["items"]
        assert any(i["title"] == "WH batch" for i in items)

    def test_analytics_snapshot_silent(self, wh_client):
        _, ws_id = wh_client
        r = requests.post(WH, json={"workspace_id": ws_id, "item_type": "analytics_snapshot",
                                    "payload": {"snapshot_type": "rankings", "data": {"k": 1}}}, headers=HDR)
        assert r.status_code == 200 and r.json()["routed_to"] == "analytics_snapshots"
        assert _db.analytics_snapshots.count_documents({"workspace_id": ws_id}) >= 1

    def test_cost_report_upsert(self, wh_client):
        _, ws_id = wh_client
        body = {"workspace_id": ws_id, "item_type": "cost_report",
                "payload": {"month": "2026-06-01", "service": "ads", "estimated_cost": 50}}
        requests.post(WH, json=body, headers=HDR)
        requests.post(WH, json=body, headers=HDR)  # second call should upsert, not duplicate
        assert _db.cost_log.count_documents({"workspace_id": ws_id, "month": "2026-06-01", "service": "ads"}) == 1

    def test_agent_run_to_activity(self, admin_session, wh_client):
        cid, ws_id = wh_client
        requests.post(WH, json={"workspace_id": ws_id, "item_type": "agent_run",
                                "payload": {"action": "agent.seo_scan"}}, headers=HDR)
        rows = admin_session.get(f"{API}/clients/{cid}/activity").json()
        assert any(r["actor"] == "agent" for r in rows)

    def test_agent_failure_notification(self, wh_client):
        _, ws_id = wh_client
        requests.post(WH, json={"workspace_id": ws_id, "item_type": "agent_failure",
                                "title": "boom", "payload": {"error": "timeout"}}, headers=HDR)
        assert _db.notifications.count_documents({"workspace_id": ws_id, "type": "agent_failure"}) >= 1

    def test_unknown_item_type_400(self, wh_client):
        _, ws_id = wh_client
        r = requests.post(WH, json={"workspace_id": ws_id, "item_type": "nonsense", "payload": {}}, headers=HDR)
        assert r.status_code == 400


class TestWebhookClientState:
    def test_churned_410(self, admin_session, wh_client):
        cid, ws_id = wh_client
        admin_session.patch(f"{API}/clients/{cid}/status", json={"status": "churned"})
        r = requests.post(WH, json={"workspace_id": ws_id, "item_type": "blog_post", "payload": {}}, headers=HDR)
        assert r.status_code == 410

    def test_paused_flags_item(self, admin_session, wh_client):
        cid, ws_id = wh_client
        admin_session.patch(f"{API}/clients/{cid}/status", json={"status": "paused"})
        r = requests.post(WH, json={"workspace_id": ws_id, "item_type": "blog_post",
                                    "title": "paused item", "payload": {}}, headers=HDR)
        assert r.json()["client_paused"] is True
        items = admin_session.get(f"{API}/approvals", params={"workspace_id": ws_id}).json()["items"]
        it = next(i for i in items if i["title"] == "paused item")
        assert it["payload"].get("_client_paused") is True


class TestExecutionOnApprove:
    def test_approve_executes(self, admin_session, wh_client):
        _, ws_id = wh_client
        r = requests.post(WH, json={"workspace_id": ws_id, "item_type": "blog_post",
                                    "title": "exec me", "payload": {"title": "x"}}, headers=HDR)
        aid = r.json()["id"]
        appr = admin_session.post(f"{API}/approvals/{aid}/approve", json={}).json()
        assert appr["status"] == "approved"
        assert appr["execution_status"] == "success"
        assert appr["execution_target"] == "WordPress"

    def test_paused_client_not_auto_executed(self, admin_session, wh_client):
        cid, ws_id = wh_client
        r = requests.post(WH, json={"workspace_id": ws_id, "item_type": "blog_post",
                                    "title": "paused exec", "payload": {}}, headers=HDR)
        aid = r.json()["id"]
        admin_session.patch(f"{API}/clients/{cid}/status", json={"status": "paused"})
        appr = admin_session.post(f"{API}/approvals/{aid}/approve", json={}).json()
        assert appr["status"] == "approved"
        assert appr["execution_status"] == "not_started"
