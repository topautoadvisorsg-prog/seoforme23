# Cowork Setup — Video Pipeline (baby-step guide)

This is the "what YOU do in Cowork" half. The dashboard half is already built.
Goal: **Cowork makes the video with Higgsfield → sends it to the dashboard →
you approve → publish.**

```
  You/Cowork write a script
        │
        ▼
  Cowork POSTs the script ──►  Dashboard  ──►  you APPROVE the script (free — the money gate)
                                    │
        ┌───────────────────────────┘  (script now "awaiting render")
        ▼
  Cowork renders it with Higgsfield  ──►  POSTs the finished video ──►  you APPROVE ──► publish
```

You do NOT need to understand any code. Follow the steps.

---

## What "Cowork" is (30-second version)

Cowork is the desktop Claude app you already have (the one with New Task,
Projects, Scheduled, Connectors). Think of it as an employee that can use tools
you connect to it. We're going to (1) give it Higgsfield so it can make videos,
and (2) tell it how to send finished work to your dashboard.

---

## STEP 1 — Buy Higgsfield Starter ($15/mo) — *your part, 2 min*

- Go to https://higgsfield.ai/pricing → **Starter** ($15/mo, 200 credits).
- That's ~23 Kling videos/month — enough to test. We upgrade later when it's real.

---

## STEP 2 — Connect Higgsfield to Cowork — *your part, 3 min*

Higgsfield's own instructions (from their site):

1. Copy this URL: `https://mcp.higgsfield.ai/mcp`
2. In Cowork: **Settings → Connectors → Add custom connector**
3. Name it **Higgsfield**, paste the URL, click **Add → Connect**
4. Sign in with your Higgsfield account. Done.

**Test it works:** open a new task in Cowork and type:
> *"Using Higgsfield, generate a 5-second video of a coffee cup on a wooden table, cinematic."*

If a video comes back, Higgsfield is wired. ✅ (If Cowork asks which connector,
pick Higgsfield.)

> Note: Higgsfield says for Claude Code/CLI-type agents the **CLI** is better than
> the MCP connector for batch jobs. For the Cowork *desktop* app, the connector
> above is the right choice. We can switch to the CLI later if you start batching
> lots of renders.

---

## STEP 3 — Tell Cowork about your dashboard — *we do together, after deploy*

Cowork sends finished work to the dashboard by making a web request to a single
address (the "webhook"). You'll set this up as a **Cowork Project** so it
remembers the instructions.

1. In Cowork: **Projects → New Project**, name it **SmartClix**.
2. In the project instructions, paste the block below. **I will fill in the real
   `DASHBOARD_URL` and `WEBHOOK_SECRET` for you** (they're not stored here for
   security):

```
When I approve a video SCRIPT in SmartClix, or when you finish rendering a video,
send it to the SmartClix dashboard by POSTing to:

  {DASHBOARD_URL}/api/webhooks/cowork
  Header:  x-webhook-secret: {WEBHOOK_SECRET}

To submit a SCRIPT for approval, send:
  { "workspace_id": "<the client's Workspace ID>",
    "item_type": "video_script",
    "title": "<short title>",
    "payload": { "script": "<the script>", "duration": "30s" } }

To check which approved scripts are waiting to be rendered, GET:
  {DASHBOARD_URL}/api/approvals?item_type=video_script&status=approved&execution_status=awaiting_render
  (send the same x-webhook-secret is NOT needed here — this needs an operator login;
   for now I'll tell you which ones to render.)

After you render a video with Higgsfield, send the FINISHED video:
  { "workspace_id": "<same Workspace ID>",
    "item_type": "video_final",
    "title": "Finished — <title>",
    "payload": { "video_url": "<the Higgsfield video URL>",
                 "source_script_id": "<the id of the script>" } }
```

3. The **Workspace ID** comes from the dashboard: open a client → click
   **Workspace ID** (bottom of the sidebar) → copy it.

---

## STEP 4 — How you'll actually use it, day to day

1. In Cowork's SmartClix project: *"Write a 30-second video script for Demo Co
   about their spring AC tune-up, then submit it to SmartClix."*
2. Open your dashboard → **Content Queue** → the script is there. Read it, hit
   **Approve** (this is your money gate — nothing renders until you approve).
3. Back in Cowork: *"Render the approved script with Higgsfield and send the
   finished video to SmartClix."*
4. Dashboard → the **finished video** shows up → watch it → **Approve** → publish.

That's the whole loop. Scripts are free to review; you only spend a Higgsfield
credit after you approve.

---

## What I need from you to finish wiring

1. **The dashboard has to be live first** (or running on your PC) so Cowork has an
   address to send to. That still needs the **MongoDB Atlas link** + your
   **password** — same as before.
2. Once it's live, I give you the real `DASHBOARD_URL` + `WEBHOOK_SECRET` to paste
   into the Cowork project (Step 3).
3. You do Steps 1–2 (buy Higgsfield + connect it) any time — those don't need me.

**Order of operations:** (a) you buy + connect Higgsfield → (b) send me Atlas link
+ password → (c) I deploy → (d) I hand you the URL + secret → (e) you paste it into
Cowork → (f) we run the loop end to end.
