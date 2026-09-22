"use client";

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
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
  pushToTalk: false,
  talking: false,
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

  const start = useCallback(() => voice.start(), [voice]);
  const hangup = useCallback(() => voice.hangup(), [voice]);
  const setMuted = useCallback((muted: boolean) => voice.setMuted(muted), [voice]);
  const setTalking = useCallback((talking: boolean) => voice.setTalking(talking), [voice]);

  return {
    ...snapshot,
    start,
    hangup,
    setMuted,
    setTalking,
  };
}
