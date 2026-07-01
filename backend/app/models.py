"""Pydantic models — pure DTOs, no DB references."""
from typing import Optional, Literal, Any
from pydantic import BaseModel, EmailStr, Field


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    token: str
    new_password: str = Field(min_length=8)


class OperatorCreate(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1)
    role: str
    password: str = Field(min_length=8)


class OperatorUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None


def serialize_operator(doc: dict) -> dict:
    """Mongo doc → API-safe dict. password_hash never leaves the server."""
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "name": doc.get("name", ""),
        "role": doc["role"],
        "created_at": doc.get("created_at"),
        "last_login": doc.get("last_login"),
    }


# ---------- clients ----------
class LocationIn(BaseModel):
    city: Optional[str] = None
    state: Optional[str] = None
    country: Optional[str] = None
    zip_codes: list[str] = Field(default_factory=list)


class ClientCreate(BaseModel):
    name: str = Field(min_length=1)
    website_url: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[LocationIn] = None
    assigned_to: Optional[str] = None  # operator id


class ClientUpdate(BaseModel):
    name: Optional[str] = None
    website_url: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[LocationIn] = None
    assigned_to: Optional[str] = None


class ClientStatusUpdate(BaseModel):
    status: Literal["active", "paused", "churned"]


def serialize_client(doc: dict, workspace: Optional[dict] = None) -> dict:
    out = {
        "id": str(doc["_id"]),
        "name": doc["name"],
        "website_url": doc.get("website_url"),
        "industry": doc.get("industry"),
        "location": doc.get("location"),
        "status": doc.get("status", "active"),
        "assigned_to": doc.get("assigned_to"),
        "created_at": doc.get("created_at"),
        "churned_at": doc.get("churned_at"),
        "data_deletion_date": doc.get("data_deletion_date"),
    }
    if workspace is not None:
        out["workspace_id"] = str(workspace["_id"])
        out["onboarding_complete"] = workspace.get("onboarding_complete", False)
        out["services"] = {k: workspace.get(f"{k}_enabled", False) for k in [
            "seo", "gbp", "social", "meta_ads", "google_ads", "lsa", "linkedin_ads", "video"
        ]}
    return out


# ---------- workspaces ----------
class ServicesToggleIn(BaseModel):
    """Partial — only flags present will be updated."""
    seo: Optional[bool] = None
    gbp: Optional[bool] = None
    social: Optional[bool] = None
    meta_ads: Optional[bool] = None
    google_ads: Optional[bool] = None
    lsa: Optional[bool] = None
    linkedin_ads: Optional[bool] = None
    video: Optional[bool] = None


def serialize_workspace(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "client_id": doc["client_id"],
        "services": {
            "seo": doc.get("seo_enabled", False),
            "gbp": doc.get("gbp_enabled", False),
            "social": doc.get("social_enabled", False),
            "meta_ads": doc.get("meta_ads_enabled", False),
            "google_ads": doc.get("google_ads_enabled", False),
            "lsa": doc.get("lsa_enabled", False),
            "linkedin_ads": doc.get("linkedin_ads_enabled", False),
            "video": doc.get("video_enabled", False),
        },
        "onboarding_complete": doc.get("onboarding_complete", False),
        "onboarding_started_at": doc.get("onboarding_started_at"),
        "onboarding_completed_at": doc.get("onboarding_completed_at"),
        "created_at": doc.get("created_at"),
    }


# ---------- onboarding ----------
class OnboardingItemUpdate(BaseModel):
    completed: bool


def serialize_onboarding_item(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "workspace_id": doc["workspace_id"],
        "service": doc["service"],
        "item_key": doc["item_key"],
        "label": doc["label"],
        "completed": doc.get("completed", False),
        "completed_at": doc.get("completed_at"),
        "completed_by": doc.get("completed_by"),
    }


# ---------- mcp connections ----------
class ConnectionUpsert(BaseModel):
    """Plaintext credentials from the form. Encrypted before storage."""
    credentials: dict[str, Any]


def serialize_connection(doc: dict, fields_spec: list[dict]) -> dict:
    """Public connection metadata — credentials NEVER returned in plaintext."""
    return {
        "id": str(doc["_id"]),
        "workspace_id": doc["workspace_id"],
        "service_name": doc["service_name"],
        "status": doc.get("status", "connected"),
        "token_last_verified": doc.get("token_last_verified"),
        "token_expires_at": doc.get("token_expires_at"),
        "last_error": doc.get("last_error"),
        # display-safe fields: secret fields are masked
        "display_fields": doc.get("display_fields", {}),
        "fields_spec": fields_spec,
        "created_at": doc.get("created_at"),
        "updated_at": doc.get("updated_at"),
    }


# ---------- approvals ----------
APPROVAL_ITEM_TYPES = Literal[
    "social_batch",
    "social_post",
    "blog_post",
    "gbp_post",
    "gbp_review",
    "gbp_qa",
    "ads_recommendation",
    "video_script",
    "video_final",
    "review_response",
    "backlink_outreach",
    "lsa_dispute",
]


class ApprovalDecisionIn(BaseModel):
    final_payload: Optional[dict[str, Any]] = None
    review_notes: Optional[str] = None


class ApprovalRejectIn(BaseModel):
    review_notes: str = Field(min_length=1)


class ApprovalUpdateIn(BaseModel):
    """Save edits in-place while leaving status=pending."""
    payload: dict[str, Any]


def serialize_approval(doc: dict, client: Optional[dict] = None) -> dict:
    out = {
        "id": str(doc["_id"]),
        "workspace_id": doc["workspace_id"],
        "item_type": doc["item_type"],
        "status": doc.get("status", "pending"),
        "title": doc.get("title"),
        "payload": doc.get("payload", {}),
        "final_payload": doc.get("final_payload"),
        "reviewed_by": doc.get("reviewed_by"),
        "reviewed_at": doc.get("reviewed_at"),
        "review_notes": doc.get("review_notes"),
        "expires_at": doc.get("expires_at"),
        "original_scheduled_time": doc.get("original_scheduled_time"),
        "actual_scheduled_time": doc.get("actual_scheduled_time"),
        "execution_status": doc.get("execution_status", "not_started"),
        "execution_error": doc.get("execution_error"),
        "execution_target": doc.get("execution_target"),
        "created_at": doc.get("created_at"),
        "flagged": doc.get("flagged", False),
    }
    if client is not None:
        out["client_name"] = client.get("name")
        out["client_id"] = str(client["_id"])
    return out


# ---------- webhooks (Phase 4 — Cowork → Dashboard) ----------
class WebhookIn(BaseModel):
    workspace_id: str
    item_type: str
    title: Optional[str] = None
    payload: dict[str, Any] = Field(default_factory=dict)
    expires_at: Optional[str] = None
    original_scheduled_time: Optional[str] = None
