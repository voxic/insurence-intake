import { base64ToPcm16, MicCapture, PcmPlayer } from "@/lib/audio";
import { loadInstructions, loadPushToTalk } from "@/lib/agent-settings";
import { buildSessionUpdate, REALTIME_URL } from "@/lib/session";
import { createCall, persistCallToServer, saveCall, upsertTurn } from "@/lib/transcript";
import type {
  CallStatus,
  IntakeCall,
  RealtimeEvent,
  Speaker,
  TranscriptTurn,
} from "@/lib/types";

export type VoiceCallSnapshot = {
  status: CallStatus;
  error: string | null;
  muted: boolean;
  pushToTalk: boolean;
  talking: boolean;
  level: number;
  elapsedSeconds: number;
  call: IntakeCall | null;
  configured: boolean | null;
};

type Listener = (snapshot: VoiceCallSnapshot) => void;

function readTranscript(event: RealtimeEvent): string {
  const direct = event.transcript;
  if (typeof direct === "string") return direct;
  const delta = event.delta;
  if (typeof delta === "string") return delta;
  const text = event.text;
  if (typeof text === "string") return text;
  const item = event.item as Record<string, unknown> | undefined;
  if (item && typeof item.formatted === "object" && item.formatted) {
    const formatted = item.formatted as Record<string, unknown>;
    if (typeof formatted.transcript === "string") return formatted.transcript;
  }
  if (item && Array.isArray(item.content)) {
    return item.content
      .map((part) => {
        if (!part || typeof part !== "object") return "";
        const record = part as Record<string, unknown>;
        return (
          (typeof record.transcript === "string" && record.transcript) ||
          (typeof record.text === "string" && record.text) ||
          ""
        );
      })
      .join(" ")
      .trim();
  }
  return "";
}

export class VoiceSession {
  private listeners = new Set<Listener>();
  private socket: WebSocket | null = null;
  private mic: MicCapture | null = null;
  private player: PcmPlayer | null = null;
  private timer: number | null = null;
  private startedAt = 0;
  private userPartialId: string | null = null;
  private agentPartialId: string | null = null;
  private persistTimer: number | null = null;
  private greeted = false;
  private agentStream: "audio" | "text" | null = null;
  private appendedChunks = 0;
  private snapshot: VoiceCallSnapshot = {
    status: "idle",
    error: null,
    muted: false,
    pushToTalk: false,
    talking: false,
    level: 0,
    elapsedSeconds: 0,
    call: null,
    configured: null,
  };

  subscribe(listener: Listener) {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getState() {
    return this.snapshot;
  }

  async checkConfigured() {
    try {
      const response = await fetch("/api/session", { method: "GET" });
      const data = (await response.json()) as { configured?: boolean };
      this.patch({ configured: Boolean(data.configured) });
    } catch {
      this.patch({ configured: false });
    }
  }

  async start() {
    if (this.snapshot.status === "live" || this.snapshot.status === "connecting") {
      return;
    }

    const call = createCall();
    this.userPartialId = null;
    this.agentPartialId = null;
    this.greeted = false;
    this.agentStream = null;
    this.appendedChunks = 0;
    const pushToTalk = loadPushToTalk();
    this.patch({
      status: "requesting-mic",
      error: null,
      muted: pushToTalk,
      pushToTalk,
      talking: false,
      level: 0,
      elapsedSeconds: 0,
      call,
    });

    try {
      this.player = new PcmPlayer();
      await this.player.resume();

      this.mic = new MicCapture({
        onChunk: (audio) => {
          if (
            this.socket?.readyState === WebSocket.OPEN &&
            (!this.snapshot.pushToTalk || this.snapshot.talking)
          ) {
            this.socket.send(
              JSON.stringify({
                type: "input_audio_buffer.append",
                audio,
              }),
            );
            if (this.snapshot.pushToTalk) {
              this.appendedChunks += 1;
            }
          }
        },
        onLevel: (level) => this.patch({ level }),
      });
      await this.mic.start();
      this.mic.setMuted(pushToTalk);

      this.patch({ status: "connecting" });

      const tokenResponse = await fetch("/api/session", { method: "POST" });
      const tokenPayload = (await tokenResponse.json()) as {
        value?: string;
        error?: string;
        configured?: boolean;
      };
      if (!tokenResponse.ok || !tokenPayload.value) {
        throw new Error(
          tokenPayload.error ??
            "Could not mint an ephemeral voice token. Add XAI_API_KEY to .env.local.",
        );
      }

      this.patch({ configured: true });

      await new Promise<void>((resolve, reject) => {
        const socket = new WebSocket(REALTIME_URL, [
          `xai-client-secret.${tokenPayload.value}`,
        ]);
        this.socket = socket;
        socket.onopen = () => resolve();
        socket.onerror = () => reject(new Error("Voice connection failed."));
        socket.onmessage = (event) => this.handleMessage(event.data);
        socket.onclose = () => {
          if (this.snapshot.status === "live" || this.snapshot.status === "connecting") {
            void this.end("The voice session disconnected.");
          }
        };
      });

      this.socket?.send(
        JSON.stringify(buildSessionUpdate(loadInstructions(), { pushToTalk })),
      );
      this.startedAt = Date.now();
      this.patch({ status: "live", call: { ...call, status: "live" } });
      this.startTimer();
      this.persist(this.snapshot.call);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not start the call.";
      await this.cleanup();
      this.patch({
        status: "error",
        error: message,
        call: this.snapshot.call
          ? { ...this.snapshot.call, status: "error", endedAt: new Date().toISOString() }
          : this.snapshot.call,
      });
      if (this.snapshot.call) {
        this.persist(this.snapshot.call);
      }
    }
  }

  setMuted(muted: boolean) {
    if (this.snapshot.pushToTalk) {
      return;
    }
    this.mic?.setMuted(muted);
    this.patch({ muted, level: muted ? 0 : this.snapshot.level });
  }

  setTalking(talking: boolean) {
    if (!this.snapshot.pushToTalk || this.snapshot.status !== "live") {
      return;
    }
    if (talking === this.snapshot.talking) {
      return;
    }

    if (talking) {
      this.appendedChunks = 0;
      this.player?.interrupt();
      this.socket?.send(JSON.stringify({ type: "response.cancel" }));
      this.socket?.send(JSON.stringify({ type: "input_audio_buffer.clear" }));
      this.mic?.setMuted(false);
      this.patch({ talking: true, muted: false });
      return;
    }

    this.mic?.setMuted(true);
    this.patch({ talking: false, muted: true, level: 0 });
    if (this.appendedChunks > 0 && this.socket?.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ type: "input_audio_buffer.commit" }));
      this.socket.send(JSON.stringify({ type: "response.create" }));
    }
    this.appendedChunks = 0;
  }

  async hangup() {
    await this.end();
  }

  private async end(error?: string) {
    const call = this.snapshot.call
      ? {
          ...this.snapshot.call,
          status: (error ? "error" : "ended") as CallStatus,
          endedAt: new Date().toISOString(),
          turns: this.snapshot.call.turns.map((turn) =>
            turn.status === "partial" ? { ...turn, status: "final" as const } : turn,
          ),
        }
      : null;
    await this.cleanup();
    this.patch({
      status: error ? "error" : "ended",
      error: error ?? null,
      muted: false,
      talking: false,
      level: 0,
      call,
    });
    this.persist(call);
  }

  private startTimer() {
    this.clearTimer();
    this.timer = window.setInterval(() => {
      this.patch({
        elapsedSeconds: Math.floor((Date.now() - this.startedAt) / 1000),
      });
    }, 250);
  }

  private clearTimer() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async cleanup() {
    this.clearTimer();
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      try {
        this.socket.close();
      } catch {
        // ignore
      }
    }
    this.socket = null;
    this.appendedChunks = 0;
    this.player?.interrupt();
    await this.player?.close();
    this.player = null;
    await this.mic?.stop();
    this.mic = null;
  }

  private handleMessage(raw: unknown) {
    if (typeof raw !== "string") {
      return;
    }
    let event: RealtimeEvent;
    try {
      event = JSON.parse(raw) as RealtimeEvent;
    } catch {
      return;
    }

    switch (event.type) {
      case "session.updated":
        if (!this.greeted) {
          this.greeted = true;
          this.socket?.send(JSON.stringify({ type: "response.create" }));
        }
        break;
      case "input_audio_buffer.speech_started":
        this.player?.interrupt();
        this.socket?.send(JSON.stringify({ type: "response.cancel" }));
        this.userPartialId = crypto.randomUUID();
        break;
      case "conversation.item.input_audio_transcription.updated": {
        const text = readTranscript(event);
        this.applyTurn("user", text, "partial", this.userPartialId ?? undefined);
        break;
      }
      case "conversation.item.input_audio_transcription.completed": {
        const text = readTranscript(event);
        this.applyTurn("user", text, "final", this.userPartialId ?? undefined);
        this.userPartialId = null;
        break;
      }
      case "response.output_audio.delta":
      case "response.audio.delta": {
        const delta = event.delta;
        if (typeof delta === "string") {
          this.player?.enqueue(base64ToPcm16(delta));
        }
        break;
      }
      case "response.output_audio_transcript.delta":
      case "response.audio_transcript.delta":
      case "response.text.delta": {
        const stream =
          event.type === "response.text.delta" ? "text" : "audio";
        if (this.agentStream && this.agentStream !== stream) {
          break;
        }
        this.agentStream = stream;
        if (!this.agentPartialId) {
          this.agentPartialId = crypto.randomUUID();
        }
        const incoming = typeof event.delta === "string" ? event.delta : readTranscript(event);
        const last = this.snapshot.call?.turns.find((turn) => turn.id === this.agentPartialId);
        const nextText = last ? `${last.text}${incoming}` : incoming;
        this.applyTurn("agent", nextText, "partial", this.agentPartialId);
        break;
      }
      case "response.output_audio_transcript.done":
      case "response.audio_transcript.done":
      case "response.text.done": {
        const stream = event.type === "response.text.done" ? "text" : "audio";
        if (this.agentStream && this.agentStream !== stream) {
          break;
        }
        const text = readTranscript(event);
        this.applyTurn("agent", text, "final", this.agentPartialId ?? undefined);
        this.agentPartialId = null;
        this.agentStream = null;
        break;
      }
      case "response.function_call_arguments.done": {
        void this.handleToolCall(event);
        break;
      }
      case "conversation.item.created": {
        const item = event.item as Record<string, unknown> | undefined;
        const role = item?.role === "user" ? "user" : item?.role === "assistant" ? "agent" : null;
        const text = readTranscript(event);
        const already =
          text &&
          this.snapshot.call?.turns.some(
            (turn) => turn.speaker === role && turn.text === text,
          );
        if (role && text && !already) {
          this.applyTurn(role, text, "final");
        }
        break;
      }
      case "error": {
        const error = event.error as Record<string, unknown> | undefined;
        const message =
          (typeof error?.message === "string" && error.message) ||
          (typeof event.message === "string" && event.message) ||
          "The voice agent returned an error.";
        this.patch({ error: message });
        break;
      }
      default:
        break;
    }
  }

  private applyTurn(
    speaker: Speaker,
    text: string,
    status: TranscriptTurn["status"],
    existingId?: string,
  ) {
    const call = this.snapshot.call;
    if (!call || !text.trim()) return;
    const next: IntakeCall = {
      ...call,
      turns: upsertTurn(call.turns, speaker, text, status, existingId),
    };
    this.patch({ call: next });
    this.schedulePersist(next);
  }

  private async handleToolCall(event: RealtimeEvent) {
    const callId = typeof event.call_id === "string" ? event.call_id : null;
    const name = typeof event.name === "string" ? event.name : null;
    if (!callId || !name || this.socket?.readyState !== WebSocket.OPEN) {
      return;
    }

    let output: unknown = { error: "The live intake tool could not be completed." };
    try {
      const response = await fetch("/api/realtime/tools", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, arguments: event.arguments }),
      });
      const payload = (await response.json()) as { output?: unknown; error?: string };
      output = payload.output ?? { error: payload.error ?? "The live intake tool could not be completed." };
    } catch {
      // Keep the tool failure in the model context instead of exposing server details to callers.
    }

    if (this.socket?.readyState !== WebSocket.OPEN) return;
    this.socket.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "function_call_output",
          call_id: callId,
          output: JSON.stringify(output),
        },
      }),
    );
    this.socket.send(JSON.stringify({ type: "response.create" }));
  }

  private schedulePersist(call: IntakeCall) {
    saveCall(call);
    if (this.persistTimer) {
      window.clearTimeout(this.persistTimer);
    }
    this.persistTimer = window.setTimeout(() => {
      void persistCallToServer(call).catch(() => undefined);
    }, 400);
  }

  private persist(call: IntakeCall | null) {
    if (!call) return;
    saveCall(call);
    void persistCallToServer(call).catch(() => undefined);
  }

  private patch(partial: Partial<VoiceCallSnapshot>) {
    this.snapshot = { ...this.snapshot, ...partial };
    for (const listener of this.listeners) {
      listener(this.snapshot);
    }
  }
}
