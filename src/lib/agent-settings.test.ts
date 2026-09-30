import { describe, expect, it } from "vitest";
import { loadVoice, saveVoice, VOICE_STORAGE_KEY } from "@/lib/agent-settings";
import { buildSessionUpdate } from "@/lib/session";

describe("voice settings persistence", () => {
  it("stores the selection and sends it on the next session.update", () => {
    window.localStorage.clear();
    expect(loadVoice()).toBe("eve");
    expect(buildSessionUpdate("Hello", { voice: loadVoice() }).session.voice).toBe("eve");

    expect(saveVoice("REX")).toBe("rex");
    expect(window.localStorage.getItem(VOICE_STORAGE_KEY)).toBe("rex");
    expect(loadVoice()).toBe("rex");

    const update = buildSessionUpdate("Hello", { voice: loadVoice(), pushToTalk: true });
    expect(update.session.voice).toBe("rex");
    expect(update.session.turn_detection).toBeNull();

    saveVoice("eve");
    expect(window.localStorage.getItem(VOICE_STORAGE_KEY)).toBeNull();
    expect(loadVoice()).toBe("eve");
  });

  it("ignores a stored id that is not a voice id", () => {
    window.localStorage.setItem(VOICE_STORAGE_KEY, "not a voice");
    expect(loadVoice()).toBe("eve");
    expect(() => saveVoice("not a voice")).toThrow(/Unknown voice/);
    expect(window.localStorage.getItem(VOICE_STORAGE_KEY)).toBe("not a voice");
  });
});
