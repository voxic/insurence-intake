import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("live intake tool gateway", () => {
  it("runs only validated adapter calls", async () => {
    const response = await POST(
      new Request("http://localhost/api/realtime/tools", {
        method: "POST",
        body: JSON.stringify({ name: "verify_demo_policy", arguments: { policy_number: "ACM-A-10001" } }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      output: { found: true, policy: { policy_number: "ACM-A-10001" } },
    });
  });

  it("rejects malformed gateway requests", async () => {
    const response = await POST(
      new Request("http://localhost/api/realtime/tools", {
        method: "POST",
        body: JSON.stringify({ name: "create_confirmed_demo_claim" }),
      }),
    );

    expect(response.status).toBe(400);
  });
});
