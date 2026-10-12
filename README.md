# Acme Insurance intake

Desktop demo of a **physical phone on a desk**. The intake app lives inside the phone screen. Tap **Call** to start a speech-to-speech session with Grok Voice (xAI Realtime). Eve greets the caller, gathers intent, and the transcript stays after hangup.

This is a demo: mock phone chrome, no PSTN, no CRM, and synthetic data only.

## Screenshots

Desk phone + handoff notepad (home)

![Desk phone + handoff notepad (home)](./docs/screenshots/home-desk-phone.png)

Settings — Eve agent instructions

![Settings — Eve agent instructions](./docs/screenshots/settings-page.png)

## Run locally

```bash
npm install
cp .env.example .env.local
# put your xAI key in .env.local
npm run dev
```

Open [http://127.0.0.1:4317](http://127.0.0.1:4317). The key must stay on the server.

## Required env

| Variable | Where | Purpose |
| --- | --- | --- |
| `XAI_API_KEY` | `.env.local` / Fly secrets only | Used by `POST /api/session` to mint an ephemeral client secret from `https://api.x.ai/v1/realtime/client_secrets`. Never sent to the browser, MCP responses, logs, or git. |
| `MCP_AUTH_TOKEN` | `.env.local` / Fly secrets only | Server-held bearer for Streamable HTTP MCP at `/mcp` (`Authorization: Bearer …`). Min 24 characters. Without it `/mcp` answers `401`; required by `npm run start:public`. |
| `SESSION_ACCESS_TOKEN` | `.env.local` / Fly secrets only | Shared secret required by `POST /api/session` on the public host. Min 16 characters. **Required** by `npm run start:public` — it refuses to boot without it, so the public URL never mints Realtime tokens (and thus never spends `XAI_API_KEY`) for anonymous callers. Unset locally = open. |
| `DEMO_PASSWORD` | `.env.local` / Fly secrets only | Shared password for the public desk-phone UI. Min 8 characters. `POST /api/demo-login` validates it server-side and sets a site-wide (`Path=/`), HTTP-only, `SameSite=Strict` cookie valid for 8 hours, so the gate stays open across `/` and `/settings`; required by `npm run start:public`. Unset local dev stays open. |
| `DATA_DIR` | Fly volume | Persistent transcript root, read at runtime. Defaults to `./data`. Set to `/data` on Fly. Backoffice data is not stored here; it lives in memory. |

Do **not** prefix these with `NEXT_PUBLIC_`. The browser never receives the long-lived xAI key, the MCP bearer, the session access token, or the demo password.

Optional: `SESSION_RATE_LIMIT` (default `10`) and `SESSION_RATE_WINDOW_MS` (default `60000`) add a lightweight per-client rate limit on `POST /api/session`; set `SESSION_RATE_LIMIT=0` to disable. Single instance only.

## How a call starts

1. Tap **Call** on the phone. The browser asks for the microphone.
2. The app `POST`s `/api/session`. That route calls xAI with `XAI_API_KEY` and returns a short-lived token (`value`, ~300 seconds).
3. The browser opens `wss://api.x.ai/v1/realtime?model=grok-voice-latest` using the documented client protocol: `xai-client-secret.<token>`.
4. The client sends `session.update` with the saved Grok voice (default `eve`, `localStorage` key `acme-intake-voice`), intake instructions, `turn_detection: { type: "server_vad" }`, 24 kHz PCM, and `audio.input.transcription.model: "grok-transcribe"`.
5. Mic PCM is streamed as `input_audio_buffer.append`. Agent audio arrives as `response.output_audio.delta` and is played immediately.
6. After `session.updated`, the client sends `response.create` so Eve greets first.

Mute stops sending mic audio. **Hang up** closes the socket and keeps the transcript.

Without `XAI_API_KEY`, the phone still renders. The empty state explains that the server key is missing.

## Live demo workflow

The desk-phone call has a small server-mediated bridge over the shared in-memory demo store that MCP and the backoffice also use:

1. Ask Eve a product or coverage question (for example, “What does Auto Core cover?”). She looks up read-only demo product data and makes clear it is not a quote or binding coverage.
2. To report a claim, provide a three-digit demo policy number such as `105` (or say "one oh five"). Eve verifies its masked policy/customer details.
3. Eve collects a non-sensitive loss date, type, description, and severity; she reads them back and requires a clear yes before creating a demo claim.
4. Open `/backoffice/claims` to see the confirmed claim in the same in-memory store. The call transcript remains in the desk notepad as the handoff record.
5. Edit a product or policy in `/backoffice` (or over MCP) and ask Eve again: the next lookup reads the edited record without a redeploy.

Product lookup (`src/lib/live-intake/product-search.ts`) matches the caller's words, not the whole utterance: a catalog row matches when its name, line, category, coverage, step, or an English/Swedish alias appears as whole words in the sentence (plurals, Swedish definite forms, and `-försäkring` compounds such as `kattförsäkring` count). Description words are a fallback when nothing else matches. A generic "what do you offer" returns every active catalog row; a sentence naming several lines returns all of them. New vocabulary goes in that row's `aliases`. The insurance catalog is `data/backoffice/seed.json`. The support catalog is `data/seeds/support.json`. Lookup reads whichever seed is loaded in memory.

The browser has neither MCP credentials nor direct MCP access. It forwards Realtime function calls to a narrowly scoped server route; that route uses the shared MCP service for product/policy lookup, validates inputs, and writes only confirmed demo claims. The tool bridge returns no unmasked contact data, and the caller cannot change products or policies.

## Settings

Open **Settings** from the gear on the phone or the notepad chip, or go to `/settings`. Edit Eve’s system prompt, **Save**, or **Reset to default**. The text is stored in `localStorage` (`acme-intake-instructions`) and sent on the next Call as `session.update.session.instructions`. The default prompt is the active seed's prompt. Pick a Grok voice in the same panel. The choice is stored in `localStorage` (`acme-intake-voice`) and sent as `session.update.session.voice` on the next Call. Eve, Ara, Rex, Sal, and Leo have published samples that play without a key. Other samples, including Swedish, are synthesized by `GET /api/voices/preview` with the server-side `XAI_API_KEY`. A live call is not rewritten mid-session.

**Demo seed.** The same page switches the in-memory seed. Confirming a switch reseeds from that seed and discards runtime edits, including a custom phone name. Acme Insurance is the boot seed (policies, products, pricing, claims, and product aliases). Northstar Support is a generic service desk (customers, tickets, help topics) with its own support prompt. A process restart loads Acme Insurance again.

**Phone name and accent.** Settings also sets the name and accent shown on the desk phone. The seed supplies the defaults. A manual change lasts until the next seed switch or restart.

## Transcript storage

Each turn is a structured `{ speaker, text, status, timestamps }` item.

- **On the phone** during the call, and still visible after hangup.
- **Beside the phone** on large screens (desk notepad), with copy and JSON export.
- **Browser `localStorage`** key `acme-intake-calls` (last 20 calls).
- **Server handoff:** `POST /api/transcripts` writes `data/transcripts/<id>.json`. `GET /api/transcripts` lists them; `GET /api/transcripts/<id>` returns one.

User text comes from `conversation.item.input_audio_transcription.updated` / `.completed`. Agent text comes from `response.output_audio_transcript.*` (and text-delta aliases).

## Backoffice (demo)

`/backoffice` is a local operations demo backed by an in-memory store, not a real CRM. Nav, overview stats, and list/edit pages come from the active seed's collections. Acme Insurance shows customers, policies, products, pricing, and claims. Northstar Support shows customers, tickets, and help topics.

**Synthetic data only.** Every record is obviously fictional: `example.com` emails, `555-01xx` phone numbers, and made-up street names. This environment stores **no sensitive data** — no government IDs, no dates of birth used as identity, no payment cards, no medical details, no passwords, and no API keys. The `/api/backoffice/*` endpoints schema-reject any create/update payload carrying such fields, and voice transcripts are never filed into the backoffice store. Use **Reset demo data** to restore the committed seed.

**Editing.** Every entity page has an **Edit** button per row (or per product card) that opens an inline form for the fields on screen: customer contact details and status; policy status, coverage, deductible, premium, and term; product name, description, coverages, deductibles, and active flag; pricing rule premiums and active flag; claim status (forward only), owner, reserve, and paid amount. **Save** goes through the existing `PATCH /api/backoffice/*` routes.

**Storage: in memory, reset on restart.** `src/lib/backoffice/repository.ts` loads the insurance seed (`data/backoffice/seed.json`) into one in-memory store when the Next server boots (`src/instrumentation.ts`). The backoffice UI, the voice bridge, and MCP all read and write that same object, so an edit is visible on the next request everywhere. Nothing is written to disk: a redeploy or process restart reloads the insurance seed and discards every edit. Switching seeds does the same for the chosen file. Keep archived/inactive products out of the insurance seed even if a runtime edit archives one.

Seeds are declared in `src/lib/seeds/registry.ts`: an id, label, agent prompt, phone defaults, and collections with fields. Row JSON stays next to that manifest. A third seed is another entry plus a JSON file; the list/edit pages do not need a new screen.

## Demo MCP connector

The demo MCP server runs **inside the Next.js process** at `/mcp` and reads and
writes the same in-memory backoffice store as `/backoffice` and the voice bridge.
It exposes redacted synthetic customers, products, price indications, and claims,
and it never returns call transcripts. Price results are non-binding indications,
not quotes. Confirmed demo-claim creation stays on the Next.js server
(`POST /api/realtime/tools`) with the existing call-session confirmation binding —
there is no create-claim MCP tool.

Read tools: `search_demo_customers`, `get_demo_customer`, `list_demo_products`,
`get_demo_product`, `get_demo_price_indication`, `search_demo_claims`,
`get_demo_claim_status`.

Write tools (in-memory only; every change is gone after a restart or redeploy):

| Tool | Input | Effect |
| --- | --- | --- |
| `update_demo_customer` | `customerId` + any of `name`, `email`, `phone`, `address`, `status` | Patches the customer. Sensitive keys (`ssn`, `dob`, card data, …) are rejected. |
| `update_demo_product` | `productId` + any of `name`, `description`, `coverages`, `deductibles`, `active` | Patches the product. `lookup_demo_product` on the next call sees it. |
| `update_demo_policy` | `policyId` + any of `status`, `coverage`, `deductible`, `premium`, `effectiveDate`, `expirationDate` | Patches the policy. `verify_demo_policy` on the next call sees it. |
| `update_demo_pricing_rule` | `pricingRuleId` + any of `active`, `basePremium`, `minPremium`, `maxPremium`, `factors` | Patches the rule; the full rule is re-validated (max ≥ min). |
| `update_demo_claim` | `claimId`, `customerId` + any of `status`, `owner`, `reserve` | Forward-only status moves (reported → reviewing → approved → closed). |
| `reseed_demo_data` | `confirmation: "RESEED_DEMO_DATA"`, optional `seedId` | Wipes memory and reloads the active seed. Pass `seedId` (`insurance` or `support`) to switch seeds and reseed. Same bearer as the other tools. Omitting `seedId` matches **Reset demo data** for the seed already loaded. A process restart always boots `insurance`. |

Responses stay redacted: names, phones, emails, and policy/claim numbers are
masked, and premium/reserve amounts are stripped, exactly as for the read tools.

### Local Streamable HTTP (authenticated)

Set `MCP_AUTH_TOKEN` in `.env.local` and run `npm run dev` (or `npm start`).

Connector URL: `http://127.0.0.1:4317/mcp`  
Auth header: `Authorization: Bearer <MCP_AUTH_TOKEN>`

Unauthenticated or wrong-token requests receive `401`; with no `MCP_AUTH_TOKEN`
configured the route refuses everything.

### Local stdio

```bash
npm run mcp:stdio
```

stdio starts a **separate process** with its own in-memory copy of the seed, so
its edits are not visible in `/backoffice`. Use it for read-only inspection; use
the HTTP connector above to change what the UI and the voice agent see.

### Grok Bot (public HTTPS)

Use the Fly (or equivalent) HTTPS origin — not loopback:

| | |
| --- | --- |
| Connector URL | `https://<app>.fly.dev/mcp` |
| Transport | Streamable HTTP |
| Auth header | `Authorization: Bearer <MCP_AUTH_TOKEN>` |

Walkthrough once the connector is attached:

1. Ask Grok Bot to `list_demo_products` or describe Auto Core coverage.
2. Search a synthetic customer (`search_demo_customers` with name `Ada`).
3. Look up a claim card (`search_demo_claims` with a partial claim number such as `26002`), then `get_demo_claim_status` with that claim ID **and** its customer ID.
4. Change something: `update_demo_product` with `productId: prd_auto` and a new `description`, then open `/backoffice/products` — the card shows the new text. `reseed_demo_data` with `confirmation: RESEED_DEMO_DATA` puts the seed back.
5. Confirm there is no create-claim tool on MCP. To file a demo claim, use the desk-phone Eve flow (verified policy + single-use confirmation on the Next app).

Do not paste `MCP_AUTH_TOKEN` into client-side app code, README screenshots, or git.

## Public single-instance deploy (Fly.io)

The in-memory backoffice store needs exactly one long-lived process, and transcripts need a disk. This repo is **not** for Vercel serverless. Every deploy or machine restart reloads `data/backoffice/seed.json` and discards backoffice edits.

`Dockerfile` + `fly.toml` run one Next process (desk phone + backoffice + MCP at `/mcp`) behind one public port:

- `https://<app>.fly.dev/` — Next app (synthetic data, public-ok; desk-phone calls require demo-password login)
- `https://<app>.fly.dev/mcp` — Streamable HTTP MCP (`MCP_AUTH_TOKEN` bearer required)
- `https://<app>.fly.dev/api/session` — Realtime token mint (`SESSION_ACCESS_TOKEN` or a valid demo-login cookie required)
- `https://<app>.fly.dev/healthz` — **liveness only**: returns `ok` when the public proxy is up. It does not check upstream readiness and returns no secrets. Use it only as a Fly health check, not as a data or auth signal.

### Required Fly secrets

Set these with `fly secrets set` (never in `fly.toml [env]`, never in git):

| Secret | Purpose |
| --- | --- |
| `XAI_API_KEY` | Realtime token mint. Stays server-side only. |
| `MCP_AUTH_TOKEN` | Bearer for `/mcp` (min 24 chars). |
| `SESSION_ACCESS_TOKEN` | Required gate for `POST /api/session` (min 16 chars). Without it the public process refuses to boot. |
| `DEMO_PASSWORD` | Password for the public desk-phone login (min 8 chars). Without it the public process refuses to boot. |

```bash
fly launch --copy-config --no-deploy
fly volumes create acme_intake_data --region sjc --size 1 --yes
fly secrets set \
  XAI_API_KEY="..." \
  MCP_AUTH_TOKEN="$(openssl rand -hex 24)" \
  SESSION_ACCESS_TOKEN="$(openssl rand -hex 16)" \
  DEMO_PASSWORD="$(openssl rand -base64 18)"
fly deploy --ha=false
fly scale count 1
```

Keep **exactly one** machine. `fly.toml` already sets `min_machines_running = 1` and `auto_stop_machines = "off"`. The volume is mounted at `/data` for transcripts; `DATA_DIR=/data` is set in the container **before** the build and read lazily at runtime. Seed JSON stays in the image and is loaded into memory on boot.

### Starting a call on the public host

Open `https://<app>.fly.dev/`, enter `DEMO_PASSWORD`, then tap **Call**. The login route exchanges the password for a signed, HTTP-only cookie (`Path=/`, 8-hour TTL) that keeps you signed in across page navigations for the session; the browser never sees `SESSION_ACCESS_TOKEN`, `XAI_API_KEY`, or `MCP_AUTH_TOKEN`.

For an operator/API request, `POST /api/session` still accepts the session token:

```bash
curl -X POST https://<app>.fly.dev/api/session \
  -H "Authorization: Bearer $SESSION_ACCESS_TOKEN"
```

Missing or wrong bearer and no valid demo-login cookie → `401`. Local `npm run dev` remains ungated when `SESSION_ACCESS_TOKEN` is unset. MCP bearer authentication is unchanged.

Local equivalent of the public process (requires `MCP_AUTH_TOKEN`, `SESSION_ACCESS_TOKEN`, and `DEMO_PASSWORD`):

```bash
npm run build
MCP_AUTH_TOKEN="$(openssl rand -hex 24)" \
SESSION_ACCESS_TOKEN="$(openssl rand -hex 16)" \
DEMO_PASSWORD="demo-password" \
PORT=8080 DATA_DIR=./data npm run start:public
```

Then MCP is `http://127.0.0.1:8080/mcp` with the bearer header. Open `http://127.0.0.1:8080/` and sign in with `DEMO_PASSWORD` to call.

## Stack

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui primitives. Voice auth follows [xAI ephemeral tokens](https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens). Session events follow the [Speech to Speech](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech) WebSocket.
