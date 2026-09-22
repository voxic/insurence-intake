export type CallStatus =
  | "idle"
  | "requesting-mic"
  | "connecting"
  | "live"
  | "ended"
  | "error";

export type Speaker = "user" | "agent";

export type TurnStatus = "partial" | "final";

export type TranscriptTurn = {
  id: string;
  speaker: Speaker;
  text: string;
  status: TurnStatus;
  startedAt: string;
  updatedAt: string;
};

export type IntakeCall = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  status: CallStatus;
  turns: TranscriptTurn[];
};

export type SessionTokenResponse = {
  value: string;
  expiresAt?: number;
};

export type RealtimeEvent = {
  type: string;
  [key: string]: unknown;
};
