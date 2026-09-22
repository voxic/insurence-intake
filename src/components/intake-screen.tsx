"use client";

import Link from "next/link";
import { Mic, MicOff, Phone, PhoneOff, Settings, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { VoiceCallSnapshot } from "@/lib/realtime-client";
import { formatCallClock } from "@/lib/utils";

const STATUS_COPY: Record<VoiceCallSnapshot["status"], string> = {
  idle: "Ready to call",
  "requesting-mic": "Waiting for microphone",
  connecting: "Connecting to intake",
  live: "Live with Eve",
  ended: "Call ended",
  error: "Call interrupted",
};

export function IntakeScreen({
  snapshot,
  onCall,
  onHangup,
  onMute,
}: {
  snapshot: VoiceCallSnapshot;
  onCall: () => void;
  onHangup: () => void;
  onMute: (muted: boolean) => void;
}) {
  const live = snapshot.status === "live";
  const busy =
    snapshot.status === "connecting" || snapshot.status === "requesting-mic";
  const canCall = snapshot.status === "idle" || snapshot.status === "ended" || snapshot.status === "error";

  return (
    <div className="intake-app">
      <header className="intake-header">
        <div className="intake-mark">
          <ShieldCheck className="size-5" />
        </div>
        <div>
          <p className="intake-brand">Acme Insurance</p>
          <p className="intake-sub">Call-center intake</p>
        </div>
        <div className="intake-tools">
          <Badge
            variant={live ? "default" : "secondary"}
            className={live ? "bg-emerald-500 text-white" : "bg-white/10 text-white/80"}
          >
            {STATUS_COPY[snapshot.status]}
          </Badge>
          <Button
            asChild
            variant="secondary"
            size="icon"
            className="intake-settings"
          >
            <Link href="/settings" aria-label="Open agent settings">
              <Settings />
            </Link>
          </Button>
        </div>
      </header>

      <section className="intake-hero">
        <div className={`intake-avatar ${live ? "is-live" : ""}`}>
          <span>Eve</span>
        </div>
        <p className="intake-agent">Intake specialist</p>
        <p className="intake-timer">
          {live || snapshot.status === "ended"
            ? formatCallClock(snapshot.elapsedSeconds)
            : "Tap Call to start a live conversation"}
        </p>
        <div className="intake-wave" aria-hidden="true">
          {Array.from({ length: 9 }).map((_, index) => (
            <span
              key={index}
              style={{
                height: live
                  ? `${8 + snapshot.level * 28 + ((index % 3) + 1) * 4}px`
                  : "8px",
              }}
            />
          ))}
        </div>
      </section>

      <ScrollArea className="intake-transcript">
        {snapshot.call?.turns.length ? (
          <ol className="intake-turns">
            {snapshot.call.turns.map((turn) => (
              <li key={turn.id} className={`bubble bubble-${turn.speaker}`}>
                <span className="bubble-who">
                  {turn.speaker === "agent" ? "Eve" : "You"}
                  {turn.status === "partial" ? " · listening" : ""}
                </span>
                <p>{turn.text}</p>
              </li>
            ))}
          </ol>
        ) : (
          <div className="intake-empty">
            {snapshot.status === "error" ? (
              <p>{snapshot.error}</p>
            ) : snapshot.configured === false ? (
              <p>
                Add <code>XAI_API_KEY</code> to <code>.env.local</code> on the
                server, then restart. The key never leaves the backend.
              </p>
            ) : (
              <p>
                Eve will greet you, ask why you called, and keep a transcript
                for handoff. No claims are filed from this demo.
              </p>
            )}
          </div>
        )}
      </ScrollArea>

      <footer className="intake-controls">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="control-side"
          disabled={!live}
          onClick={() => onMute(!snapshot.muted)}
          aria-label={snapshot.muted ? "Unmute microphone" : "Mute microphone"}
        >
          {snapshot.muted ? <MicOff /> : <Mic />}
        </Button>
        {canCall ? (
          <Button
            type="button"
            size="lg"
            className="control-call"
            onClick={onCall}
          >
            <Phone />
            Call
          </Button>
        ) : (
          <Button
            type="button"
            size="lg"
            className="control-hangup"
            onClick={onHangup}
            disabled={busy && snapshot.status === "requesting-mic"}
          >
            <PhoneOff />
            {busy ? "Connecting" : "Hang up"}
          </Button>
        )}
        <div className="control-side mute-label">
          {snapshot.muted ? "Muted" : live ? "Open" : "Mic"}
        </div>
      </footer>
    </div>
  );
}
