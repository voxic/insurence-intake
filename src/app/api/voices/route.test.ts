import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_ACCESS_TOKEN_MIN_LENGTH } from "@/lib/session-guard";
import { resetVoiceRuntimeForTests } from "@/lib/voice-preview";
import { GET } from "./route";

const apiKey = "xai-test-key-should-not-leak";

function get(headers: Record<string, string> = {}) {
  return GET(new Request("http://localhost/api/voices", { headers }));
}

beforeEach(() => {
  resetVoiceRuntimeForTests();
  delete process.env.XAI_API_KEY;
  delete process.env.SESSION_ACCESS_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/voices", () => {
  it("returns the built-in roster without calling xAI when the key is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ provider: "xai", configured: false, source: "catalog" });
    expect(body.voices.find((voice: { id: string }) => voice.id === "eve")).toMatchObject({
      name: "Eve",
      gender: "Female",
      swedish: "multilingual",
      previewUrl: "https://data.x.ai/audio-samples/voice_eve.mp3",
    });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain(apiKey);
  });

  it("uses the provider list and does not return the API key", async () => {
    process.env.XAI_API_KEY = apiKey;
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          voices: [
            {
              voice_id: "Eve",
              name: "Eve",
              gender: "female",
              tone: "Bright",
              languages: ["en", "sv"],
              preview_url: "https://data.x.ai/audio-samples/voice_eve.mp3",
            },
            {
              voice_id: "desk",
              name: "Desk",
              description: "Custom",
              preview_url: "http://insecure.example/sample.mp3",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await get();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ configured: true, source: "provider" });
    expect(body.voices).toEqual([
      expect.objectContaining({
        id: "eve",
        gender: "female",
        tone: "Bright",
        swedish: "listed",
        previewUrl: "https://data.x.ai/audio-samples/voice_eve.mp3",
      }),
      expect.objectContaining({
        id: "desk",
        name: "Desk",
        description: "Custom",
        swedish: "unspecified",
      }),
    ]);
    expect(body.voices[1].previewUrl).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.ai/v1/tts/voices",
      expect.objectContaining({
        headers: { Authorization: `Bearer ${apiKey}` },
      }),
    );
    expect(JSON.stringify(body)).not.toContain(apiKey);
  });

  it("does not call xAI when the session guard is closed", async () => {
    process.env.XAI_API_KEY = apiKey;
    process.env.SESSION_ACCESS_TOKEN = "t".repeat(SESSION_ACCESS_TOKEN_MIN_LENGTH);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await get();
    const body = await response.json();

    expect(body).toMatchObject({ configured: false, source: "catalog" });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
