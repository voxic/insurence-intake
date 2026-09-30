export const DEFAULT_VOICE_ID = "eve";
export const VOICE_ID_PATTERN = /^[a-z0-9_-]{1,64}$/;

export const PREVIEW_LINES = {
  en: {
    language: "en",
    text: "Thanks for calling Acme Insurance. How can I help you today?",
  },
  sv: {
    language: "sv",
    text: "Tack för att du ringer Acme Försäkring. Hur kan jag hjälpa dig idag?",
  },
} as const;

export type PreviewLanguage = keyof typeof PREVIEW_LINES;

/**
 * xAI's voice product says every built-in Grok voice is multilingual, and
 * Swedish is one of those languages, but it does not rank them. "listed" is
 * reserved for a list payload that actually names sv.
 */
export type SwedishSupport = "listed" | "multilingual" | "unspecified";

export type VoiceChoice = {
  id: string;
  name: string;
  gender?: string;
  tone?: string;
  description?: string;
  accent?: string;
  languages: string[];
  swedish: SwedishSupport;
  previewUrl?: string;
};

type DocumentedVoice = {
  name: string;
  gender: string;
  tone: string;
  description: string;
  previewUrl: string;
};

const DOCUMENTED_VOICES: Record<string, DocumentedVoice> = {
  eve: {
    name: "Eve",
    gender: "Female",
    tone: "Energetic, upbeat",
    description: "Default voice, engaging and enthusiastic",
    previewUrl: "https://data.x.ai/audio-samples/voice_eve.mp3",
  },
  ara: {
    name: "Ara",
    gender: "Female",
    tone: "Warm, friendly",
    description: "Balanced and conversational",
    previewUrl: "https://data.x.ai/audio-samples/voice_ara.mp3",
  },
  rex: {
    name: "Rex",
    gender: "Male",
    tone: "Confident, clear",
    description: "Professional and articulate, ideal for business",
    previewUrl: "https://data.x.ai/audio-samples/voice_rex.mp3",
  },
  sal: {
    name: "Sal",
    gender: "Neutral",
    tone: "Smooth, balanced",
    description: "Versatile voice suitable for various contexts",
    previewUrl: "https://data.x.ai/audio-samples/voice_sal.mp3",
  },
  leo: {
    name: "Leo",
    gender: "Male",
    tone: "Authoritative, strong",
    description: "Decisive and commanding, suitable for instructional content",
    previewUrl: "https://data.x.ai/audio-samples/voice_leo.mp3",
  },
};

/** Flagship ids from the Grok voice roster. xAI does not publish gender for these. */
const FLAGSHIP_VOICE_IDS = [
  "altair",
  "atlas",
  "carina",
  "castor",
  "celeste",
  "cosmo",
  "helios",
  "helix",
  "iris",
  "kepler",
  "lumen",
  "luna",
  "lux",
  "naksh",
  "orion",
  "perseus",
  "rigel",
  "sirius",
  "ursa",
  "zagan",
  "zenith",
] as const;

export const SWEDISH_VOICE_NOTE =
  "xAI describes every built-in Grok voice as multilingual and lists Swedish among Grok Voice languages. It does not say which voices handle Swedish better. Swedish is not in the official TTS language-code table, so a Swedish sample requests sv and retries with auto if xAI rejects that code.";

export function isVoiceId(value: string) {
  return VOICE_ID_PATTERN.test(value);
}

export function publicPreviewUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function voiceName(id: string) {
  const documented = DOCUMENTED_VOICES[id];
  if (documented) return documented.name;
  if (!id) return "Eve";
  return id.charAt(0).toUpperCase() + id.slice(1);
}

function builtInVoice(id: string): VoiceChoice {
  const documented = DOCUMENTED_VOICES[id];
  return {
    id,
    name: documented?.name ?? voiceName(id),
    gender: documented?.gender,
    tone: documented?.tone,
    description: documented?.description,
    languages: [],
    swedish: "multilingual",
    previewUrl: documented?.previewUrl,
  };
}

const BUILT_IN_IDS = new Set<string>([
  ...Object.keys(DOCUMENTED_VOICES),
  ...FLAGSHIP_VOICE_IDS,
]);

export const BUILT_IN_VOICES: VoiceChoice[] = [
  ...Object.keys(DOCUMENTED_VOICES).map((id) => builtInVoice(id)),
  ...FLAGSHIP_VOICE_IDS.map((id) => builtInVoice(id)),
];

export function normalizeVoiceId(value: string | undefined) {
  const id = value?.trim().toLowerCase() ?? "";
  return isVoiceId(id) ? id : DEFAULT_VOICE_ID;
}

function readLanguages(record: Record<string, unknown>) {
  if (Array.isArray(record.languages)) {
    return record.languages
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => item.trim());
  }
  if (typeof record.language === "string" && record.language.trim()) {
    return [record.language.trim()];
  }
  return [];
}

function swedishSupport(id: string, languages: string[]): SwedishSupport {
  const listed = languages.some((language) => {
    const code = language.toLowerCase();
    return code === "sv" || code.startsWith("sv-");
  });
  if (listed) return "listed";
  if (languages.length > 0) return "unspecified";
  return BUILT_IN_IDS.has(id) ? "multilingual" : "unspecified";
}

function textField(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function mapProviderVoices(payload: unknown): VoiceChoice[] {
  if (!payload || typeof payload !== "object" || !("voices" in payload)) return [];
  const voices = (payload as { voices?: unknown }).voices;
  if (!Array.isArray(voices)) return [];

  const mapped: VoiceChoice[] = [];
  for (const entry of voices) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const id = textField(record, "voice_id")?.toLowerCase() ?? "";
    if (!isVoiceId(id)) continue;
    const documented = DOCUMENTED_VOICES[id];
    const languages = readLanguages(record);
    mapped.push({
      id,
      name: textField(record, "name") ?? documented?.name ?? voiceName(id),
      gender: textField(record, "gender") ?? textField(record, "type") ?? documented?.gender,
      tone: textField(record, "tone") ?? documented?.tone,
      description: textField(record, "description") ?? documented?.description,
      accent: textField(record, "accent") ?? textField(record, "locale"),
      languages,
      swedish: swedishSupport(id, languages),
      previewUrl:
        publicPreviewUrl(record.preview_url) ??
        publicPreviewUrl(record.sample_url) ??
        documented?.previewUrl,
    });
  }
  return mapped;
}
