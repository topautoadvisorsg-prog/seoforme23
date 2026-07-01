# SmartClix — Refined Build Spec (v1.1)
## Consolidated & Corrected from Documents 2B + 3
### Refined for Emergent stack (React + FastAPI + MongoDB)

> This document supersedes Documents 2B and 3 where they conflict.
> All corrections, missing details, and tech-stack adaptations are
> consolidated here. The product intent (multi-client operator
> dashboard, approval gate, webhook bridge from Cowork) is unchanged.

---

## 1. CORRECTIONS APPLIED

### 1.1 Logical / Cross-Document Inconsistencies (fixed)

| # | Issue (Original Docs) | Correction |
|---|----------------------|------------|
| 1 | Doc 2B sidebar lists `Clients \| Approval Queue \| Analytics \| Notifications \| Settings` — missing **Overview**. Doc 3 includes Overview as the landing page (`/dashboard`). | Sidebar = **Overview · Clients · Approvals · Analytics · Notifications · Settings**. Logout sits in header avatar dropdown (Doc 3), not the sidebar. |
| 2 | Doc 2B Phase 2 has TWO `5.` items in the Specific Tasks list (Connections tab AND Onboarding checklist tab both numbered 5). | Renumbered: 5 = Connections, 6 = Onboarding, 7 = Status, 8 = Workspace ID. |
| 3 | Doc 2B item_type list in `approval_queue` is missing `video_final` follow-up handling. Doc 3 has a dedicated "Finished Video" review modal. | Add explicit two-stage video flow: `video_script` (Critic-pre-render) → on approval triggers generation → `video_final` enqueued for post-render review. |
| 4 | Doc 2B Phase 6 says analytics snapshots come through the same `/api/webhooks/cowork` endpoint with `item_type='analytics_snapshot'`, but the webhook schema in Phase 4 only mentions `approval_queue` insert. | Unified webhook contract documented in §4. Webhook router branches on `item_type`: `analytics_snapshot` → `analytics_snapshots` collection; `cost_report` → `cost_log`; everything else → `approval_queue`. |
| 5 | Doc 3 adds **LSA** and **Activity** tabs to client detail. Doc 2B schema has no `activity_log` table. | Added `activity_log` and `lsa_leads` / `lsa_disputes` collections (§3). |
| 6 | Doc 2B schema uses `clients.assigned_to UUID` (single operator) but Doc 3 Settings/Team allows multiple reviewers across multiple clients. | Kept `clients.assigned_to` as primary owner. For multi-reviewer access, added `client_access` join collection (operator_id, client_id, role_override). |
| 7 | Doc 2B says Resend for email. Doc 3 adds an "Email Configuration" admin section in Settings (Resend API key entered in UI). | Reconciled: Resend API key is settable both via env (`RESEND_API_KEY`) AND via Settings → Email Configuration (admin only, encrypted at rest in `app_settings` collection). UI value overrides env when present. |
| 8 | Doc 2B "Phase 1 Exit" requires reviewer to see only assigned clients, but the RLS policy as written only checks `clients.assigned_to = auth.uid()`. A reviewer can't see *any* client unless assigned, including their own dashboard summary. | Overview cards for reviewers compute over their assigned clients only (no global numbers shown). Documented in §5.1. |
| 9 | Doc 2B references `automation_logs` table in Phase 4 (Ad recommendations) but it's not in the schema. | Renamed to `activity_log` (which Doc 3 already requires for the Activity tab). |
| 10 | Doc 2B Phase 4 "Stale post handling": logic split between webhook receive, queue card, and execution handler. Order of state transitions is ambiguous. | Pinned single source of truth: staleness is *display-only* until execution runs. Execution handler computes stale at approve-time and chooses schedule/reject. Documented in §6.3. |
| 11 | Doc 3 "Forgot Password flow" uses Resend; Doc 2B Phase 1 doesn't list email as a Phase 1 dependency. | Phase 1 stub: password reset endpoint exists, generates token, **logs reset link to console**. Real email send wired in Phase 5 when Resend is configured. |
| 12 | Doc 3 mobile bottom-tab bar shows 5 items (`Overview / Clients / ✅ / 🔔 / Settings`) — Approvals tab uses ✅ but unread count badge isn't explained. | Tab badge = pending approvals count for current role's scope. Bell badge = unread notifications. Both update live via WebSocket. |
| 13 | Doc 2B Phase 5 (Token Health) job runs at "5 AM UTC". No backoff or partial-failure handling. | Added: per-service ping with 10s timeout, soft-fail (log only), one retry. A single 5xx ≠ token-expired. Marks `expired` only on 401/403 or token-info endpoint negative. |
| 14 | Doc 2B Phase 4 webhook says "Validate workspace_id exists and is active" — doesn't say what `active` means for a paused client. | Refined: paused/churned workspaces *do* accept webhooks (so in-flight items aren't lost) but the dashboard renders them with a "Client paused — execute manually" warning instead of auto-executing on approval. |
| 15 | No pagination strategy defined despite "50+ items" performance target. | Added cursor-based pagination on approval_queue and activity_log (§7). Page size = 25. |

### 1.2 Doc 3 → Tech Stack Adaptation

| Original Recommendation | Replacement (this build) |
|------------------------|--------------------------|
| Next.js 14 App Router + TypeScript | **React 19 (CRA) + JavaScript** (existing /app/frontend) |
| Supabase Postgres + RLS | **MongoDB (motor)** with **role-based middleware** at the API layer (not row-level). Every list endpoint filters by `current_operator.role`. |
| Supabase Auth | **Custom JWT auth** (httpOnly cookies, bcrypt, refresh token, brute-force lockout) per Auth Playbook |
| Supabase Realtime (postgres_changes) | **WebSocket** at `/api/ws` (FastAPI native). Pub/sub channels: `approvals`, `notifications`, `health`. Connection scoped to operator's JWT — server filters events by role/assignment before pushing. |
| Vercel Cron / Supabase Edge Function | **APScheduler** (in-process) for daily 5 AM UTC token health check; or background asyncio task on app startup. |
| Resend (email) | **Kept** — added in Phase 5. Phase 1 logs reset links to console. |
| Vercel deploy | **Emergent native deploy** (supervisor-managed React on :3000 + FastAPI on :8001) |
| Row-Level Security policies | **Server-side filters**: every read query is built from `current_operator`. No client-side trust. Documented in §5.1. |
| AES-256 service-side credential encryption | **Fernet (cryptography lib)** symmetric encryption with `FERNET_KEY` env var. Never returned to frontend. |

### 1.3 Things Removed (Out of Scope, Doc 3 already deferred)

- Client-facing portal
- Native mobile app (responsive web only)
- Custom report builder
- Billing UI
- Dark mode (deferred; design-system tokens included so it can be added cheaply)

---

## 2. NON-NEGOTIABLES (UNCHANGED FROM DOC 2B)

1. **Approval gate** — nothing executes without operator sign-off
2. **Multi-client isolation** — one client's data never leaks to another's
3. **Webhook bridge** — Cowork → Dashboard via `/api/webhooks/cowork` (HMAC secret)
4. **Service module system** — each service independently toggleable per client

---

## 3. DATABASE SCHEMA (MongoDB Collections)

All `_id` fields are MongoDB ObjectId (returned to API as `id: str`). Timestamps stored as ISO strings in UTC. Stable references between collections use `id` (string).

### 3.1 Collections

```
operators
  _id, email (lowercase, unique), name, role ('admin'|'manager'|'reviewer'),
  password_hash (bcrypt), last_login, created_at, created_by (operator_id|null)

login_attempts
  _id, identifier ("{ip}:{email}"), count, locked_until, updated_at

password_reset_tokens
  _id, operator_id, token, expires_at (TTL index), used (bool)

app_settings  (singleton — one doc with key='global')
  _id, key, resend_api_key_enc, resend_from_address, webhook_secret_enc,
  updated_at, updated_by

clients
  _id, name, website_url, industry, location { city, state, country, zip_codes[] },
  status ('active'|'paused'|'churned'), assigned_to (operator_id),
  created_at, churned_at, data_deletion_date

client_access  (multi-reviewer support)
  _id, client_id, operator_id, granted_at, granted_by

workspaces  (1:1 with clients)
  _id, client_id (unique), seo_enabled, gbp_enabled, social_enabled,
  meta_ads_enabled, google_ads_enabled, lsa_enabled, linkedin_ads_enabled,
  video_enabled, onboarding_complete, onboarding_started_at,
  onboarding_completed_at, created_at

onboarding_items
  _id, workspace_id, service, item_key, label, completed (bool),
  completed_at, completed_by (operator_id)

mcp_connections
  _id, workspace_id, service_name, status, token_expires_at,
  token_last_verified, last_error,
  credentials_enc (Fernet-encrypted JSON blob — never returned to client),
  created_at, updated_at

approval_queue
  _id, workspace_id, item_type, status ('pending'|'approved'|'rejected'
  |'edited'|'flagged'|'stale'), title, payload (JSON),
  reviewed_by, reviewed_at, review_notes,
  expires_at, original_scheduled_time, actual_scheduled_time,
  execution_status ('not_started'|'in_progress'|'success'|'failed'),
  execution_error, created_at

notifications
  _id, workspace_id, operator_id (nullable=all), type, title, body,
  urgency ('info'|'warning'|'urgent'), read_at, email_sent_at, created_at

cost_log
  _id, workspace_id, month (YYYY-MM-01), service, units_used,
  estimated_cost, updated_at

analytics_snapshots
  _id, workspace_id, snapshot_type, snapshot_date, data, created_at

activity_log    (audit + agent-run history per client)
  _id, workspace_id, actor ('agent'|'operator'|'system'),
  actor_id (operator_id or null), action, target_type, target_id,
  details (JSON), created_at

lsa_leads
  _id, workspace_id, lead_date, lead_type, contact_info, status
  ('valid'|'review'|'spam'), dispute_id, created_at

lsa_disputes
  _id, lead_id, workspace_id, reason_draft, status
  ('drafted'|'submitted'|'dismissed'), submitted_at, created_at
```

### 3.2 Indexes (created on startup)

```
operators.email                              UNIQUE
login_attempts.identifier                    UNIQUE
password_reset_tokens.expires_at             TTL
clients.assigned_to
clients.status
workspaces.client_id                         UNIQUE
client_access (client_id, operator_id)       UNIQUE COMPOUND
mcp_connections (workspace_id, service_name) UNIQUE COMPOUND
onboarding_items (workspace_id, item_key)    UNIQUE COMPOUND
approval_queue.workspace_id
approval_queue (status, created_at)
notifications (operator_id, read_at)
activity_log (workspace_id, created_at)
```

---

## 4. WEBHOOK CONTRACT (Cowork → Dashboard)

Single endpoint, multiple item types. Authenticated via shared HMAC header.

```
POST /api/webhooks/cowork
Headers:
  Content-Type: application/json
  x-webhook-secret: <WEBHOOK_SECRET>   (compared in constant-time)

Body:
{
  "workspace_id": "<uuid string>",
  "item_type":    "<see table below>",
  "title":        "<short human label>",
  "payload":      { ... item-specific JSON ... },
  "expires_at":   "2026-05-23T18:00:00Z"   (optional)
}
```

### 4.1 Router by `item_type`

| item_type | Destination | Triggers |
|-----------|-------------|----------|
| `social_post`, `social_batch`, `blog_post`, `gbp_post`, `gbp_review_response`, `gbp_qa`, `ads_recommendation`, `ads_creative`, `video_script`, `video_final`, `review_response`, `backlink_outreach`, `lsa_dispute` | `approval_queue` (status=pending) | WebSocket push to `approvals` channel; notification create |
| `analytics_snapshot` | `analytics_snapshots` | No notification (silent) |
| `cost_report` | `cost_log` (upsert by workspace+month+service) | Threshold-trigger notification if >80% |
| `agent_failure` | `notifications` (urgency=warning) | WebSocket push to `notifications` |
| `agent_run` | `activity_log` (actor=agent) | No notification |

### 4.2 Webhook security

1. Reject if `x-webhook-secret` missing or mismatch → `401`
2. Validate `workspace_id` exists → `404` if not
3. Workspace in `churned` state → `410 Gone` (don't accept)
4. Workspace in `paused` state → accept, but item is created with `payload._client_paused: true` flag so the review UI warns operator before approval triggers execution

---

## 5. AUTHORIZATION MODEL

### 5.1 Role-Based Access Rules

| Resource | admin | manager | reviewer |
|----------|-------|---------|----------|
| Operators (list/create/delete) | ✅ all | ❌ | ❌ |
| Clients (list) | all | all | only assigned + via `client_access` |
| Clients (create/edit/delete) | ✅ | ✅ | ❌ |
| Workspaces (toggle services) | ✅ | ✅ | ❌ |
| MCP Connections (read/write) | ✅ all | ✅ all | ✅ own clients only |
| Approval Queue (read) | all | all | own clients only |
| Approval Queue (approve/reject) | ✅ | ✅ | ✅ own clients only |
| Cross-client Analytics page | ✅ | ✅ | ❌ |
| Settings → Email Configuration | ✅ | ❌ | ❌ |
| Settings → Team | ✅ | ❌ | ❌ |
| Activity Log | own scope | own scope | own scope |

Implementation: every list endpoint accepts `current_operator` dependency and builds the Mongo query with a workspace-id filter derived from role.

```python
def authorized_workspace_ids(operator) -> list[str]:
    if operator["role"] in ("admin", "manager"):
        return None  # None = no filter
    # reviewer:
    own = await db.clients.find({"assigned_to": operator["id"]}, {"_id":1}).to_list(...)
    extra = await db.client_access.find({"operator_id": operator["id"]}, ...).to_list(...)
    client_ids = [...own + extra]
    return [w["_id"] for w in await db.workspaces.find({"client_id": {"$in": client_ids}})]
```

### 5.2 Frontend ProtectedRoute

```
<ProtectedRoute roles={["admin"]}>  → admin-only routes
<ProtectedRoute roles={["admin","manager"]}>  → cross-client analytics
<ProtectedRoute>  → any authenticated operator
```

---

## 6. EXECUTION LAYER (Phase 4 details — preserved for completeness)

### 6.1 Internal endpoints (server → external API)

| Endpoint | Source service | Notes |
|----------|---------------|-------|
| `POST /api/execute/social-schedule` | Zernio | One call per post in batch |
| `POST /api/execute/ads-action` | AdKit | Creates draft, op confirms externally |
| `POST /api/execute/blog-publish` | WordPress REST or GitHub (custom site) | Path determined by `mcp_connections.service_name` |
| `POST /api/execute/gbp-publish` | Google Business Profile API | OAuth-token-based |

All execution endpoints:
1. Authorize operator vs target workspace
2. Load credentials from `mcp_connections.credentials_enc` (decrypt server-side only)
3. Make the call
4. Update `approval_queue.execution_status` + write `activity_log`
5. On failure: mark `execution_status='failed'`, create urgent notification

### 6.2 Mocked-first contract (this build)

For Phase 1–4 build, every execution handler is **mocked** behind a flag (`USE_MOCK_EXECUTORS=true` in env). The mock:
- Logs the call
- Simulates a 1s delay
- Returns success
- Writes to `activity_log` exactly as the real call would

This lets the entire approval → execution loop be tested end-to-end without real Zernio/AdKit/Google keys. Switching to real calls is a per-service env flip.

### 6.3 Stale post resolution (single source of truth)

```
At approval time, for items where item_type ∈ {social_post, social_batch}:
  Δ = now() − original_scheduled_time
  if Δ < 0:                  schedule at original_scheduled_time
  elif 0 ≤ Δ ≤ 24h:          schedule at next-optimal-slot, set actual_scheduled_time
  else (Δ > 24h):            return 409 Conflict, mark queue item status='stale'
                             (frontend already showed [Re-queue] [Delete])
```

---

## 7. PAGINATION

All list endpoints accept `limit` (default 25, max 100) and `cursor` (opaque base64 of last `created_at + _id`). Responses include `next_cursor` (null if exhausted).

---

## 8. DESIGN SYSTEM (Doc 3 colors preserved, font swapped)

| Token | Value | Notes |
|-------|-------|-------|
| `--primary` | `#2563EB` | Doc 3 |
| `--success` | `#16A34A` | Doc 3 |
| `--warning` | `#D97706` | Doc 3 |
| `--danger`  | `#DC2626` | Doc 3 |
| `--bg`      | `#F9FAFB` | Doc 3 |
| `--surface` | `#FFFFFF` | Doc 3 |
| `--border`  | `#E5E7EB` | Doc 3 |
| `--text`    | `#111827` | Doc 3 |
| `--text-muted` | `#6B7280` | Doc 3 |
| Font | **Inter Tight** (similar to Inter but slightly tighter — distinct from default Inter look) | Adapted from Doc 3 |
| Mono | JetBrains Mono | For workspace IDs / tokens display |

All other Doc 3 patterns (status badges, buttons, forms, cards, tables) preserved verbatim.

---

## 9. PHASE 1 — BUILD SCOPE (THIS DELIVERY)

### 9.1 What's IN Phase 1 of this build

- Full DB schema deployed (all collections + indexes created on startup)
- JWT auth: login, logout, /me, refresh, forgot-password (logs link), reset-password
- Brute-force lockout (5 attempts / 15 min)
- Admin seeding from env vars
- Test reviewer account seeded for end-to-end testing
- `/api/operators` admin-only CRUD (list / create / edit role / delete)
- Dashboard shell with sidebar navigation (Overview · Clients · Approvals · Analytics · Notifications · Settings)
- Header with avatar dropdown (My Profile / Settings / Logout)
- Notification bell + Approvals badge (visual only; counts wired in later phases — show 0 in P1)
- Role-based menu visibility (Team / Email Configuration / Cross-client Analytics hidden for reviewer)
- All other pages: helpful empty-state placeholder with "Coming in Phase N" note
- Login page with password show/hide, forgot-password modal, error states from Doc 3
- Loading skeletons + empty states on all list pages
- Responsive mobile layout (sidebar → bottom tab bar < 768px)

### 9.2 What's deferred to later phases

- Phase 2: Clients CRUD, Workspaces, Onboarding, Connections, Services toggle
- Phase 3: Approval queue + review modals
- Phase 4: Webhook receiver + execution handlers (mocked)
- Phase 5: Token health cron + Resend email
- Phase 6: Analytics display
- Phase 7: Notifications center + WebSocket pub/sub
- Phase 8: Polish, rate limiting, security review

### 9.3 Exit Conditions (Phase 1)

- [x] `admin@smartclix.local / Admin#12345` can log in and sees all sidebar items including Settings → Team
- [x] `reviewer@smartclix.local / Reviewer#12345` can log in and does NOT see Team / Email Configuration
- [x] Unauthenticated request to any `/dashboard/*` route redirects to `/login`
- [x] `/api/auth/me` returns operator data when called with valid cookie
- [x] Failed logins increment counter; 6th attempt rejected for 15 minutes
- [x] All collections + indexes exist after first startup
- [x] Frontend loads in < 2s on the preview URL

---

## 10. ENVIRONMENT VARIABLES (this build)

```
# Backend (.env)
MONGO_URL              # provided
DB_NAME                # provided
CORS_ORIGINS           # provided
JWT_SECRET             # 64-char hex — generated on first install
ADMIN_EMAIL            # admin@smartclix.local
ADMIN_PASSWORD         # Admin#12345
TEST_REVIEWER_EMAIL    # reviewer@smartclix.local
TEST_REVIEWER_PASSWORD # Reviewer#12345
FERNET_KEY             # base64 — for MCP credential encryption
WEBHOOK_SECRET         # shared with Cowork operator
USE_MOCK_EXECUTORS     # true for Phase 1–4 dev
RESEND_API_KEY         # added in Phase 5 (optional in P1)

# Frontend (.env)
REACT_APP_BACKEND_URL  # provided
```

---

*SmartClix Refined Build Spec — v1.1*
*Supersedes Documents 2B and 3 where they conflict.*
*All non-product decisions remain open to developer judgment.*
