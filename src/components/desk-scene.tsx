"use client";

import { useEffect, useState } from "react";
import { DemoLoginGate } from "@/components/demo-login-gate";
import { DeskNotepad } from "@/components/desk-notepad";
import { IntakeScreen } from "@/components/intake-screen";
import { PhoneFrame } from "@/components/phone-frame";
import { usePushToTalk } from "@/hooks/use-push-to-talk";
import { useVoiceCall } from "@/hooks/use-voice-call";

export function DeskScene() {
  const call = useVoiceCall();
  const [now, setNow] = useState(() => new Date());
  const [demoPasswordRequired, setDemoPasswordRequired] = useState(false);
  const pushToTalk = usePushToTalk({
    live: call.status === "live",
    pushToTalk: call.pushToTalk,
    setTalking: call.setTalking,
  });

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    void fetch("/api/session")
      .then((response) => response.json())
      .then((config: { accessTokenRequired?: boolean; demoPasswordRequired?: boolean }) => {
        setDemoPasswordRequired(
          Boolean(config.accessTokenRequired && config.demoPasswordRequired),
        );
      })
      .catch(() => setDemoPasswordRequired(false));
  }, []);

  return (
    <div className="desk">
      <div className="desk-glow" aria-hidden="true" />
      <div className="desk-stage">
        <PhoneFrame time={now}>
          <IntakeScreen
            snapshot={call}
            onCall={() => void call.start()}
            onHangup={() => void call.hangup()}
            onMute={call.setMuted}
            pushToTalkPointerHandlers={pushToTalk}
          />
        </PhoneFrame>
        <DeskNotepad call={call.call} />
      </div>
      <p className="desk-caption">
        Speech-to-speech intake on a desk phone. Mic audio stays in the browser
        until it reaches xAI over an ephemeral token.
      </p>
      {demoPasswordRequired ? (
        <DemoLoginGate onAuthenticated={() => setDemoPasswordRequired(false)} />
      ) : null}
    </div>
  );
}
