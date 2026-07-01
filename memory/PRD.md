# SmartClix Operator Dashboard — PRD

## Original Problem Statement
> "read md do corrections before build refine spec md"

User uploaded two artifacts:
- SmartClix Document 2B — Developer Build Guide (Cowork-bridged multi-client agency operations dashboard)
- SmartClix Document 3 — UI/UX Spec

User clarified scope: refine + build Phase 1 only; hybrid stack (React + FastAPI + MongoDB, Resend kept for later email phase); JWT-based custom auth; mock external integrations initially.

## Refined Spec
Single source of truth: **`/app/SmartClix_Refined_Spec.md`**. Supersedes Documents 2B and 3 where they conflict. Section 1.1 lists 15 cross-document inconsistencies resolved; §1.2 documents the tech-stack adaptation (Supabase → MongoDB+JWT+WebSocket, Next.js → React, Vercel Cron → APScheduler, Resend kept).

## Architecture (Phase 1)
- **Frontend** — React 19 (CRA), Tailwind, Inter Tight + JetBrains Mono, design tokens per Doc 3
- **Backend** — FastAPI (Python 3.11), modular `app/` package: `config / db / security / models / deps / brute_force / indexes / seed` + `routes/{health,auth,operators}`. `server.py` is a 45-line entry point.
- **DB** — MongoDB with 15-collection schema deployed (14 indexes auto-created on startup, soft-fail if index errors)
- **Auth** — httpOnly cookie JWT (8h access / 7d refresh), bcrypt, brute-force lockout with X-Forwarded-For aware client IP, admin seeding from env
- **Frontend services layer** — `services/authService.js` + `services/operatorsService.js` so components never call HTTP directly

## User Personas
1. **Admin** — full platform access; manages operators; configures email/secrets
2. **Manager** — cross-client ops; no team management
3. **Reviewer** — restricted to assigned clients; cannot see Analytics or Team settings

## What's Implemented
**Phase 1 (2026-05-24) — Foundation**
- Refined consolidated spec (`SmartClix_Refined_Spec.md`) + comprehensive README with diagrams + debug playbook
- Modular backend (`app/` package), strict layered imports, soft-fail index creation
- Frontend services layer (`services/*Service.js`)
- JWT auth (login/logout/me/refresh/forgot/reset), bcrypt, brute-force lockout (X-Forwarded-For aware)
- Operators admin-only CRUD, role-based dashboard shell + sidebar visibility

**Phase 2 (2026-05-24) — Client Management**
- Clients CRUD (`/api/clients`, `/api/clients/{id}`, `/api/clients/{id}/status`) — admin/manager only; reviewer-scoped reads via `authz.authorized_client_ids`
- Workspaces auto-created 1:1 with each client; all 8 services off by default
- Services toggle (`/api/clients/{id}/workspace/services`) — flipping ON generates onboarding items per service; flipping OFF purges them; if all services OFF, common items purged too
- Onboarding checklist (`/api/clients/{id}/onboarding`, `PATCH /api/onboarding-items/{id}`) — grouped by service, progress bar, auto-flips `workspace.onboarding_complete=true` when all items done
- MCP Connections (`/api/clients/{id}/connections`) — Fernet-encrypted credentials, masked display fields, never returns plaintext; per-service field specs for 8 services (Zernio, AdKit Meta/Google, GBP, GSC+GA4, BrightLocal, GatherUp, LinkedIn)
- Workspace ID modal for Cowork wiring (copy-to-clipboard + example payload)
- Frontend: `Clients.js` (list + slide-in panel), `ClientDetail.js` (header + ⋮ menu + 4 tabs), `clientDetail/{Overview,Services,Onboarding,Connections,WorkspaceIdModal}.js`
- Pause / resume / churn / hard-delete client flows with cascading data wipe on delete

## Testing Status
- Backend: **33/33 pytest pass** (Phase 1: 12 + Phase 2: 21 — auth, brute-force, operators, clients CRUD, status transitions, workspace toggles, onboarding generation/completion, encrypted connections with masking, reviewer scope)
- Frontend: Phase 1 11/11 Playwright pass; Phase 2 full user flow verified (login → clients list → create client → toggle service → mark onboarding → view connections → workspace ID modal)

## Prioritized Backlog
### P0 — Phase 3: Approval Queue
- Universal queue with filters + tabs (Pending/Flagged/Stale/Approved/Rejected)
- Review modals per item_type (social batch, video script, ads rec, GBP review, GBP Q&A, backlink, finished video, blog)
- Real-time updates via WebSocket
- Approve/Edit/Reject + stale-post handling

### P1 — Phase 4: Execution Layer
- Webhook receiver `/api/webhooks/cowork` with HMAC secret
- Execution handlers (Zernio, AdKit, WordPress, GBP) — mocked behind `USE_MOCK_EXECUTORS`
- Activity log writes

### P2 — Phase 5+: Token health cron (APScheduler), Resend email integration, Analytics display, Notifications center, LSA management, Activity log UI, polish + rate limiting

## Code Review Items (deferred to polish)
- Prevent demotion/deletion of last admin (org-lockout risk)
- Per-IP throttle on `/api/auth/forgot-password`
- Switch `VALID_ROLES` to Pydantic `Literal` type
- Add Pydantic `BaseDocument` helper for ObjectId↔str (currently inlined)
