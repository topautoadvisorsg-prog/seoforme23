# SmartClix — Deployment Guide (Railway + MongoDB Atlas)

This deploys the whole app as **one Railway service**. FastAPI serves both the
React app and the `/api` routes from a single URL — simplest possible setup,
no CORS or cross-site cookie issues.

```
   Browser ──► Railway service (FastAPI)  ──►  MongoDB Atlas (the database)
                ├─ serves the React app
                └─ /api/* + /api/webhooks/cowork  ◄── Cowork agents POST here
```

---

## What is MongoDB Atlas? (plain English)

The app stores all its data (clients, approvals, operators…) in a database
called **MongoDB**. On your laptop we run MongoDB locally. But once the app
lives on the internet (Railway), it needs a database that also lives on the
internet so it's reachable 24/7.

**MongoDB Atlas** is the official cloud-hosted version of MongoDB, run by the
same company. It has a **free tier** (called M0) that's plenty for this. You
create a database there, and it gives you one long **connection string** (a URL
starting with `mongodb+srv://…`). We paste that into Railway, and the app uses
it instead of the local database. That's the whole idea — it's just "our
database, but hosted for us, for free."

---

## STEP 1 — Create the database (MongoDB Atlas) — *your part, ~10 min*

1. Go to **https://www.mongodb.com/cloud/atlas/register** and sign up (Google
   sign-in is fine).
2. When asked, create a **free / M0 / Shared** cluster. Pick any cloud provider
   and the region closest to you. Leave the defaults. Click **Create**.
3. It will prompt to create a **database user**:
   - Username: `smartclix`
   - Password: click **Autogenerate** and **copy it somewhere safe** (you'll
     need it in the connection string).
4. **Network access**: when asked "Where would you like to connect from?",
   choose **Allow access from anywhere** (`0.0.0.0/0`). (Railway's servers
   don't have a fixed IP, so this is the simple correct choice. The database
   is still protected by the username/password.)
5. Once the cluster is ready (1–3 min), click **Connect → Drivers**. You'll see
   a connection string like:
   ```
   mongodb+srv://smartclix:<db_password>@cluster0.xxxxx.mongodb.net/?retryWrites=true&w=majority
   ```
   Replace `<db_password>` with the password from step 3.

**➡️ Send me that final connection string** (with the password filled in). That's
the one thing I can't do for you.

---

## STEP 2 — Get the code on GitHub — *your part, I'll prep everything*

Railway deploys from a GitHub repo. The project isn't on GitHub yet.
- If you want, create an **empty GitHub repo** (e.g. `smartclix-dashboard`) and
  tell me the URL — I'll get the code pushed to it.
- (Or tell me your GitHub username and I'll walk you through it.)

---

## STEP 3 — Deploy on Railway — *we do together*

1. In Railway: **New Project → Deploy from GitHub repo** → pick the repo.
2. Railway auto-detects the `Dockerfile` and builds it.
3. Add the **environment variables** below (Railway → service → Variables).
4. Railway gives you a public URL (e.g. `smartclix-production.up.railway.app`).
   Open it → you should see the login page.

### Environment variables to set on Railway

| Variable | Value |
|---|---|
| `MONGO_URL` | *(the Atlas connection string from Step 1)* |
| `DB_NAME` | `smartclix` |
| `JWT_SECRET` | `‹JWT_SECRET — set in Railway, not stored in repo›` |
| `FERNET_KEY` | `‹FERNET_KEY — set in Railway, not stored in repo›` |
| `WEBHOOK_SECRET` | `‹WEBHOOK_SECRET — set in Railway, not stored in repo›` |
| `ADMIN_EMAIL` | *(your real email, e.g. you@smartclix.app — must be a real TLD)* |
| `ADMIN_PASSWORD` | *(pick a strong password — this is your login)* |
| `USE_MOCK_EXECUTORS` | `true` |
| `COOKIE_SECURE` | `true` |

*(The actual JWT/FERNET/WEBHOOK values were generated separately and are set
directly in Railway's Variables — deliberately NOT committed to this repo.)*

---

## STEP 4 — Point Cowork at the live URL

Once deployed, Cowork agents POST their output to:
```
POST https://<your-railway-url>/api/webhooks/cowork
Header:  x-webhook-secret: ‹WEBHOOK_SECRET — set in Railway, not stored in repo›
Body:    { "workspace_id": "<from a client's 'Workspace ID' button>",
           "item_type": "social_batch", "title": "...", "payload": { ... } }
```
`backend/scripts/send_test_webhook.py` is a working reference for exactly what
to send.

---

## Notes

- **First boot** auto-creates the admin account from `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` and builds all database indexes. Nothing else to run.
- **Going live with real posting:** flip `USE_MOCK_EXECUTORS=false` once real
  Zernio/AdKit/Google credentials are wired (later phase). Until then it safely
  simulates execution.
- **Local dev still works unchanged** — `FRONTEND_BUILD_DIR` is only set inside
  Docker; locally the React app runs separately on :3000.
