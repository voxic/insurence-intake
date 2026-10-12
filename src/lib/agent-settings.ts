import { INTAKE_INSTRUCTIONS } from "@/lib/session";
import { DEFAULT_VOICE_ID, isVoiceId, normalizeVoiceId } from "@/lib/voices";

export const INSTRUCTIONS_STORAGE_KEY = "acme-intake-instructions";
export const INSTRUCTIONS_CHANGED_EVENT = "acme-intake-instructions";
export const PTT_STORAGE_KEY = "acme-intake-ptt";
export const PTT_CHANGED_EVENT = "acme-intake-ptt";
export const VOICE_STORAGE_KEY = "acme-intake-voice";
export const VOICE_CHANGED_EVENT = "acme-intake-voice";
export const SEED_STORAGE_KEY = "acme-intake-seed";

let seedPrompt = INTAKE_INSTRUCTIONS;
let claimProtocol = true;

export function loadSeedPrompt() {
  return seedPrompt;
}

export function loadClaimProtocol() {
  return claimProtocol;
}

/** Point the next call at the active seed. A seed change drops a saved prompt override. */
export function applyDemoProfile(profile: { seedId: string; agentPrompt: string; claimProtocol: boolean }) {
  seedPrompt = profile.agentPrompt;
  claimProtocol = profile.claimProtocol;
  if (typeof window === "undefined") return;
  const previous = window.localStorage.getItem(SEED_STORAGE_KEY);
  if (previous && previous !== profile.seedId) {
    window.localStorage.removeItem(INSTRUCTIONS_STORAGE_KEY);
  }
  window.localStorage.setItem(SEED_STORAGE_KEY, profile.seedId);
  window.dispatchEvent(new Event(INSTRUCTIONS_CHANGED_EVENT));
}

export function loadInstructions(): string {
  if (typeof window !== "undefined") {
    try {
      const stored = window.localStorage.getItem(INSTRUCTIONS_STORAGE_KEY);
      if (typeof stored === "string" && stored.trim()) {
        return stored;
      }
    } catch {
      // private mode or blocked storage
    }
  }
  return seedPrompt;
}

export function saveInstructions(value: string) {
  const next = value.replace(/\s+$/u, "");
  if (!next.trim()) {
    throw new Error("Instructions cannot be empty.");
  }
  if (next === seedPrompt) {
    window.localStorage.removeItem(INSTRUCTIONS_STORAGE_KEY);
  } else {
    window.localStorage.setItem(INSTRUCTIONS_STORAGE_KEY, next);
  }
  window.dispatchEvent(new Event(INSTRUCTIONS_CHANGED_EVENT));
  return next;
}

export function resetInstructions() {
  window.localStorage.removeItem(INSTRUCTIONS_STORAGE_KEY);
  window.dispatchEvent(new Event(INSTRUCTIONS_CHANGED_EVENT));
  return seedPrompt;
}

export function subscribeInstructions(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(INSTRUCTIONS_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(INSTRUCTIONS_CHANGED_EVENT, listener);
  };
}

export function loadPushToTalk(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem(PTT_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function savePushToTalk(enabled: boolean) {
  if (enabled) {
    window.localStorage.setItem(PTT_STORAGE_KEY, "1");
  } else {
    window.localStorage.removeItem(PTT_STORAGE_KEY);
  }
  window.dispatchEvent(new Event(PTT_CHANGED_EVENT));
}

export function subscribePushToTalk(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(PTT_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(PTT_CHANGED_EVENT, listener);
  };
}

export function loadVoice(): string {
  if (typeof window === "undefined") return DEFAULT_VOICE_ID;
  try {
    const stored = window.localStorage.getItem(VOICE_STORAGE_KEY)?.trim().toLowerCase();
    if (stored && isVoiceId(stored)) return stored;
  } catch {
    // private mode or blocked storage
  }
  return DEFAULT_VOICE_ID;
}

export function saveVoice(value: string) {
  const id = normalizeVoiceId(value);
  if (id === DEFAULT_VOICE_ID && !isVoiceId(value.trim().toLowerCase())) {
    throw new Error("Unknown voice.");
  }
  if (id === DEFAULT_VOICE_ID) {
    window.localStorage.removeItem(VOICE_STORAGE_KEY);
  } else {
    window.localStorage.setItem(VOICE_STORAGE_KEY, id);
  }
  window.dispatchEvent(new Event(VOICE_CHANGED_EVENT));
  return id;
}

export function subscribeVoice(listener: () => void) {
  window.addEventListener("storage", listener);
  window.addEventListener(VOICE_CHANGED_EVENT, listener);
  return () => {
    window.removeEventListener("storage", listener);
    window.removeEventListener(VOICE_CHANGED_EVENT, listener);
  };
}
