"""Centralized configuration. All env reads live here.

No other module should call os.environ directly — import from this module
so the source of every value is grep-able from one place.
"""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).resolve().parent.parent  # /app/backend
load_dotenv(ROOT_DIR / ".env")


def _required(name: str) -> str:
    val = os.environ.get(name)
    if not val:
        raise RuntimeError(f"Missing required env var: {name}")
    return val


# Database
MONGO_URL = _required("MONGO_URL")
DB_NAME = _required("DB_NAME")

# Auth
JWT_SECRET = _required("JWT_SECRET")
JWT_ALGORITHM = "HS256"
ACCESS_TOKEN_MINUTES = 60 * 8  # 8h
REFRESH_TOKEN_DAYS = 7

# Brute force
LOCKOUT_THRESHOLD = 5
LOCKOUT_MINUTES = 15

# Roles
VALID_ROLES = {"admin", "manager", "reviewer"}

# Seeding
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL", "admin@smartclix.app").lower()
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD", "Admin#12345")
TEST_REVIEWER_EMAIL = os.environ.get("TEST_REVIEWER_EMAIL", "reviewer@smartclix.app").lower()
TEST_REVIEWER_PASSWORD = os.environ.get("TEST_REVIEWER_PASSWORD", "Reviewer#12345")

# Integrations (used in later phases)
FERNET_KEY = os.environ.get("FERNET_KEY")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET")
USE_MOCK_EXECUTORS = os.environ.get("USE_MOCK_EXECUTORS", "true").lower() == "true"
RESEND_API_KEY = os.environ.get("RESEND_API_KEY")  # Phase 5

# CORS
CORS_ORIGINS = [
    o.strip()
    for o in os.environ.get("CORS_ORIGINS", "http://localhost:3000").split(",")
    if o.strip()
]

# Cookies — secure+SameSite=None is required for cross-site HTTPS (prod).
# Local dev runs over http, where Secure cookies won't be stored, so default
# to a dev-friendly setting and let prod opt back in via COOKIE_SECURE=true.
COOKIE_SECURE = os.environ.get("COOKIE_SECURE", "true").lower() == "true"
COOKIE_SAMESITE = "none" if COOKIE_SECURE else "lax"

# Frontend build dir — in production (Docker) FastAPI serves the built SPA
# from the same origin. Unset in local dev (React runs separately on :3000).
FRONTEND_BUILD_DIR = os.environ.get("FRONTEND_BUILD_DIR")
