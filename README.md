# SmartClix — Operator Dashboard

> **A web-based operator dashboard that lets a team manage multiple agency clients
> simultaneously.** It's the always-on management layer for Cowork's desktop-bound
> Claude agents: a multi-tenant approval queue, client workspace registry,
> MCP-token health monitor, and cross-client analytics.

This README is the **single source of truth** for running, debugging, and
extending the system. If something breaks, this document tells you _where_
to look — and why.

---

## Table of Contents

1. [What This Is and What It Isn't](#1-what-this-is-and-what-it-isnt)
2. [System Diagram](#2-system-diagram)
3. [Architecture Principles](#3-architecture-principles)
4. [Tech Stack](#4-tech-stack)
5. [Repository Layout](#5-repository-layout)
6. [Backend Module Map](#6-backend-module-map)
7. [Frontend Module Map](#7-frontend-module-map)
8. [Authentication Flow](#8-authentication-flow)
9. [Authorization Model](#9-authorization-model)
10. [Data Model (MongoDB)](#10-data-model-mongodb)
11. [API Reference](#11-api-reference)
12. [Environment Variables](#12-environment-variables)
13. [Running Locally](#13-running-locally)
14. [Testing](#14-testing)
15. [Troubleshooting / Debug Playbook](#15-troubleshooting--debug-playbook)
16. [Build Phases & Roadmap](#16-build-phases--roadmap)
17. [Conventions](#17-conventions)
18. [Related Documents](#18-related-documents)

---

## 1. What This Is and What It Isn't

**Is:**
- A persistent, always-on web dashboard for **agency operators** managing many
  client accounts.
- The approval gate: every piece of agent-generated content (social posts,
  blogs, ad recommendations, GBP replies, etc.) goes through here for sign-off.
- The bridge between Cowork (desktop-bound Claude agents) and the outside world.

**Is NOT:**
- An agent runtime — agents live inside Cowork on the operator's machine.
  This dashboard receives their output via webhook.
- A client-facing portal. Clients never log in here. Operators do.
- A replacement for AdKit, Zernio, Google Business Profile, WordPress, etc.
  Those are the execution targets the dashboard _calls_ post-approval.

---

## 2. System Diagram

```
                            ┌──────────────────────────┐
                            │   COWORK (Desktop)       │
                            │  Claude Agents · MCP     │
                            │  Scheduled Tasks         │
                            └──────────┬───────────────┘
                                       │ HTTPS + HMAC
                                       │ POST /api/webhooks/cowork
                                       │ { workspace_id, item_type,
                                       │   title, payload, expires_at }
                                       ▼
┌──────────────────┐   cookies   ┌──────────────────────────────────┐
│  Operator's      │◀────────────│  FastAPI Backend (this repo)     │
│  Browser         │             │                                  │
│  React SPA       │────────────▶│  /api/auth/*    /api/operators/* │
│                  │   JSON      │  /api/clients/* (Phase 2)        │
│                  │             │  /api/approvals/* (Phase 3)      │
│                  │             │  /api/webhooks/cowork (Phase 4)  │
└──────────────────┘             │  /api/execute/* (Phase 4)        │
                                 └──────┬───────────────────────────┘
                                        │
                                        ▼
                                 ┌────────────────┐
                                 │   MongoDB      │
                                 │  15 collections│
                                 └────────────────┘
                                        ▲
                                        │ APScheduler cron (Phase 5)
                                        │ - Token health 5 AM UTC
                                        │ - Approval expiry sweep
                                        │
                              ┌─────────┴─────────┐
                              │ External Services │
                              │ Zernio, AdKit,    │
                              │ Google APIs,      │
                              │ Resend (email)    │
                              └───────────────────┘
```

### Request flow — operator approves a social batch

```
1. Cowork agent runs (Mon 09:00) → generates a social batch
2. Cowork POSTs to /api/webhooks/cowork with HMAC secret
3. Webhook handler validates HMAC, looks up workspace, inserts to approval_queue
4. WebSocket pushes "new item" event → operator's browser updates badge
5. Operator opens dashboard, clicks Review, edits caption, clicks Approve
6. Frontend POST /api/approvals/{id}/approve
7. Backend updates queue item → status=approved, then calls execution handler
8. Execution handler (Phase 4) calls Zernio API → schedules posts
9. Result written to activity_log → operator sees confirmation toast
```

(Today, only steps 1, 4, 5, 6, 7 exist — webhook and execution arrive in Phase 4.)

---

## 3. Architecture Principles

These are the rules that keep one thing from breaking everything:

### 3.1 One Concern Per Module
Every file in `app/` has exactly one job. Index creation lives in `indexes.py`.
Seeding lives in `seed.py`. They never touch each other.

### 3.2 Strict Layered Imports
```
  config  ──→  db  ──→  security  ──→  models  ──→  deps  ──→  routes
                                                   │
                                          brute_force, seed, indexes
```
A lower layer **never** imports an upper layer. This guarantees you can pull
out `routes/operators.py` and the rest of the app still imports fine.

### 3.3 Fail-Loud Boundaries, Soft-Fail Optimizations
- **Critical contracts** (auth, DB queries, JWT verification): raise
  immediately. Don't paper over bad inputs with defaults.
- **Optimizations** (index creation on startup): log the failure and move on.
  The app must still serve traffic even if a single index is misconfigured.

### 3.4 No Hardcoded Config
Every URL, secret, port, and credential comes from `.env`. The `config.py`
module is the only place that reads `os.environ` directly — grep `os.environ`
across the codebase and you'll find exactly one file using it.

### 3.5 Frontend: Components Don't Speak HTTP
Components import from `services/*Service.js`. Services use `lib/api.js`.
If we swap axios for fetch, only `lib/api.js` changes. If the auth endpoint
moves, only `services/authService.js` changes.

### 3.6 RBAC at the API Boundary
Every protected route declares its required role via `Depends(require_role(...))`.
You can audit who-can-call-what just by grepping `require_role` across `routes/`.

---

## 4. Tech Stack

| Layer | Tech | Why |
|---|---|---|
| Frontend | React 19 (CRA) + Tailwind + lucide-react | Existing repo baseline. Fast to iterate on operations UI. |
| Backend | FastAPI (Python 3.11) + motor | Async Mongo driver, clean DI, easy testing |
| DB | MongoDB | Document-oriented fits the heterogeneous `payload` of approval items |
| Auth | bcrypt + PyJWT in httpOnly cookies | Simple, secure, no third-party dep |
| Realtime | WebSocket (Phase 7) | Push approval/notification events |
| Cron | APScheduler (Phase 5) | In-process, no extra infra |
| Email | Resend (Phase 5) | Simplest transactional email API |
| Encryption | Fernet (cryptography) | Symmetric AES-128, for stored MCP credentials |
| Deploy | Emergent platform (supervisor-managed) | Native to this environment |

**Adapted from original spec (Doc 2B): Next.js→React, Supabase→MongoDB+JWT,
Supabase Realtime→WebSocket, Vercel Cron→APScheduler.** See
`/app/SmartClix_Refined_Spec.md` §1.2 for the full mapping and rationale.

---

## 5. Repository Layout

```
/app
├── backend/
│   ├── server.py                 # FastAPI entry point — thin (45 lines)
│   ├── requirements.txt
│   ├── .env                      # see §12
│   ├── app/                      # the actual backend code
│   │   ├── __init__.py
│   │   ├── config.py             # env loading
│   │   ├── db.py                 # Mongo client + db handle
│   │   ├── security.py           # bcrypt, JWT, cookies, client-ip
│   │   ├── models.py             # Pydantic DTOs
│   │   ├── deps.py               # FastAPI dependencies (auth, RBAC)
│   │   ├── brute_force.py        # login lockout
│   │   ├── indexes.py            # Mongo index creation
│   │   ├── seed.py               # admin/reviewer seeding
│   │   └── routes/
│   │       ├── __init__.py       # api_router aggregator
│   │       ├── health.py         # GET /api/health
│   │       ├── auth.py           # POST/GET /api/auth/*
│   │       └── operators.py      # CRUD /api/operators/*
│   └── tests/
│       ├── conftest.py           # admin_session / reviewer_session fixtures
│       └── test_smartclix_phase1.py
│
├── frontend/
│   ├── package.json
│   ├── .env                      # REACT_APP_BACKEND_URL
│   └── src/
│       ├── App.js                # Router + AuthProvider + Toaster
│       ├── index.css             # Design tokens + Inter Tight font
│       ├── lib/
│       │   └── api.js            # Axios instance + error formatter
│       ├── services/
│       │   ├── authService.js    # All /api/auth/* calls
│       │   └── operatorsService.js # All /api/operators/* calls
│       ├── contexts/
│       │   └── AuthContext.js    # Auth state (null|false|operator)
│       ├── components/
│       │   ├── ProtectedRoute.js # Route guard with role check
│       │   └── DashboardLayout.js # Sidebar + header + outlet
│       └── pages/
│           ├── Login.js
│           ├── Overview.js
│           ├── Clients.js        # placeholder, Phase 2
│           ├── Approvals.js      # placeholder, Phase 3
│           ├── Analytics.js      # placeholder, Phase 6
│           ├── Notifications.js  # placeholder, Phase 7
│           └── Settings.js       # Profile + Team (admin) + Email + Prefs
│
├── memory/
│   ├── PRD.md                    # What's built, what's next
│   └── test_credentials.md       # Seeded creds + endpoint list
│
├── SmartClix_Refined_Spec.md     # Corrections + tech-stack adaptation
└── README.md                     # this file
```

---

## 6. Backend Module Map

```
                            ┌─────────────────┐
                            │   server.py     │  FastAPI app, CORS,
                            │  (entry point)  │  startup hooks
                            └────────┬────────┘
                                     │
                                     ▼
                            ┌─────────────────┐
                            │ app/routes/__init__ │  api_router aggregator
                            └────────┬────────┘
                ┌────────────────────┼────────────────────┐
                ▼                    ▼                    ▼
        ┌──────────────┐    ┌──────────────┐    ┌──────────────┐
        │ routes/      │    │ routes/      │    │ routes/      │
        │  health.py   │    │  auth.py     │    │  operators.py│
        └──────────────┘    └──────┬───────┘    └──────┬───────┘
                                   │                   │
                                   ▼                   ▼
                            ┌──────────────────────────────┐
                            │           deps.py            │
                            │  get_current_operator        │
                            │  require_role(*roles)        │
                            └──────────────┬───────────────┘
                                           │
                ┌──────────────────────────┼──────────────────────────┐
                ▼                          ▼                          ▼
        ┌──────────────┐          ┌──────────────┐          ┌──────────────┐
        │  security.py │          │ brute_force  │          │   models.py  │
        │  bcrypt/JWT  │          │   lockout    │          │   Pydantic   │
        │  cookies/IP  │          │              │          │              │
        └──────┬───────┘          └──────┬───────┘          └──────────────┘
               │                         │
               └───────────┬─────────────┘
                           ▼
                    ┌──────────────┐
                    │    db.py     │  Mongo client + handle
                    └──────┬───────┘
                           │
                           ▼
                    ┌──────────────┐
                    │  config.py   │  env loading (one file, one purpose)
                    └──────────────┘
```

**Import direction is strictly downward in this diagram.** Lower modules
never import higher ones.

---

## 7. Frontend Module Map

```
                ┌────────────────────┐
                │      App.js        │  BrowserRouter + Routes + AuthProvider
                └─────────┬──────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
  ┌──────────┐    ┌───────────────┐  ┌─────────────────┐
  │ Login.js │    │ProtectedRoute │  │ DashboardLayout │
  │          │    │(role check)   │  │ (sidebar+header)│
  └────┬─────┘    └───────┬───────┘  └────────┬────────┘
       │                  │                   │
       │                  └───────────────────┤
       │                                      │
       │           ┌──────────────────────────┴─────────────────────┐
       │           ▼                       ▼                        ▼
       │      Overview.js              Settings.js             Other pages
       │           │                       │                  (placeholders)
       │           │                       │
       └───────────┴───────────────────────┴───┐
                                               ▼
                                      ┌─────────────────┐
                                      │ AuthContext.js  │
                                      │  operator state │
                                      └────────┬────────┘
                                               ▼
                              ┌────────────────────────────────┐
                              │  services/authService.js       │
                              │  services/operatorsService.js  │
                              └────────────┬───────────────────┘
                                           ▼
                                  ┌─────────────────┐
                                  │   lib/api.js    │  axios instance
                                  │                 │  + error formatter
                                  └─────────────────┘
```

**Components never call axios directly.** If you find `import axios` in a
page file, that's a bug — move it to a service.

---

## 8. Authentication Flow

```
┌──────────────┐                ┌─────────────┐                ┌──────────┐
│   Browser    │                │   Backend   │                │  Mongo   │
└──────┬───────┘                └──────┬──────┘                └────┬─────┘
       │  POST /api/auth/login         │                            │
       │  { email, password }          │                            │
       ├──────────────────────────────▶│                            │
       │                                │ check_lockout(ip:email)   │
       │                                ├───────────────────────────▶
       │                                │ login_attempts lookup     │
       │                                │◀───────────────────────────
       │                                │                            │
       │                                │ operators.find_one(email) │
       │                                ├───────────────────────────▶
       │                                │◀───────────────────────────
       │                                │ bcrypt.checkpw            │
       │                                │                            │
       │                                │ create_access_token (8h)   │
       │                                │ create_refresh_token (7d)  │
       │                                │                            │
       │  200 { id, email, role,...}    │                            │
       │  Set-Cookie: access_token=...  │                            │
       │  Set-Cookie: refresh_token=... │                            │
       │     httponly; secure;          │                            │
       │     samesite=none              │                            │
       │◀───────────────────────────────│                            │
       │                                │                            │
       │  GET /api/auth/me              │                            │
       │  Cookie: access_token=...      │                            │
       ├───────────────────────────────▶│                            │
       │                                │ decode_token(access)      │
       │                                │ operators.find_one(sub)   │
       │                                ├───────────────────────────▶
       │                                │◀───────────────────────────
       │  200 { id, email, role,... }   │                            │
       │◀───────────────────────────────│                            │
```

**Token strategy:**
- Access token = 8 hours, in httpOnly cookie
- Refresh token = 7 days, in httpOnly cookie
- Frontend never sees the tokens. It just sends `withCredentials: true` and
  the browser handles cookies.
- On access-token expiry, frontend can call `/api/auth/refresh` to mint a new one.

**Brute force:**
- Failure increments `login_attempts.{ip:email}.count`.
- 5 failures → `locked_until = now + 15min`, count resets.
- Client IP comes from `X-Forwarded-For` (k8s ingress sets it correctly).
- Successful login → row deleted, counter cleared.

---

## 9. Authorization Model

| Resource | admin | manager | reviewer |
|---|---|---|---|
| Operators list/create/delete | ✅ | ❌ | ❌ |
| Clients list | all | all | own only (Phase 2) |
| Clients create/edit/delete | ✅ | ✅ | ❌ |
| Workspaces toggle services | ✅ | ✅ | ❌ |
| MCP Connections read/write | all | all | own only |
| Approval Queue read | all | all | own only |
| Approval approve/reject | ✅ | ✅ | own only |
| Cross-client Analytics | ✅ | ✅ | ❌ |
| Settings → Email Configuration | ✅ | ❌ | ❌ |
| Settings → Team | ✅ | ❌ | ❌ |

**How it's enforced:** every protected route declares its role via
`Depends(require_role("admin", "manager"))` and the frontend hides the menu
items the operator can't access. Server is always the source of truth.

---

## 10. Data Model (MongoDB)

Database name: `smartclix` (set via `DB_NAME` env).

```
┌──────────────────┐         ┌─────────────────┐
│   operators      │         │   clients       │
│  _id             │◀───┐    │  _id            │
│  email (unique)  │    │    │  name           │
│  name            │    └────│  assigned_to    │
│  role            │         │  status         │
│  password_hash   │         │  location       │
│  last_login      │         │  data_deletion_ │
└──────────────────┘         │    date         │
                             └────────┬────────┘
                                      │ 1:1
                                      ▼
                             ┌─────────────────┐
                             │   workspaces    │
                             │  _id            │
                             │  client_id      │
                             │  *_enabled      │
                             │  onboarding_*   │
                             └────────┬────────┘
                                      │
            ┌────────────┬────────────┼────────────┬────────────┐
            ▼            ▼            ▼            ▼            ▼
    ┌───────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
    │ approval_ │ │ mcp_     │ │onboarding│ │analytics_│ │activity_ │
    │  queue    │ │ connect. │ │ _items   │ │snapshots │ │  log     │
    └───────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘

    ┌───────────────┐  ┌────────────────────────┐  ┌──────────────────┐
    │ notifications │  │ password_reset_tokens  │  │ login_attempts   │
    └───────────────┘  │  (TTL on expires_at)   │  └──────────────────┘
                       └────────────────────────┘

    ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  ┌──────────────┐
    │ client_access│  │  cost_log    │  │  lsa_leads  │  │ lsa_disputes │
    └──────────────┘  └──────────────┘  └─────────────┘  └──────────────┘
```

Full schema in `/app/SmartClix_Refined_Spec.md` §3. Indexes are created on
startup via `app/indexes.py`.

---

## 11. API Reference

Base URL: `${REACT_APP_BACKEND_URL}/api`

### Public
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/health` | — | `{status, service, time}` |
| POST | `/auth/login` | `{email, password}` | `Operator` + sets cookies |
| POST | `/auth/forgot-password` | `{email}` | `{ok, message}` (always identical) |
| POST | `/auth/reset-password` | `{token, new_password}` | `{ok}` |

### Authenticated (any role)
| Method | Path | Returns |
|---|---|---|
| GET | `/auth/me` | `Operator` |
| POST | `/auth/logout` | `{ok}` + clears cookies |
| POST | `/auth/refresh` | `{ok}` + new access cookie |

### Admin only
| Method | Path | Body | Returns |
|---|---|---|---|
| GET | `/operators` | — | `Operator[]` |
| POST | `/operators` | `{email, name, role, password}` | `Operator` (201) |
| PATCH | `/operators/{id}` | `{name?, role?}` | `Operator` |
| DELETE | `/operators/{id}` | — | `{ok}` (400 if deleting self) |

### Error format

```json
{ "detail": "string OR validation array" }
```

The frontend's `formatApiError()` (in `lib/api.js`) handles both shapes so a
component never crashes from rendering an error object.

### Operator shape

```json
{
  "id": "65f1234...",
  "email": "admin@smartclix.app",
  "name": "Platform Admin",
  "role": "admin" | "manager" | "reviewer",
  "created_at": "2026-05-24T00:00:00+00:00",
  "last_login": "2026-05-24T00:36:42+00:00" | null
}
```

---

## 12. Environment Variables

### Backend (`/app/backend/.env`)

| Var | Required | Notes |
|---|---|---|
| `MONGO_URL` | ✅ | e.g. `mongodb://localhost:27017` |
| `DB_NAME` | ✅ | `smartclix` |
| `CORS_ORIGINS` | ✅ | Comma-separated. **Wildcard `*` won't work with `credentials: include`.** |
| `JWT_SECRET` | ✅ | 64-char hex. Generate: `python -c "import secrets;print(secrets.token_hex(32))"` |
| `ADMIN_EMAIL` | ✅ | Seeded on startup. **Use a real TLD; `.local` is rejected by EmailStr.** |
| `ADMIN_PASSWORD` | ✅ | If changed, password hash is updated on next startup. |
| `TEST_REVIEWER_EMAIL` | optional | Phase 1 test account |
| `TEST_REVIEWER_PASSWORD` | optional | |
| `FERNET_KEY` | Phase 2+ | For MCP credential encryption. Generate: `python -c "from cryptography.fernet import Fernet;print(Fernet.generate_key().decode())"` |
| `WEBHOOK_SECRET` | Phase 4 | Shared with Cowork operator |
| `USE_MOCK_EXECUTORS` | optional | `true` (default) lets execution flow without real Zernio/AdKit |
| `RESEND_API_KEY` | Phase 5 | For email sending |

### Frontend (`/app/frontend/.env`)

| Var | Notes |
|---|---|
| `REACT_APP_BACKEND_URL` | The Emergent preview URL. **Same host as the frontend** — Emergent's ingress rewrites `/api/*` to backend:8001. |

---

## 13. Running Locally

Services are managed by `supervisor`. You should never start your own server.

```bash
# Status of all services
sudo supervisorctl status

# Restart after .env or dependency changes
sudo supervisorctl restart backend
sudo supervisorctl restart frontend

# Logs
tail -f /var/log/supervisor/backend.err.log
tail -f /var/log/supervisor/backend.out.log
tail -f /var/log/supervisor/frontend.err.log
```

Hot reload is enabled for both backend (uvicorn `--reload`) and frontend (CRA).
**Restart is only needed for `.env` changes or new packages.**

---

## 14. Testing

### Backend (pytest, hits live API)

```bash
cd /app/backend/tests
pytest -v
```

Expected: **12/12 passing** (auth flow, brute-force, operators CRUD).

Tests are HTTP-level — they import nothing from `app/` so refactoring the
backend won't break them as long as the API contract holds.

### Frontend (Playwright via testing agent)

Frontend tests run through the testing subagent. See latest report at
`/app/test_reports/iteration_1.json`. Expected **11/11 passing**.

### Quick smoke tests

```bash
API=$(grep REACT_APP_BACKEND_URL /app/frontend/.env | cut -d= -f2)

# Health
curl -s "$API/api/health"

# Login + me
curl -s -c /tmp/c.txt -X POST "$API/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@smartclix.app","password":"Admin#12345"}'
curl -s -b /tmp/c.txt "$API/api/auth/me"
```

Seeded test credentials are in `/app/memory/test_credentials.md`.

---

## 15. Troubleshooting / Debug Playbook

### "Network Error" or CORS error in browser console

```
Access to XMLHttpRequest ... has been blocked by CORS policy:
The value of the 'Access-Control-Allow-Origin' header must not be the
wildcard '*' when the request's credentials mode is 'include'.
```

**Cause:** `CORS_ORIGINS=*` in backend `.env`. Wildcard is incompatible
with `withCredentials: true` (which we need for cookies).

**Fix:** Set `CORS_ORIGINS` to the exact frontend origin(s), comma-separated.
Restart backend.

---

### Login returns 422 with "value is not a valid email address"

**Cause:** Email uses a TLD Pydantic's `EmailStr` rejects (`.local`,
`.localhost`, `.test`, `.example`).

**Fix:** Use `.app`, `.io`, `.com`, etc. for seeded accounts. We use
`@smartclix.app`.

---

### Backend says "Missing required env var: X"

**Cause:** `app/config.py` calls `_required()` for critical vars. Missing
vars fail fast on startup instead of crashing mid-request.

**Fix:** Check `/app/backend/.env`. Run `cat /app/backend/.env`.

---

### Brute-force lockout doesn't trigger / triggers wrong

**Cause:** `request.client.host` reports the k8s ingress pod IP, which varies
between replicas. We use `X-Forwarded-For` instead (see `security.py:client_ip`).

**Reset state:**
```bash
mongosh smartclix --eval 'db.login_attempts.deleteMany({})'
```

---

### Cookies not being set / `/api/auth/me` returns 401 right after login

**Causes (in order of likelihood):**
1. **Mixed origin** — the frontend bundle hardcoded a different
   `REACT_APP_BACKEND_URL` at build time than the host it's loaded from.
   Check: open browser devtools → Network → login request URL. It must
   match the page origin.
2. **HTTP, not HTTPS** — `Secure: true` cookies require HTTPS. Local dev
   on `http://localhost:3000` works because browsers exempt localhost.
3. **CORS not whitelisting credentials** — make sure
   `allow_credentials=True` and the origin is NOT `*`.

---

### Sidebar shows "Analytics" for reviewer (should be hidden)

**Where to look:** `frontend/src/components/DashboardLayout.js` — the
`navItems` list filters by `isAdminOrManager`. Also `App.js` wraps the
analytics route in `<ProtectedRoute roles={["admin","manager"]}>`.

If the menu shows but the page doesn't load, the menu filter has drifted
from the route guard. **Server is the source of truth** — if the route
guard works, the data is safe regardless of the menu.

---

### Mongo write fails with `OperationFailure: index already exists with a different name`

**Cause:** You changed an index definition in `app/indexes.py` but the old
index is still in the DB.

**Fix:**
```bash
mongosh smartclix --eval 'db.<collection>.dropIndex("<old_index_name>")'
sudo supervisorctl restart backend  # rebuilds with new definition
```

`ensure_indexes()` catches `OperationFailure` and logs it — so the app
still boots and the rest of the indexes still build. Look in
`/var/log/supervisor/backend.out.log` for the warning.

---

### Frontend hot-reload not picking up changes

```bash
sudo supervisorctl restart frontend
```

CRA sometimes loses the file watcher. A restart re-establishes it.

---

### Slide-in panel submit button gets blocked by "Made with Emergent" badge in preview

The Emergent dev badge is a fixed-position element at the bottom-right of
the viewport. Sticky/fixed footer buttons in right-side panels can get
covered by it (Playwright sees an "intercepted click" warning).

**Fix pattern:** place action buttons inline at the end of the form's
scrollable content (NOT a sticky footer), and stack them vertically with
enough bottom padding (e.g. `pb-40`) so they clear the badge area. See
`pages/Clients.js` NewClientPanel for the canonical layout.

---

### Tests pass locally but fail in CI / Playwright

The conftest fixture reads `REACT_APP_BACKEND_URL` from env. If your CI
runs against `http://localhost:8001` directly, you may need to set
`REACT_APP_BACKEND_URL=http://localhost:8001` for that test run.

---

## 16. Build Phases & Roadmap

| Phase | Scope | Status |
|---|---|---|
| **Phase 1** | Foundation: auth, schema, RBAC, dashboard shell | ✅ Complete |
| **Phase 2** | Clients CRUD, Workspaces, Services toggle, Onboarding, MCP Connections (Fernet encryption), Workspace ID display | ✅ Complete |
| Phase 3 | Approval Queue + 8 review modal variants | Next |
| Phase 4 | Cowork webhook receiver, execution handlers (mocked behind `USE_MOCK_EXECUTORS`) | Pending |
| Phase 5 | Token Health cron (APScheduler) + Resend email | Pending |
| Phase 6 | Analytics display (rankings, social, ads, GBP) | Pending |
| Phase 7 | Notifications Center + WebSocket pub/sub | Pending |
| Phase 8 | Polish, rate-limit, security hardening, mobile QA | Pending |

Full phase details in `/app/SmartClix_Refined_Spec.md`.

---

## 17. Conventions

### Backend

- **Imports order:** stdlib → third-party → `app.*`
- **No bare `except:`.** Always name the exception.
- **No `os.environ` outside `config.py`.** Grep enforces this.
- **Every Mongo document field that's a `_id` is serialized to `id` (string)
  before leaving the server.** See `models.py:serialize_operator` as the
  canonical example.
- **datetimes are stored as ISO strings.** Convert on read with
  `datetime.fromisoformat(...)`. Always use `now_utc()` from `security.py`.

### Frontend

- **`data-testid` on every interactive element** — buttons, links, inputs,
  modals. Kebab-case, describes function not style. E.g.
  `data-testid="login-submit-btn"`.
- **Tailwind only** — no inline styles, no CSS modules. Design tokens via
  `--color-*` CSS vars in `index.css`.
- **Components < 150 lines.** Bigger = split it up.
- **Services for HTTP** — components never import `axios` directly.

### Git

- This is an Emergent project. Use the "Save to GitHub" feature in the
  chat input for git operations.

---

## 18. Related Documents

| File | Purpose |
|---|---|
| `SmartClix_Refined_Spec.md` | Consolidated spec from the original Docs 2B + 3, with 15 inconsistencies corrected and tech-stack adapted to React+FastAPI+MongoDB. **Read this for product scope.** |
| `memory/PRD.md` | Build status, personas, prioritized backlog |
| `memory/test_credentials.md` | Seeded credentials + endpoint quick-reference |
| `test_reports/iteration_*.json` | Testing agent reports |

---

*SmartClix Operator Dashboard · README v1.0*
*This README ages with the codebase — update it when you add a module, change a flow, or break a convention.*
