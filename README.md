# Acme Insurance intake

Desktop demo of a **physical phone on a desk**. The intake app lives inside the phone screen. Tap **Call** to start a speech-to-speech session with Grok Voice (xAI Realtime). Eve greets the caller, gathers intent, and the transcript stays after hangup.

This is an MVP: mock phone chrome, no PSTN, no CRM, no claim backend.

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
| `XAI_API_KEY` | `.env.local` only | Used by `POST /api/session` to mint an ephemeral client secret from `https://api.x.ai/v1/realtime/client_secrets`. |

Do **not** prefix this with `NEXT_PUBLIC_`. The browser never receives the long-lived key.

## How a call starts

1. Tap **Call** on the phone. The browser asks for the microphone.
2. The app `POST`s `/api/session`. That route calls xAI with `XAI_API_KEY` and returns a short-lived token (`value`, ~300 seconds).
3. The browser opens `wss://api.x.ai/v1/realtime?model=grok-voice-latest` using the documented client protocol: `xai-client-secret.<token>`.
4. The client sends `session.update` with voice `eve`, intake instructions, `turn_detection: { type: "server_vad" }`, 24 kHz PCM, and `audio.input.transcription.model: "grok-transcribe"`.
5. Mic PCM is streamed as `input_audio_buffer.append`. Agent audio arrives as `response.output_audio.delta` and is played immediately.
6. After `session.updated`, the client sends `response.create` so Eve greets first.

Mute stops sending mic audio. **Hang up** closes the socket and keeps the transcript.

Without `XAI_API_KEY`, the phone still renders. The empty state explains that the server key is missing.

## Settings

Open **Settings** from the gear on the phone or the notepad chip, or go to `/settings`. Edit Eve’s system prompt, **Save**, or **Reset to default**. The text is stored in `localStorage` (`acme-intake-instructions`) and sent on the next Call as `session.update.session.instructions`. A live call is not rewritten mid-session.

## Transcript storage

Each turn is a structured `{ speaker, text, status, timestamps }` item.

- **On the phone** during the call, and still visible after hangup.
- **Beside the phone** on large screens (desk notepad), with copy and JSON export.
- **Browser `localStorage`** key `acme-intake-calls` (last 20 calls).
- **Server handoff:** `POST /api/transcripts` writes `data/transcripts/<id>.json`. `GET /api/transcripts` lists them; `GET /api/transcripts/<id>` returns one.

User text comes from `conversation.item.input_audio_transcription.updated` / `.completed`. Agent text comes from `response.output_audio_transcript.*` (and text-delta aliases).

## Backoffice (demo)

`/backoffice` is a local operations demo (dashboard, customers, products, pricing, claims) backed by a JSON repository, not a real CRM or claims system.

**Synthetic data only.** Every record is obviously fictional: `example.com` emails, `555-01xx` phone numbers, and made-up street names. This environment stores **no sensitive data** — no government IDs, no dates of birth used as identity, no payment cards, no medical details, no passwords, and no API keys. The `/api/backoffice/*` endpoints schema-reject any create/update payload carrying such fields, and voice transcripts are never filed into the backoffice store. Use **Reset demo data** to restore the committed seed.

Storage lives in `data/backoffice/seed.json` (committed) and a gitignored `state.json` (runtime), accessed only through `src/lib/backoffice/repository.ts`.

## Stack

Next.js (App Router) + TypeScript + Tailwind + shadcn/ui primitives. Voice auth follows [xAI ephemeral tokens](https://docs.x.ai/developers/model-capabilities/audio/ephemeral-tokens). Session events follow the [Speech to Speech](https://docs.x.ai/developers/model-capabilities/audio/speech-to-speech) WebSocket.
