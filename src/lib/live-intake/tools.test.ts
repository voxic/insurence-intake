import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getState, resetState } from "@/lib/backoffice/repository";
import { clearLiveIntakeCallsForTest, createLiveIntakeCall } from "./call-state";
import { executeRealtimeTool } from "./tools";

afterEach(async () => {
  await resetState();
});

describe("live intake tool adapter", () => {
  let callId: string;

  beforeEach(async () => {
    await resetState();
    clearLiveIntakeCallsForTest();
    callId = createLiveIntakeCall();
  });

  const activeCatalog = [
    "Auto Core",
    "Auto Full",
    "Auto Partial",
    "Home Plus",
    "Personal Accident",
    "Pet Plus",
    "Rent Easy",
    "Term Life",
    "Trip Cover",
    "Villa Cover",
  ];

  function productNames(result: { products?: unknown }) {
    return (result.products as Array<{ name: string }>).map((item) => item.name);
  }

  it("returns active demo auto products only", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", { query: "auto" });

    expect(result.disclaimer).toEqual(expect.stringContaining("not a quote"));
    expect(productNames(result)).toEqual(["Auto Core", "Auto Full", "Auto Partial"]);
    expect(JSON.stringify(result)).not.toContain("Pet Care");
  });

  it("lists every active product when the query is empty", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", { query: "" });

    expect(productNames(result)).toEqual(activeCatalog);
    expect(JSON.stringify(result)).not.toContain("Pet Care");
  });

  it("lists every active product for a generic Swedish catalog question", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", {
      query: "vilka försäkringar finns",
    });

    expect(productNames(result)).toEqual(activeCatalog);
  });

  it("matches each line from Swedish and English aliases", async () => {
    const cases: Array<[string, string, string]> = [
      ["hemförsäkring", "home insurance", "Home Plus"],
      ["villaförsäkring", "house insurance", "Villa Cover"],
      ["hyresgästförsäkring", "renters insurance", "Rent Easy"],
      ["helförsäkring", "full coverage auto", "Auto Full"],
      ["halvförsäkring", "partial auto", "Auto Partial"],
      ["reseförsäkring", "travel insurance", "Trip Cover"],
      ["husdjursförsäkring", "pet insurance", "Pet Plus"],
      ["livförsäkring", "life insurance", "Term Life"],
      ["olycksfallsförsäkring", "accident insurance", "Personal Accident"],
    ];

    for (const [swedish, english, name] of cases) {
      for (const query of [swedish, english]) {
        const result = await executeRealtimeTool("lookup_demo_product", { query });
        expect(productNames(result), query).toEqual([name]);
      }
    }
  });

  it("returns spoken coverages, deductibles, and the demo annual range", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", { query: "hemförsäkring" });

    expect(result.products).toEqual([
      expect.objectContaining({
        name: "Home Plus",
        swedish_name: "hemförsäkring",
        line: "home",
        coverages: expect.arrayContaining(["Dwelling"]),
        deductibles: expect.arrayContaining([500]),
        annual_price_range: { min: 650, max: 2100, currency: "USD" },
      }),
    ]);
  });

  it("matches a coverage word inside a longer English question", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", {
      query: "do you cover collision damage",
    });

    expect(productNames(result)).toEqual(["Auto Core", "Auto Full"]);
  });

  it("matches a Swedish hemförsäkring query to the home product", async () => {
    const singular = await executeRealtimeTool("lookup_demo_product", { query: "hemförsäkring" });
    const plural = await executeRealtimeTool("lookup_demo_product", { query: "Hemförsäkringar" });

    for (const result of [singular, plural]) {
      expect(result.products).toEqual([
        expect.objectContaining({ name: "Home Plus", line: "home", swedish_name: "hemförsäkring" }),
      ]);
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
