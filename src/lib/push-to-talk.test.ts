import { describe, expect, it } from "vitest";
import { loadPushToTalk, savePushToTalk } from "@/lib/agent-settings";
import { shouldClaimSpace } from "@/lib/push-to-talk";
import { buildSessionUpdate } from "@/lib/session";

describe("push-to-talk helpers", () => {
  const activeGate = { live: true, pushToTalk: true };

  function keyboardEvent(target: EventTarget, overrides: Partial<KeyboardEvent> = {}) {
    return {
      code: "Space",
      repeat: false,
      target,
      ...overrides,
    } as Pick<KeyboardEvent, "code" | "repeat" | "target">;
  }

  it("claims Space only for an active PTT phone", () => {
    expect(shouldClaimSpace(keyboardEvent(document.body), activeGate)).toBe(true);
    expect(
      shouldClaimSpace(keyboardEvent(document.body), { live: true, pushToTalk: false }),
    ).toBe(false);
    expect(
      shouldClaimSpace(keyboardEvent(document.body, { code: "Enter" }), activeGate),
    ).toBe(false);
    expect(
      shouldClaimSpace(keyboardEvent(document.body, { repeat: true }), activeGate),
    ).toBe(false);
  });

  it("leaves editable controls and native button activation alone", () => {
    const textarea = document.createElement("textarea");
    const button = document.createElement("button");

    expect(shouldClaimSpace(keyboardEvent(textarea), activeGate)).toBe(false);
    expect(shouldClaimSpace(keyboardEvent(button), activeGate)).toBe(false);
  });

  it("uses explicit null turn detection for PTT", () => {
    const pttUpdate = buildSessionUpdate("Test", { pushToTalk: true });
    const vadUpdate = buildSessionUpdate("Test");

    expect(pttUpdate.session.turn_detection).toBeNull();
    expect(vadUpdate.session.turn_detection).toMatchObject({ type: "server_vad" });
  });

  it("stores opt-in state under the PTT key", () => {
    window.localStorage.clear();
    expect(loadPushToTalk()).toBe(false);

    savePushToTalk(true);
    expect(window.localStorage.getItem("acme-intake-ptt")).toBe("1");
    expect(loadPushToTalk()).toBe(true);

    savePushToTalk(false);
    expect(window.localStorage.getItem("acme-intake-ptt")).toBeNull();
  });
});
