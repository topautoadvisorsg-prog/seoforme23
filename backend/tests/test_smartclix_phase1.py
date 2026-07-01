"""SmartClix Phase 1 backend tests — auth, brute-force, operators CRUD."""
import time
import uuid
import requests
import pytest
from conftest import API, ADMIN_EMAIL, ADMIN_PASSWORD, REVIEWER_EMAIL, REVIEWER_PASSWORD


# --- Health ---
def test_health():
    r = requests.get(f"{API}/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


# --- Auth login/me/logout ---
class TestAuthFlow:
    def test_admin_login_sets_cookies_and_returns_operator(self, fresh_session):
        r = fresh_session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200, r.text
        body = r.json()
        assert body["email"] == ADMIN_EMAIL
        assert body["role"] == "admin"
        assert "id" in body
        # cookies
        assert "access_token" in fresh_session.cookies
        assert "refresh_token" in fresh_session.cookies

    def test_me_returns_operator_via_cookie(self, admin_session):
        r = admin_session.get(f"{API}/auth/me")
        assert r.status_code == 200
        assert r.json()["email"] == ADMIN_EMAIL
        assert r.json()["role"] == "admin"

    def test_login_wrong_password_returns_401(self, fresh_session):
        # unique identifier to avoid lockout interference
        unique = f"wrongpw_{uuid.uuid4().hex[:8]}@smartclix.app"
        r = fresh_session.post(f"{API}/auth/login", json={"email": unique, "password": "wrong"})
        assert r.status_code == 401
        assert "Incorrect email or password" in r.json().get("detail", "")

    def test_logout_clears_cookies(self, admin_session):
        r = admin_session.post(f"{API}/auth/logout")
        assert r.status_code == 200
        # subsequent /me must fail
        admin_session.cookies.clear()
        r2 = admin_session.get(f"{API}/auth/me")
        assert r2.status_code == 401

    def test_refresh_issues_new_access_token(self, fresh_session):
        r = fresh_session.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
        assert r.status_code == 200
        # Drop access token, keep refresh
        if "access_token" in fresh_session.cookies:
            del fresh_session.cookies["access_token"]
        r2 = fresh_session.post(f"{API}/auth/refresh")
        assert r2.status_code == 200, r2.text
        assert "access_token" in fresh_session.cookies
        # /me now works
        r3 = fresh_session.get(f"{API}/auth/me")
        assert r3.status_code == 200

    def test_forgot_password_generic_response(self, fresh_session):
        r = fresh_session.post(f"{API}/auth/forgot-password", json={"email": "anyone@smartclix.app"})
        assert r.status_code == 200
        assert "reset link" in r.json().get("message", "").lower()


# --- Brute force lockout (run on isolated identifier) ---
class TestBruteForce:
    def test_lockout_after_5_failures(self, fresh_session):
        # Use a unique email so we never lock out the real admin identifier
        unique_email = f"bf_{uuid.uuid4().hex[:10]}@smartclix.app"
        last_status = None
        for i in range(5):
            r = fresh_session.post(f"{API}/auth/login", json={"email": unique_email, "password": "x"})
            last_status = r.status_code
            assert r.status_code == 401, f"Attempt {i+1}: {r.status_code} {r.text}"
        # 6th attempt should be locked out
        r = fresh_session.post(f"{API}/auth/login", json={"email": unique_email, "password": "x"})
        assert r.status_code == 429, f"Expected 429 lockout, got {r.status_code} {r.text}"
        assert "Too many attempts" in r.json().get("detail", "")


# --- Operators CRUD (admin) ---
class TestOperatorsCRUD:
    def test_admin_can_list_operators(self, admin_session):
        r = admin_session.get(f"{API}/operators")
        assert r.status_code == 200
        ops = r.json()
        emails = [o["email"] for o in ops]
        assert ADMIN_EMAIL in emails
        assert REVIEWER_EMAIL in emails

    def test_reviewer_forbidden_from_list(self, reviewer_session):
        r = reviewer_session.get(f"{API}/operators")
        assert r.status_code == 403
        assert "Insufficient permissions" in r.json().get("detail", "")

    def test_admin_create_update_delete_operator(self, admin_session):
        email = f"test_mgr_{uuid.uuid4().hex[:8]}@smartclix.app"
        payload = {"email": email, "name": "TEST Manager", "role": "manager", "password": "Password#123"}
        r = admin_session.post(f"{API}/operators", json=payload)
        assert r.status_code == 201, r.text
        created = r.json()
        assert created["email"] == email
        assert created["role"] == "manager"
        op_id = created["id"]

        # Verify via list
        r2 = admin_session.get(f"{API}/operators")
        assert any(o["id"] == op_id for o in r2.json())

        # PATCH role -> reviewer
        r3 = admin_session.patch(f"{API}/operators/{op_id}", json={"role": "reviewer"})
        assert r3.status_code == 200
        assert r3.json()["role"] == "reviewer"

        # DELETE
        r4 = admin_session.delete(f"{API}/operators/{op_id}")
        assert r4.status_code == 200

        # Verify gone — list no longer has it
        r5 = admin_session.get(f"{API}/operators")
        assert not any(o["id"] == op_id for o in r5.json())

    def test_admin_cannot_delete_self(self, admin_session):
        me = admin_session.get(f"{API}/auth/me").json()
        r = admin_session.delete(f"{API}/operators/{me['id']}")
        assert r.status_code == 400
        assert "yourself" in r.json().get("detail", "").lower()
