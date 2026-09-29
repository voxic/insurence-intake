import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getState, resetState } from "@/lib/backoffice/repository";
import { clearLiveIntakeCallsForTest, createLiveIntakeCall } from "./call-state";
import { executeRealtimeTool } from "./tools";

afterEach(async () => {
  await resetState();
});

describe("live intake tool adapter", () => {
  let callId: string;

  beforeEach(() => {
    clearLiveIntakeCallsForTest();
    callId = createLiveIntakeCall();
  });

  it("returns active demo product information only", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", { query: "auto" });

    expect(result).toMatchObject({
      disclaimer: expect.stringContaining("not a quote"),
      products: [expect.objectContaining({ product: expect.objectContaining({ name: "Auto Core" }) })],
    });
  });

  it("lists every active product when the query is empty", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", { query: "" });
    const products = result.products as Array<{ product: { name: string } }>;

    expect(products.map((item) => item.product.name).sort()).toEqual([
      "Auto Core",
      "Home Plus",
      "Rent Easy",
    ]);
    expect(JSON.stringify(result)).not.toContain("Pet Care");
  });

  it("lists every active product for a generic Swedish catalog question", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", {
      query: "vilka försäkringar finns",
    });
    const products = result.products as Array<{ product: { name: string } }>;

    expect(products.map((item) => item.product.name).sort()).toEqual([
      "Auto Core",
      "Home Plus",
      "Rent Easy",
    ]);
  });

  it("matches a Swedish hemförsäkring query to the home product", async () => {
    const singular = await executeRealtimeTool("lookup_demo_product", { query: "hemförsäkring" });
    const plural = await executeRealtimeTool("lookup_demo_product", { query: "Hemförsäkringar" });

    for (const result of [singular, plural]) {
      expect(result).toMatchObject({
        products: [
          expect.objectContaining({
            product: expect.objectContaining({ name: "Home Plus", lineOfBusiness: "home" }),
          }),
        ],
      });
      expect(result.products).toHaveLength(1);
    }
  });

  it("verifies a policy with masked customer and policy details", async () => {
    const result = await executeRealtimeTool("verify_demo_policy", {
      policy_number: "ACM-A-10001",
    }, { callId });

    expect(result).toMatchObject({
      found: true, policy: expect.objectContaining({ policy_number: "••••0001", customer: "Ada H." }),
    });
    expect(JSON.stringify(result)).not.toContain("ACM-A-10001");
    expect(JSON.stringify(result)).not.toContain("@example.com");
  });

  it("rejects a browser-style confirmed flag without server call state", async () => {
    const before = (await getState()).claims.length;
    const result = await executeRealtimeTool("create_confirmed_demo_claim", {
      policy_number: "ACM-A-10001",
      loss_date: "2026-09-20",
      claim_type: "Windshield damage",
      description: "A fictional chipped windshield.",
      severity: "low",
      confirmed: false,
    });

    expect(result).toMatchObject({ created: false, error: expect.stringContaining("confirmation") });
    expect((await getState()).claims).toHaveLength(before);
  });

  it("creates only after verifying and recording an explicit call confirmation", async () => {
    const before = (await getState()).claims.length;
    const details = {
      policy_number: "ACM-A-10001",
      loss_date: "2026-09-20",
      claim_type: "Windshield damage",
      description: "A fictional chipped windshield.",
      severity: "low",
    };
    await executeRealtimeTool("verify_demo_policy", { policy_number: details.policy_number }, { callId });
    const confirmation = await executeRealtimeTool("confirm_demo_claim", details, { callId });
    const confirmationId = confirmation.confirmation_id;
    expect(typeof confirmationId).toBe("string");
    const result = await executeRealtimeTool(
      "create_confirmed_demo_claim",
      { ...details, confirmation_id: confirmationId },
      { callId },
    );

    expect(result).toMatchObject({ created: true, status: "reported", claim_number: expect.any(String) });
    expect((await getState()).claims).toHaveLength(before + 1);
  });

  it("rejects sensitive claim content and inactive policies", async () => {
    const inactive = await executeRealtimeTool(
      "confirm_demo_claim",
      {
        policy_number: "ACM-A-10006",
        loss_date: "2026-09-20",
        claim_type: "Windshield damage",
        description: "A fictional chipped windshield.",
        severity: "low",
      },
      { callId },
    );
    expect(inactive).toMatchObject({ confirmed: false });

    await executeRealtimeTool("verify_demo_policy", { policy_number: "ACM-A-10001" }, { callId });
    const sensitive = await executeRealtimeTool(
      "confirm_demo_claim",
      {
        policy_number: "ACM-A-10001",
        loss_date: "2026-09-20",
        claim_type: "Windshield damage",
        description: "My SSN is 123-45-6789.",
        severity: "low",
      },
      { callId },
    );
    expect(sensitive).toMatchObject({ confirmed: false });
  });
});
