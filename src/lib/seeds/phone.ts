import { ACCENTS, type AccentId } from "./types";

export const ACCENT_SWATCH: Record<AccentId, string> = {
  teal: "#7de0d0",
  amber: "#f0c36a",
  coral: "#ff8f7a",
  indigo: "#a8b4ff",
};

export function isAccentId(value: string): value is AccentId {
  return (ACCENTS as readonly string[]).includes(value);
}
