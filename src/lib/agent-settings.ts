import { INTAKE_INSTRUCTIONS } from "@/lib/session";

export const INSTRUCTIONS_STORAGE_KEY = "acme-intake-instructions";
export const INSTRUCTIONS_CHANGED_EVENT = "acme-intake-instructions";
export const PTT_STORAGE_KEY = "acme-intake-ptt";
export const PTT_CHANGED_EVENT = "acme-intake-ptt";

export function loadInstructions(): string {
  if (typeof window === "undefined") {
    return INTAKE_INSTRUCTIONS;
  }
  try {
    const stored = window.localStorage.getItem(INSTRUCTIONS_STORAGE_KEY);
    if (typeof stored === "string" && stored.trim()) {
      return stored;
    }
  } catch {
    // private mode or blocked storage
  }
  return INTAKE_INSTRUCTIONS;
}

export function saveInstructions(value: string) {
  const next = value.replace(/\s+$/u, "");
  if (!next.trim()) {
    throw new Error("Instructions cannot be empty.");
  }
  if (next === INTAKE_INSTRUCTIONS) {
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
  return INTAKE_INSTRUCTIONS;
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
