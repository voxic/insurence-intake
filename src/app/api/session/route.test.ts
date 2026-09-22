import { afterEach, describe, expect, it } from "vitest";
import { SESSION_ACCESS_TOKEN_MIN_LENGTH } from "@/lib/session-guard";
import { GET, POST } from "./route";

const token = "t".repeat(SESSION_ACCESS_TOKEN_MIN_LENGTH);

function post(headers: Record<string, string> = {}) {
  return POST(
    new Request("http://localhost/api/session", { method: "POST", headers }),
  );
}

afterEach(() => {
  delete process.env.SESSION_ACCESS_TOKEN;
  delete process.env.XAI_API_KEY;
});

describe("POST /api/session guard", () => {
  it("rejects unauthenticated mint requests when a token is configured", async () => {
    process.env.SESSION_ACCESS_TOKEN = token;
    const response = await post();
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toContain("Bearer");
  });

  it("rejects a wrong session token", async () => {
    process.env.SESSION_ACCESS_TOKEN = token;
    const response = await post({ authorization: `Bearer ${"x".repeat(SESSION_ACCESS_TOKEN_MIN_LENGTH)}` });
    expect(response.status).toBe(401);
  });

  it("passes the guard with the correct token (then fails only on missing XAI key)", async () => {
    process.env.SESSION_ACCESS_TOKEN = token;
    delete process.env.XAI_API_KEY;
    const response = await post({ "x-session-access-token": token });
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ configured: false });
  });

  it("is open when no token is configured", async () => {
    delete process.env.SESSION_ACCESS_TOKEN;
    delete process.env.XAI_API_KEY;
    const response = await post();
    expect(response.status).toBe(503);
  });
});

describe("GET /api/session", () => {
  it("reports whether a session access token is required", async () => {
    process.env.SESSION_ACCESS_TOKEN = token;
    await expect((await GET()).json()).resolves.toMatchObject({ accessTokenRequired: true });
    delete process.env.SESSION_ACCESS_TOKEN;
    await expect((await GET()).json()).resolves.toMatchObject({ accessTokenRequired: false });
  });
});
