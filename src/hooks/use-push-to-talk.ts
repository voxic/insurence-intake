"use client";

import type { PointerEvent } from "react";
import { useEffect, useMemo } from "react";
import { shouldClaimSpace } from "@/lib/push-to-talk";

type PushToTalkOptions = {
  live: boolean;
  pushToTalk: boolean;
  setTalking: (talking: boolean) => void;
};

export function usePushToTalk({ live, pushToTalk, setTalking }: PushToTalkOptions) {
  useEffect(() => {
    if (!live || !pushToTalk) return;

    const release = () => setTalking(false);
    const onKeyDown = (event: KeyboardEvent) => {
      if (!shouldClaimSpace(event, { live, pushToTalk })) return;
      event.preventDefault();
      setTalking(true);
    };
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      release();
      if (shouldClaimSpace(event, { live, pushToTalk })) {
        event.preventDefault();
      }
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") release();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", release);
    window.addEventListener("pagehide", release);
    window.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      release();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", release);
      window.removeEventListener("pagehide", release);
      window.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [live, pushToTalk, setTalking]);

  return useMemo(
    () => ({
      onPointerDown: (event: PointerEvent<HTMLButtonElement>) => {
        if (!live || !pushToTalk) return;
        event.currentTarget.setPointerCapture(event.pointerId);
        setTalking(true);
      },
      onPointerUp: () => setTalking(false),
      onPointerCancel: () => setTalking(false),
      onLostPointerCapture: () => setTalking(false),
    }),
    [live, pushToTalk, setTalking],
  );
}
