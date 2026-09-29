import type { IntakeCall, Speaker, TranscriptTurn } from "@/lib/types";

const STORAGE_KEY = "acme-intake-calls";

export function createCall(): IntakeCall {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    startedAt: now,
    endedAt: null,
    status: "connecting",
    turns: [],
  };
}

function normalizeText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

function lastIndexBy(turns: TranscriptTurn[], predicate: (turn: TranscriptTurn) => boolean) {
  for (let index = turns.length - 1; index >= 0; index -= 1) {
    if (predicate(turns[index])) return index;
  }
  return -1;
}

/**
 * Picks the turn an incoming transcript event belongs to. Streams from both
 * speakers interleave (a cancelled agent line can still trail in while the
 * caller talks), so the match is by id anywhere in the list, then by the
 * speaker's most recent still-open line — never "whatever line is last".
 */
function findTurnIndex(turns: TranscriptTurn[], speaker: Speaker, existingId?: string) {
  if (existingId) {
    const byId = lastIndexBy(turns, (turn) => turn.id === existingId);
    if (byId >= 0) return byId;
  }
  const latest = lastIndexBy(turns, (turn) => turn.speaker === speaker);
  return latest >= 0 && turns[latest].status === "partial" ? latest : -1;
}

/**
 * A final that repeats the speaker's previous line word-for-word, with nothing
 * finalized in between, is the same utterance arriving twice (e.g. the
 * transcription `completed` event plus the `conversation.item.created` echo).
 * A genuine repeat ("Yes." … agent question … "Yes.") has a final agent line
 * between the two and is kept.
 */
function isRepeatedFinal(turns: TranscriptTurn[], speaker: Speaker, text: string) {
  const latest = lastIndexBy(turns, (turn) => turn.speaker === speaker);
  if (latest < 0 || normalizeText(turns[latest].text) !== normalizeText(text)) return false;
  return turns.slice(latest + 1).every((turn) => turn.status === "partial");
}

export function upsertTurn(
  turns: TranscriptTurn[],
  speaker: Speaker,
  text: string,
  status: TranscriptTurn["status"],
  existingId?: string,
): TranscriptTurn[] {
  const trimmed = text.trim();
  if (!trimmed && status === "partial") {
    return turns;
  }

  const now = new Date().toISOString();
  const index = findTurnIndex(turns, speaker, existingId);
  if (index >= 0) {
    const current = turns[index];
    return turns.map((turn, position) =>
      position === index
        ? { ...current, text: trimmed || current.text, status, updatedAt: now }
        : turn,
    );
  }

  if (status === "final" && isRepeatedFinal(turns, speaker, trimmed)) {
    return turns;
  }

  return [
    ...turns,
    {
      id: existingId ?? crypto.randomUUID(),
      speaker,
      text: trimmed,
      status,
      startedAt: now,
      updatedAt: now,
    },
  ];
}

export function loadCalls(): IntakeCall[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as IntakeCall[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveCall(call: IntakeCall) {
  if (typeof window === "undefined") return;
  const existing = loadCalls().filter((item) => item.id !== call.id);
  const next = [call, ...existing].slice(0, 20);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function transcriptAsText(call: IntakeCall) {
  const header = `Acme Insurance intake\nCall ${call.id}\nStarted ${call.startedAt}\n`;
  const body = call.turns
    .filter((turn) => turn.text)
    .map((turn) => {
      const who = turn.speaker === "agent" ? "Agent" : "Caller";
      return `${who}: ${turn.text}`;
    })
    .join("\n\n");
  return `${header}\n${body}`.trim();
}

export async function persistCallToServer(call: IntakeCall) {
  const response = await fetch("/api/transcripts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(call),
  });
  if (!response.ok) {
    throw new Error("Could not store transcript on the server.");
  }
  return response.json() as Promise<{ id: string }>;
}
