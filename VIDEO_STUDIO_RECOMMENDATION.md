# SmartClix Video Studio — Provider Integration Recommendation

*Grounded in research (July 2026). Sources listed at the bottom. Anything I
couldn't verify is flagged.*

---

## TL;DR

The single most important finding: **MCP and a server render pipeline are two
different problems that want two different tools.**

- **Server-side render pipeline** (the dashboard's executor, running unattended):
  use a **REST aggregator with an API key + webhooks — Fal.ai first.** NOT MCP.
- **Cowork / desktop-agent side** (an agent creating & previewing content
  interactively): **Higgsfield MCP is an excellent fit** — but that's a
  *client-side* tool, not the server pipeline.
- **Do not hardcode a provider.** Build a `VideoProvider` abstraction; implement
  **Fal.ai first**, add Higgsfield / Replicate / direct APIs as pluggable backends.
- **The approval queue we already built IS the cost/safety gate** — a render only
  fires after a human approves the script. That's the design that stops an
  autonomous agent from burning render money.

Your architecture diagram was right except for one box: replace
"Higgsfield MCP/CLI" as *the* provider with a **provider-abstraction layer whose
default server backend is a REST aggregator (Fal.ai)**. Higgsfield lives on the
Cowork side or as one backend behind the abstraction.

---

## 0. The pragmatic MVP path (you already run Cowork) — DO THIS FIRST

You don't have to build the server render pipeline to start. Given you already
run Cowork (desktop Claude agents), the fastest real path is:

```
Cowork agent  ──uses Higgsfield CLI──►  renders video (+ Soul character,
                                         viral clips, virality score…)
      │
      └──POST finished asset──►  Dashboard /api/webhooks/cowork
                                       │
                                 Approval queue  ──►  you approve  ──►  publish
```

**Why this first:**
- Uses what you already have (Cowork + the dashboard we built).
- Gets you Higgsfield's whole toolkit (Soul consistency, viral clipper, virality
  scoring, marketing-from-URL) that a raw API can't do.
- **Fixed, predictable cost** — a $15–$99/mo subscription, not metered surprises.
- The dashboard stays exactly what it is: the approval + publishing layer. **No
  new server render code needed yet.**

**The one hard limit:** Higgsfield credits are finite — Starter's 200/mo ≈ 23
Kling 3.0 videos. Fine to test; at real multi-client agency volume you'll burn
through them. That's the trigger to add the **Fal.ai server-side path** (pay-per-
use, scales) behind the same abstraction. Start Higgsfield; graduate to Fal when
volume demands it.

**Money gate stays intact:** approve the *script* (free) before Cowork spends a
credit rendering. Same two-stage flow, just triggered agent-side.

---

## 1. MCP vs CLI vs REST vs aggregator — for the SERVER pipeline

**Verified:** Higgsfield ships a hosted **MCP server** (`mcp.higgsfield.ai/mcp`,
launched Apr 30 2026) and a **CLI**. Its MCP auth is *"authenticate through your
Higgsfield account — no API keys to manage,"* and it bills against your
**Higgsfield subscription credits**.

That's perfect for an interactive agent (Claude Code/Desktop, or Cowork) and
**wrong for an unattended server**, which needs:

| Server pipeline needs | MCP (Higgsfield) | REST aggregator (Fal.ai) |
|---|---|---|
| Non-interactive auth (no browser OAuth session) | ✗ account OAuth | ✅ API key |
| Metered pay-per-use billing | ✗ subscription credits (90-day expiry) | ✅ per-second, no subscription |
| Async job + webhook callback | partial (`get_generation_status` polling) | ✅ queue + webhook |
| Predictable per-render cost | ✗ credit math varies by model | ✅ duration × published rate |

**Conclusion:** the server render pipeline should call a **plain REST API via an
aggregator**. Fal.ai gives one API key, 600+ models (Veo, Kling, Seedance,
Hailuo, Wan…), async queue + **webhook callbacks**, and transparent per-second
pricing. Replicate is an equivalent fallback.

> MCP/CLI is the *agent's* tool. REST is the *server's* tool. SmartClix has both
> surfaces, so it can use both — just not interchangeably.

---

## 2. Provider abstraction (don't hardcode)

Define one interface; the rest of the app never names a vendor:

```python
class VideoProvider(Protocol):
    name: str
    def estimate_cost(self, params: RenderParams) -> float: ...      # dollars, shown before approve
    async def submit(self, params: RenderParams) -> str: ...          # returns provider_job_id
    async def parse_webhook(self, payload: dict) -> RenderResult: ...  # {status, video_url, cost}
```

- **Implement `FalProvider` first** (`fal-ai/kling-video/v3` default).
- Add `HiggsfieldProvider` (CLI or Cloud API) and `ReplicateProvider` later — same
  interface, zero changes elsewhere.
- **Provider + model is a per-client setting** stored in the Connections tab
  (the encrypted `fal_video` entry already exists — generalize its label to
  "Video Provider" and add a provider dropdown).

This drops straight into the existing `executors.py`: `EXECUTION_TARGET` already
maps `video_script`/`video_final` to a target — swap the mock for
`provider.submit()`.

---

## 3. MVP vs research-only features

**MVP (every provider supports it, cheap, high value):**
- **Text-to-video** and **image-to-video** — image-to-video is the sleeper: feed a
  still (a Wildlands illustration, a product photo, a client's hero image) → motion.
- The **two-stage approval** (already built).
- **Cost estimate shown before the Approve button.**

**Research-only / Phase 2:**
- **Character consistency** (Higgsfield "Soul" / `create_character`; fal has some
  model-specific support) — real, but needs a per-client character library first.
- **Reference-clip → prompt** (Higgsfield "video analysis").
- **Virality scoring / marketing-video-from-URL** — Higgsfield gimmicks; fun, not core.

**Already done, no build needed:** *prompt history*. The `approval_queue` payload
**is** the prompt + version history — every script/render is a stored, reviewable record.

---

## 4. Build native vs delegate

| Concern | Who owns it |
|---|---|
| Provider abstraction, job tracking (submit → webhook → `video_final`) | **SmartClix (native)** |
| Cost metering, per-client budget caps, approval gates | **SmartClix (native)** |
| Encrypted credential storage (Connections) | **SmartClix (native — done)** |
| Actual generation / GPU / model hosting | **Provider (Fal/Higgsfield)** |
| Script writing, prompt engineering, storyboard, shot list | **Cowork / Claude** |

Cowork can *optionally* use **Higgsfield MCP** to preview/iterate a clip before it
POSTs the finalized script to `/api/webhooks/cowork`. The server then renders the
approved version through the REST provider. Best of both surfaces.

---

## 5. How it maps onto what we already built

- **`executors.py`** — replace the mock in the `video_script` → render path with
  `provider.submit()`. Today we enqueue `video_final` *instantly* with a mock URL;
  change it so the **provider webhook** (real finished render) is what enqueues
  `video_final`. Small, surgical change.
- **Connections** — `fal_video` credential entry already exists (encrypted). Add a
  provider selector.
- **Two-stage flow** — already correct: **script approval is the gate before any
  render dollars are spent.** Don't change it.
- **Mock → live cutover** — `USE_MOCK_EXECUTORS=false` + a real `FalProvider`.
  Keep a per-provider flag so you can go live on one client first.
- **`cost_report` webhook** — already exists; point real render costs at `cost_log`.

---

## 6. Security & cost control (production gate)

- **Secrets:** API keys encrypted (Fernet) in Connections — done. Never in repo/code.
- **Approval gate:** render fires **only after a human approves the script**
  (built). No autonomous render spend — this is the whole point.
- **Budget caps:** add a per-client **daily render-$ ceiling** + running `cost_log`;
  block/hold renders over the cap. (Backend enforced, not UI.)
- **Cost estimate:** show `duration × provider_rate` next to Approve, so the
  operator sees "$0.42" before clicking.
- **Webhook auth:** verify the provider's signed webhook (Fal supports it) in
  addition to our existing HMAC pattern.
- **If MCP is used on the Cowork side:** only the official hosted server
  (`mcp.higgsfield.ai`) over HTTPS OAuth; scoped tokens; don't persist the OAuth
  session server-side.
- **Concurrency cap** per client so a batch can't fan out unbounded.

---

## Recommendation in one line

**Build the `VideoProvider` abstraction, implement Fal.ai (REST + webhook) as the
server default, keep Higgsfield MCP for the Cowork/agent side, and let the
already-built script-approval step be the money gate.** MVP = text+image-to-video
through the existing two-stage queue; everything fancier (characters, references,
virality) is Phase 2.

---

## Sources
- Higgsfield MCP (official): https://higgsfield.ai/mcp
- Higgsfield CLI (official): https://higgsfield.ai/cli
- Higgsfield MCP setup guide: https://techsy.io/en/blog/higgsfield-mcp-claude-code
- Higgsfield MCP guide (models/tools): https://mcp.directory/blog/higgsfield-mcp-guide
- Higgsfield pricing/credits: https://www.imagine.art/blogs/higgsfield-ai-pricing · https://higgsfield.ai/pricing
- Fal.ai pricing (pay-per-use): https://fal.ai/pricing
- Fal.ai Kling/Seedance API + webhooks: https://fal.ai/models/fal-ai/kling-video/v2.1/pro/image-to-video/api · https://fal.ai/seedance-2.0
- AI video API pricing comparison 2026: https://devtk.ai/en/blog/ai-video-generation-pricing-2026/
- Replicate video models: https://replicate.com/collections/text-to-video · https://replicate.com/collections/image-to-video

*Not verified: Higgsfield's `cloud.higgsfield.ai` "Cloud API" page was gated/empty
at fetch time — I could not confirm it exposes a clean API-key, pay-per-use REST
API. Treat Higgsfield's programmatic surface as MCP + CLI (account/credit auth)
until proven otherwise.*
