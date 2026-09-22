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

  it("sets a scoped HTTP-only, SameSite cookie after successful login", async () => {
    process.env.DEMO_PASSWORD = demoPassword;
    const response = await login(demoPassword);
    const cookie = response.headers.get("set-cookie") ?? "";

    expect(response.status).toBe(200);
    expect(cookie).toContain(`${DEMO_SESSION_COOKIE}=`);
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=strict");
    expect(cookie).toContain("Path=/api/session");
  });
});
