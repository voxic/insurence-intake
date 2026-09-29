import { afterEach, describe, expect, it } from "vitest";
import { DEMO_SESSION_COOKIE } from "@/lib/demo-password";
import { POST } from "./route";

const demoPassword = "demo-password";

function login(password: unknown) {
  return POST(
    new Request("http://localhost/api/demo-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    }),
  );
}

afterEach(() => {
  delete process.env.DEMO_PASSWORD;
});

describe("POST /api/demo-login", () => {
  it("rejects a wrong password without setting a session cookie", async () => {
    process.env.DEMO_PASSWORD = demoPassword;
    const response = await login("wrong-password");

    expect(response.status).toBe(401);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets a site-wide HTTP-only, SameSite session cookie after successful login", async () => {
    process.env.DEMO_PASSWORD = demoPassword;
    const response = await login(demoPassword);
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain(`${DEMO_SESSION_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    // Path=/ so page navigations between / and /settings keep the gate open.
    expect(cookie).toMatch(/Path=\/(?:;|$)/);
    expect(cookie).not.toContain("Path=/api/session");
    const maxAge = Number(/Max-Age=(\d+)/.exec(cookie)?.[1]);
    expect(maxAge).toBeGreaterThanOrEqual(60 * 60 * 2);
    expect(maxAge).toBeLessThanOrEqual(60 * 60 * 24);
  });

  it("keeps the cookie value free of the password and server secrets", async () => {
    process.env.DEMO_PASSWORD = demoPassword;
    process.env.XAI_API_KEY = "xai-server-only-key";
    process.env.MCP_AUTH_TOKEN = "mcp-server-only-token-value";
    const response = await login(demoPassword);
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(cookie).not.toContain(demoPassword);
    expect(cookie).not.toContain("xai-server-only-key");
    expect(cookie).not.toContain("mcp-server-only-token-value");
    delete process.env.XAI_API_KEY;
    delete process.env.MCP_AUTH_TOKEN;
  });
});
