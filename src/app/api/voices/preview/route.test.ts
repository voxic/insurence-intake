import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_ACCESS_TOKEN_MIN_LENGTH } from "@/lib/session-guard";
import { resetVoiceRuntimeForTests } from "@/lib/voice-preview";
import { GET } from "./route";

const apiKey = "xai-preview-key-should-not-leak";

function preview(voice = "eve", lang = "en") {
  return GET(new Request(`http://localhost/api/voices/preview?voice=${voice}&lang=${lang}`));
}

beforeEach(() => {
  resetVoiceRuntimeForTests();
  delete process.env.XAI_API_KEY;
  delete process.env.SESSION_ACCESS_TOKEN;
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("GET /api/voices/preview", () => {
  it("explains that synthesis is unavailable when the key is missing", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await preview();
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ configured: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("synthesizes once and serves the cached audio on the next click", async () => {
    process.env.XAI_API_KEY = apiKey;
    const audio = Uint8Array.from([9, 8, 7, 6]);
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const first = await preview();
    const second = await preview();

    expect(first.status).toBe(200);
    expect(first.headers.get("x-preview-cache")).toBe("miss");
    expect(first.headers.get("content-type")).toContain("audio/mpeg");
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(audio);
    expect(second.headers.get("x-preview-cache")).toBe("hit");
    expect(new Uint8Array(await second.arrayBuffer())).toEqual(audio);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.x.ai/v1/tts",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: `Bearer ${apiKey}` }),
      }),
    );
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1].body));
    expect(requestBody).toMatchObject({ voice_id: "eve", language: "en" });
    expect(requestBody.text).toContain("Acme Insurance");
    expect(JSON.stringify(requestBody)).not.toContain(apiKey);
  });

  it("retries a rejected Swedish code with auto, then caches that audio", async () => {
    process.env.XAI_API_KEY = apiKey;
    const audio = Uint8Array.from([4, 5]);
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("unsupported language", { status: 400 }))
      .mockResolvedValueOnce(
        new Response(audio, { status: 200, headers: { "Content-Type": "audio/mpeg" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    const first = await preview("ara", "sv");
    const second = await preview("ara", "sv");

    expect(first.status).toBe(200);
    expect(new Uint8Array(await first.arrayBuffer())).toEqual(audio);
    expect(second.headers.get("x-preview-cache")).toBe("hit");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const languages = fetchMock.mock.calls.map(
      (call) => JSON.parse(String(call[1].body)).language as string,
    );
    expect(languages).toEqual(["sv", "auto"]);
  });

  it("rejects an unknown voice before calling the provider", async () => {
    process.env.XAI_API_KEY = apiKey;
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await preview("not%20a%20voice");
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not synthesize when the session guard is closed", async () => {
    process.env.XAI_API_KEY = apiKey;
    process.env.SESSION_ACCESS_TOKEN = "t".repeat(SESSION_ACCESS_TOKEN_MIN_LENGTH);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const response = await preview();
    expect(response.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
