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
  const last = turns[turns.length - 1];
  const canReuse =
    existingId
      ? last?.id === existingId
      : last && last.speaker === speaker && last.status === "partial";

  if (last && canReuse) {
    return [
      ...turns.slice(0, -1),
      {
        ...last,
        text: trimmed || last.text,
        status,
        updatedAt: now,
      },
    ];
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
