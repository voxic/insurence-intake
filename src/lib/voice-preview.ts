import { hasDemoSession } from "@/lib/demo-password";
import {
  isAuthorizedSessionRequest,
  sessionCredentialFrom,
} from "@/lib/session-guard";
import {
  BUILT_IN_VOICES,
  isVoiceId,
  mapProviderVoices,
  PREVIEW_LINES,
  SWEDISH_VOICE_NOTE,
  type PreviewLanguage,
  type VoiceChoice,
} from "@/lib/voices";

const VOICES_URL = "https://api.x.ai/v1/tts/voices";
const TTS_URL = "https://api.x.ai/v1/tts";

export type VoiceCatalog = {
  provider: "xai";
  configured: boolean;
  source: "provider" | "catalog";
  swedishNote: string;
  voices: VoiceChoice[];
  warning?: string;
};

type CachedAudio = {
  bytes: Uint8Array;
  contentType: string;
};

const previewCache = new Map<string, CachedAudio>();
let providerVoices: VoiceChoice[] | null = null;

export class VoicePreviewError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly configured = true,
  ) {
    super(message);
  }
}

export function xaiApiKey() {
  const key = process.env.XAI_API_KEY?.trim();
  return key ? key : undefined;
}

export function resetVoiceRuntimeForTests() {
  previewCache.clear();
  providerVoices = null;
}

export function voiceRouteAllowed(request: Request) {
  const credential = sessionCredentialFrom({
    authorization: request.headers.get("authorization"),
    sessionAccessToken: request.headers.get("x-session-access-token"),
  });
  return isAuthorizedSessionRequest(credential) || hasDemoSession(request.headers.get("cookie"));
}

export function catalogPayload(configured: boolean, warning?: string): VoiceCatalog {
  return {
    provider: "xai",
    configured,
    source: "catalog",
    swedishNote: SWEDISH_VOICE_NOTE,
    voices: BUILT_IN_VOICES,
    ...(warning ? { warning } : {}),
  };
}

export async function loadVoiceChoices(): Promise<VoiceCatalog> {
  const key = xaiApiKey();
  if (!key) return catalogPayload(false);
  if (providerVoices) {
    return {
      provider: "xai",
      configured: true,
      source: "provider",
      swedishNote: SWEDISH_VOICE_NOTE,
      voices: providerVoices,
    };
  }

  try {
    const response = await fetch(VOICES_URL, {
      headers: { Authorization: `Bearer ${key}` },
      cache: "no-store",
    });
    if (!response.ok) {
      return catalogPayload(true, "xAI's voice list was unavailable. Showing the built-in roster.");
    }
    const voices = mapProviderVoices(await response.json());
    if (voices.length === 0) {
      return catalogPayload(true, "xAI returned no voices. Showing the built-in roster.");
    }
    providerVoices = voices;
    return {
      provider: "xai",
      configured: true,
      source: "provider",
      swedishNote: SWEDISH_VOICE_NOTE,
      voices,
    };
  } catch {
    return catalogPayload(true, "xAI's voice list was unavailable. Showing the built-in roster.");
  }
}

function audioContentType(header: string | null) {
  const value = header?.split(";")[0]?.trim().toLowerCase() ?? "";
  return value.startsWith("audio/") ? value : "audio/mpeg";
}

async function requestSpeech(key: string, voiceId: string, language: string, text: string) {
  return fetch(TTS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      voice_id: voiceId,
      language,
      output_format: { codec: "mp3", sample_rate: 24000, bit_rate: 128000 },
    }),
    cache: "no-store",
  });
}

export async function synthesizePreview(voiceId: string, language: PreviewLanguage) {
  if (!isVoiceId(voiceId)) {
    throw new VoicePreviewError("Unknown voice.", 400);
  }
  const key = xaiApiKey();
  if (!key) {
    throw new VoicePreviewError(
      "XAI_API_KEY is missing. Published samples still play. Synthesized previews stay on the server.",
      503,
      false,
    );
  }

  const cacheKey = `${voiceId}:${language}`;
  const cached = previewCache.get(cacheKey);
  if (cached) return { ...cached, cached: true as const };

  const line = PREVIEW_LINES[language];
  let response = await requestSpeech(key, voiceId, line.language, line.text);
  // sv is spoken by Grok Voice but omitted from the official TTS code table.
  if (!response.ok && line.language === "sv" && response.status === 400) {
    response = await requestSpeech(key, voiceId, "auto", line.text);
  }
  if (!response.ok) {
    throw new VoicePreviewError("xAI could not synthesize that sample.", response.status >= 500 ? 502 : 400);
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength === 0) {
    throw new VoicePreviewError("xAI returned empty audio.", 502);
  }
  const entry = { bytes, contentType: audioContentType(response.headers.get("content-type")) };
  previewCache.set(cacheKey, entry);
  return { ...entry, cached: false as const };
}
