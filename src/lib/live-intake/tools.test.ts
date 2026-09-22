import { afterEach, describe, expect, it } from "vitest";
import { getState, resetState } from "@/lib/backoffice/repository";
import { executeRealtimeTool } from "./tools";

afterEach(async () => {
  await resetState();
});

describe("live intake tool adapter", () => {
  it("returns active demo product information only", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", { query: "auto" });

    expect(result).toMatchObject({
      disclaimer: expect.stringContaining("not a quote"),
      products: [expect.objectContaining({ product: expect.objectContaining({ name: "Auto Core" }) })],
    });
  });

  it("verifies a policy with masked customer details", async () => {
    const result = await executeRealtimeTool("verify_demo_policy", {
      policy_number: "ACM-A-10001",
    });

    expect(result).toMatchObject({
      found: true,
      policy: expect.objectContaining({ policy_number: "ACM-A-10001", customer: "Ada H." }),
    });
    expect(JSON.stringify(result)).not.toContain("@example.com");
  });

  it("rejects a claim without explicit confirmation", async () => {
    const before = (await getState()).claims.length;
    const result = await executeRealtimeTool("create_confirmed_demo_claim", {
      policy_number: "ACM-A-10001",
      loss_date: "2026-09-20",
      claim_type: "Windshield damage",
      description: "A fictional chipped windshield.",
      severity: "low",
      confirmed: false,
    });

    expect(result).toMatchObject({ created: false, error: expect.stringContaining("confirmed") });
    expect((await getState()).claims).toHaveLength(before);
  });

  it("creates a confirmed claim against an active verified policy", async () => {
    const result = await executeRealtimeTool("create_confirmed_demo_claim", {
      policy_number: "ACM-A-10001",
      loss_date: "2026-09-20",
      claim_type: "Windshield damage",
      description: "A fictional chipped windshield.",
      severity: "low",
      confirmed: true,
    });

    expect(result).toMatchObject({ created: true, status: "reported", claim_number: expect.any(String) });
    expect((await getState()).claims).toHaveLength(5);
  });
});
