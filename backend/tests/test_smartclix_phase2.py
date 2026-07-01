"""SmartClix Phase 2 backend tests — Clients, Workspaces, Onboarding, MCP Connections."""
import uuid
import pytest
from conftest import API


# ---------------- Clients CRUD ----------------
class TestClientsCRUD:
    def test_admin_create_client_auto_creates_workspace(self, admin_session):
        name = f"TEST_Client_{uuid.uuid4().hex[:8]}"
        payload = {"name": name, "website_url": "https://example.com", "industry": "Plumbing"}
        r = admin_session.post(f"{API}/clients", json=payload)
        assert r.status_code == 201, r.text
        body = r.json()
        assert body["name"] == name
        assert body["status"] == "active"
        assert "workspace_id" in body and body["workspace_id"]
        assert "services" in body
        # All services disabled by default
        assert all(v is False for v in body["services"].values())
        assert set(body["services"].keys()) == {
            "seo", "gbp", "social", "meta_ads", "google_ads", "lsa", "linkedin_ads", "video"
        }
        # Cleanup
        admin_session.delete(f"{API}/clients/{body['id']}")

    def test_reviewer_cannot_create_client(self, reviewer_session):
        r = reviewer_session.post(f"{API}/clients", json={"name": "TEST_nope"})
        assert r.status_code == 403

    def test_admin_list_includes_created_client(self, admin_session):
        name = f"TEST_List_{uuid.uuid4().hex[:8]}"
        cid = admin_session.post(f"{API}/clients", json={"name": name}).json()["id"]
        try:
            r = admin_session.get(f"{API}/clients")
            assert r.status_code == 200
            assert any(c["id"] == cid for c in r.json())
        finally:
            admin_session.delete(f"{API}/clients/{cid}")

    def test_get_client_returns_workspace_and_services(self, admin_session):
        cid = admin_session.post(f"{API}/clients", json={"name": f"TEST_Get_{uuid.uuid4().hex[:6]}"}).json()["id"]
        try:
            r = admin_session.get(f"{API}/clients/{cid}")
            assert r.status_code == 200
            body = r.json()
            assert body["workspace_id"]
            assert "services" in body and isinstance(body["services"], dict)
        finally:
            admin_session.delete(f"{API}/clients/{cid}")

    def test_patch_client_updates_fields(self, admin_session):
        cid = admin_session.post(f"{API}/clients", json={"name": f"TEST_Patch_{uuid.uuid4().hex[:6]}"}).json()["id"]
        try:
            r = admin_session.patch(f"{API}/clients/{cid}", json={"industry": "HVAC", "name": "TEST_Renamed"})
            assert r.status_code == 200
            assert r.json()["industry"] == "HVAC"
            assert r.json()["name"] == "TEST_Renamed"
            # Verify persisted via GET
            g = admin_session.get(f"{API}/clients/{cid}").json()
            assert g["industry"] == "HVAC"
            assert g["name"] == "TEST_Renamed"
        finally:
            admin_session.delete(f"{API}/clients/{cid}")

    def test_status_paused_churned_active_transitions(self, admin_session):
        cid = admin_session.post(f"{API}/clients", json={"name": f"TEST_Status_{uuid.uuid4().hex[:6]}"}).json()["id"]
        try:
            r1 = admin_session.patch(f"{API}/clients/{cid}/status", json={"status": "paused"})
            assert r1.status_code == 200 and r1.json()["status"] == "paused"

            r2 = admin_session.patch(f"{API}/clients/{cid}/status", json={"status": "churned"})
            assert r2.status_code == 200
            body = r2.json()
            assert body["status"] == "churned"
            assert body["churned_at"] is not None
            assert body["data_deletion_date"] is not None

            r3 = admin_session.patch(f"{API}/clients/{cid}/status", json={"status": "active"})
            assert r3.status_code == 200
            body = r3.json()
            assert body["status"] == "active"
            assert body["churned_at"] is None
            assert body["data_deletion_date"] is None
        finally:
            admin_session.delete(f"{API}/clients/{cid}")

    def test_admin_hard_delete_removes_client_and_workspace(self, admin_session):
        cid = admin_session.post(f"{API}/clients", json={"name": f"TEST_Del_{uuid.uuid4().hex[:6]}"}).json()["id"]
        r = admin_session.delete(f"{API}/clients/{cid}")
        assert r.status_code == 200
        # GET returns 404
        g = admin_session.get(f"{API}/clients/{cid}")
        assert g.status_code == 404


# ---------------- Workspaces (services + onboarding regen) ----------------
class TestWorkspaceServices:
    @pytest.fixture
    def client_id(self, admin_session):
        cid = admin_session.post(f"{API}/clients", json={"name": f"TEST_WS_{uuid.uuid4().hex[:6]}"}).json()["id"]
        yield cid
        admin_session.delete(f"{API}/clients/{cid}")

    def test_toggle_seo_social_on(self, admin_session, client_id):
        r = admin_session.patch(
            f"{API}/clients/{client_id}/workspace/services",
            json={"seo": True, "social": True},
        )
        assert r.status_code == 200, r.text
        services = r.json()["services"]
        assert services["seo"] is True
        assert services["social"] is True

    def test_toggle_on_generates_onboarding_items(self, admin_session, client_id):
        admin_session.patch(
            f"{API}/clients/{client_id}/workspace/services", json={"seo": True}
        )
        r = admin_session.get(f"{API}/clients/{client_id}/onboarding")
        assert r.status_code == 200
        body = r.json()
        services_present = {i["service"] for i in body["items"]}
        assert "seo" in services_present
        assert "common" in services_present  # common items added on first toggle
        assert body["total_count"] > 0
        assert body["completed_count"] == 0
        assert body["onboarding_complete"] is False

    def test_toggle_off_purges_service_items_keeps_common(self, admin_session, client_id):
        admin_session.patch(
            f"{API}/clients/{client_id}/workspace/services",
            json={"seo": True, "social": True},
        )
        # Now disable SEO; social stays on -> common items remain
        admin_session.patch(
            f"{API}/clients/{client_id}/workspace/services", json={"seo": False}
        )
        r = admin_session.get(f"{API}/clients/{client_id}/onboarding")
        services_present = {i["service"] for i in r.json()["items"]}
        assert "seo" not in services_present
        assert "social" in services_present
        assert "common" in services_present

    def test_get_workspace(self, admin_session, client_id):
        r = admin_session.get(f"{API}/clients/{client_id}/workspace")
        assert r.status_code == 200
        assert "services" in r.json()


# ---------------- Onboarding items ----------------
class TestOnboarding:
    @pytest.fixture
    def client_and_items(self, admin_session):
        cid = admin_session.post(f"{API}/clients", json={"name": f"TEST_OB_{uuid.uuid4().hex[:6]}"}).json()["id"]
        admin_session.patch(f"{API}/clients/{cid}/workspace/services", json={"seo": True})
        items = admin_session.get(f"{API}/clients/{cid}/onboarding").json()["items"]
        yield cid, items
        admin_session.delete(f"{API}/clients/{cid}")

    def test_list_groups_with_counts(self, admin_session, client_and_items):
        cid, items = client_and_items
        r = admin_session.get(f"{API}/clients/{cid}/onboarding")
        body = r.json()
        assert body["total_count"] == len(items)
        assert body["completed_count"] == 0
        assert "onboarding_complete" in body

    def test_patch_item_marks_complete(self, admin_session, client_and_items):
        cid, items = client_and_items
        item_id = items[0]["id"]
        r = admin_session.patch(
            f"{API}/onboarding-items/{item_id}", json={"completed": True}
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["completed"] is True
        assert body["completed_at"] is not None
        assert body["completed_by"] is not None

    def test_all_completed_flips_workspace_flag(self, admin_session, client_and_items):
        cid, items = client_and_items
        for it in items:
            r = admin_session.patch(
                f"{API}/onboarding-items/{it['id']}", json={"completed": True}
            )
            assert r.status_code == 200
        # Verify workspace onboarding_complete via GET /clients/{id}
        client = admin_session.get(f"{API}/clients/{cid}").json()
        assert client["onboarding_complete"] is True


# ---------------- MCP Connections (Fernet) ----------------
class TestConnections:
    @pytest.fixture
    def social_seo_client(self, admin_session):
        cid = admin_session.post(f"{API}/clients", json={"name": f"TEST_Conn_{uuid.uuid4().hex[:6]}"}).json()["id"]
        admin_session.patch(
            f"{API}/clients/{cid}/workspace/services",
            json={"social": True, "seo": True},
        )
        yield cid
        admin_session.delete(f"{API}/clients/{cid}")

    def test_list_connections_returns_slots_per_enabled_service(self, admin_session, social_seo_client):
        cid = social_seo_client
        r = admin_session.get(f"{API}/clients/{cid}/connections")
        assert r.status_code == 200, r.text
        services = {c["service_name"] for c in r.json()["connections"]}
        assert "zernio" in services        # social -> zernio
        assert "gsc_ga4" in services       # seo -> gsc_ga4
        assert "brightlocal" in services   # seo -> brightlocal

    def test_put_zernio_stores_encrypted_and_masks(self, admin_session, social_seo_client):
        cid = social_seo_client
        api_key = "sk-xyz-abcd-1234-secret"
        r = admin_session.put(
            f"{API}/clients/{cid}/connections/zernio",
            json={"credentials": {"api_key": api_key, "platforms": ["instagram"]}},
        )
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["status"] == "connected"
        # Display masked
        df = body["display_fields"]
        assert df["api_key"] != api_key
        assert df["api_key"].endswith(api_key[-4:])
        assert "•" in df["api_key"]
        assert df["platforms"] == ["instagram"]
        # Plaintext key MUST NOT appear anywhere in response
        import json as _json
        assert api_key not in _json.dumps(body)

    def test_get_after_put_shows_connected_and_masked(self, admin_session, social_seo_client):
        cid = social_seo_client
        api_key = "sk-listcheck-9999"
        admin_session.put(
            f"{API}/clients/{cid}/connections/zernio",
            json={"credentials": {"api_key": api_key, "platforms": ["facebook"]}},
        )
        r = admin_session.get(f"{API}/clients/{cid}/connections")
        zernio = next(c for c in r.json()["connections"] if c["service_name"] == "zernio")
        assert zernio["status"] == "connected"
        assert zernio["display_fields"]["api_key"].endswith("9999")
        import json as _json
        assert api_key not in _json.dumps(r.json())

    def test_post_test_returns_ok_and_field_count(self, admin_session, social_seo_client):
        cid = social_seo_client
        admin_session.put(
            f"{API}/clients/{cid}/connections/zernio",
            json={"credentials": {"api_key": "sk-test-1", "platforms": ["x"]}},
        )
        r = admin_session.post(f"{API}/clients/{cid}/connections/zernio/test")
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["ok"] is True
        assert body["field_count"] > 0

    def test_delete_connection_returns_slot_to_not_configured(self, admin_session, social_seo_client):
        cid = social_seo_client
        admin_session.put(
            f"{API}/clients/{cid}/connections/zernio",
            json={"credentials": {"api_key": "sk-del", "platforms": []}},
        )
        r = admin_session.delete(f"{API}/clients/{cid}/connections/zernio")
        assert r.status_code == 200
        r2 = admin_session.get(f"{API}/clients/{cid}/connections")
        zernio = next(c for c in r2.json()["connections"] if c["service_name"] == "zernio")
        assert zernio["status"] == "not_configured"
        assert zernio["id"] is None

    def test_reviewer_cannot_put_or_delete_connection(self, admin_session, reviewer_session, social_seo_client):
        cid = social_seo_client
        r = reviewer_session.put(
            f"{API}/clients/{cid}/connections/zernio",
            json={"credentials": {"api_key": "x"}},
        )
        assert r.status_code == 403
        r2 = reviewer_session.delete(f"{API}/clients/{cid}/connections/zernio")
        assert r2.status_code == 403


# ---------------- Reviewer client scope ----------------
class TestReviewerScope:
    def test_reviewer_sees_only_assigned_clients(self, admin_session, reviewer_session):
        # admin creates an unassigned client
        cid = admin_session.post(f"{API}/clients", json={"name": f"TEST_Unassigned_{uuid.uuid4().hex[:6]}"}).json()["id"]
        try:
            r = reviewer_session.get(f"{API}/clients")
            assert r.status_code == 200
            assert not any(c["id"] == cid for c in r.json())
            # Reviewer cannot GET the specific client
            g = reviewer_session.get(f"{API}/clients/{cid}")
            assert g.status_code == 403
        finally:
            admin_session.delete(f"{API}/clients/{cid}")
