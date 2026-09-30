import { afterEach, describe, expect, it } from "vitest";
import { getState, resetState } from "@/lib/backoffice/repository";
import { POST } from "./route";

afterEach(async () => {
  await resetState();
});

describe("live intake tool gateway", () => {
  it("runs only validated adapter calls", async () => {
    const response = await POST(
      new Request("http://localhost/api/realtime/tools", {
        method: "POST",
        body: JSON.stringify({ name: "verify_demo_policy", arguments: { policy_number: "one hundred five" } }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      output: { found: true, policy: { policy_number: "••••5" } },
    });
  });

  it("cannot create a claim from a browser request that supplies confirmed: true", async () => {
    const before = (await getState()).claims.length;
    const response = await POST(
      new Request("http://localhost/api/realtime/tools", {
        method: "POST",
        body: JSON.stringify({
          name: "create_confirmed_demo_claim",
          arguments: {
            policy_number: "105",
            loss_date: "2026-09-20",
            claim_type: "Windshield damage",
            description: "A fictional chipped windshield.",
            severity: "low",
            confirmed: true,
          },
        }),
      }),
    );

    await expect(response.json()).resolves.toMatchObject({
      output: { created: false, error: expect.stringContaining("confirmation") },
    });
    expect((await getState()).claims).toHaveLength(before);
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
