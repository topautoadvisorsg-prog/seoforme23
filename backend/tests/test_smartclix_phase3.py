"""SmartClix Phase 3 backend tests — Approval Queue state machine + RBAC scope."""
import uuid
from datetime import datetime, timedelta, timezone

import pytest
from conftest import API


@pytest.fixture
def demo_client(admin_session):
    """Create a client (auto-creates workspace), yield (client_id, workspace_id)."""
    body = admin_session.post(
        f"{API}/clients", json={"name": f"TEST_Appv_{uuid.uuid4().hex[:6]}"}
    ).json()
    yield body["id"], body["workspace_id"]
    admin_session.delete(f"{API}/clients/{body['id']}")


class TestApprovalQueue:
    def test_list_shows_item_and_counts(self, admin_session, demo_client, approval_factory):
        _, ws_id = demo_client
        aid = approval_factory(ws_id, title="TEST list item")
        r = admin_session.get(f"{API}/approvals", params={"workspace_id": ws_id})
        assert r.status_code == 200, r.text
        body = r.json()
        assert any(i["id"] == aid for i in body["items"])
        assert body["counts"].get("pending", 0) >= 1

    def test_approve_transitions_and_sets_reviewer(self, admin_session, demo_client, approval_factory):
        _, ws_id = demo_client
        aid = approval_factory(ws_id)
        r = admin_session.post(f"{API}/approvals/{aid}/approve", json={"review_notes": "ok"})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "approved"
        assert body["reviewed_by"]
        # Phase 4: active-client approval triggers (mocked) execution → success
        assert body["execution_status"] == "success"

    def test_reject_requires_notes(self, admin_session, demo_client, approval_factory):
        _, ws_id = demo_client
        aid = approval_factory(ws_id)
        # missing notes -> 422 validation
        assert admin_session.post(f"{API}/approvals/{aid}/reject", json={}).status_code == 422
        r = admin_session.post(f"{API}/approvals/{aid}/reject", json={"review_notes": "off brand"})
        assert r.status_code == 200
        assert r.json()["status"] == "rejected"

    def test_flag_toggles(self, admin_session, demo_client, approval_factory):
        _, ws_id = demo_client
        aid = approval_factory(ws_id)
        assert admin_session.post(f"{API}/approvals/{aid}/flag").json()["flagged"] is True
        assert admin_session.post(f"{API}/approvals/{aid}/flag").json()["flagged"] is False

    def test_edit_keeps_pending(self, admin_session, demo_client, approval_factory):
        _, ws_id = demo_client
        aid = approval_factory(ws_id)
        r = admin_session.patch(f"{API}/approvals/{aid}", json={"payload": {"title": "edited"}})
        assert r.status_code == 200
        assert r.json()["status"] == "pending"
        assert r.json()["payload"]["title"] == "edited"

    def test_stale_social_post_blocks_approve(self, admin_session, demo_client, approval_factory):
        _, ws_id = demo_client
        old = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
        aid = approval_factory(ws_id, item_type="social_post", original_scheduled_time=old)
        r = admin_session.post(f"{API}/approvals/{aid}/approve", json={})
        assert r.status_code == 409
        # item is now marked stale
        g = admin_session.get(f"{API}/approvals/{aid}").json()
        assert g["status"] == "stale"

    def test_requeue_resets_to_pending(self, admin_session, demo_client, approval_factory):
        _, ws_id = demo_client
        aid = approval_factory(ws_id, status="rejected", review_notes="nope")
        r = admin_session.post(f"{API}/approvals/{aid}/requeue")
        assert r.status_code == 200
        assert r.json()["status"] == "pending"

    def test_approve_writes_client_activity(self, admin_session, demo_client, approval_factory):
        cid, ws_id = demo_client
        aid = approval_factory(ws_id, title="TEST activity item")
        admin_session.post(f"{API}/approvals/{aid}/approve", json={})
        rows = admin_session.get(f"{API}/clients/{cid}/activity").json()
        assert any(r["action"] == "approval.approved" for r in rows)

    def test_delete_removes(self, admin_session, demo_client, approval_factory):
        _, ws_id = demo_client
        aid = approval_factory(ws_id)
        assert admin_session.delete(f"{API}/approvals/{aid}").status_code == 200
        assert admin_session.get(f"{API}/approvals/{aid}").status_code == 404


class TestApprovalRBAC:
    def test_reviewer_cannot_see_unassigned(self, reviewer_session, admin_session, demo_client, approval_factory):
        _, ws_id = demo_client
        aid = approval_factory(ws_id)
        # reviewer has no assignment to this client
        items = reviewer_session.get(f"{API}/approvals").json()["items"]
        assert all(i["id"] != aid for i in items)
        assert reviewer_session.get(f"{API}/approvals/{aid}").status_code == 403

    def test_reviewer_cannot_delete(self, reviewer_session, demo_client, approval_factory):
        _, ws_id = demo_client
        aid = approval_factory(ws_id)
        assert reviewer_session.delete(f"{API}/approvals/{aid}").status_code == 403
