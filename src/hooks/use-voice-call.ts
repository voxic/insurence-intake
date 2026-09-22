"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { VoiceSession, type VoiceCallSnapshot } from "@/lib/realtime-client";

let session: VoiceSession | null = null;

function getSession() {
  if (!session) {
    session = new VoiceSession();
  }
  return session;
}

const idleSnapshot: VoiceCallSnapshot = {
  status: "idle",
  error: null,
  muted: false,
  level: 0,
  elapsedSeconds: 0,
  call: null,
  configured: null,
};

export function useVoiceCall() {
  const voice = useMemo(() => getSession(), []);
  const snapshot = useSyncExternalStore(
    (listener) => voice.subscribe(listener),
    () => voice.getState(),
    () => idleSnapshot,
  );

  useEffect(() => {
    void voice.checkConfigured();
  }, [voice]);

  return {
    ...snapshot,
    start: () => voice.start(),
    hangup: () => voice.hangup(),
    setMuted: (muted: boolean) => voice.setMuted(muted),
  };
}
