import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getState, resetState, updatePolicy, updateProduct } from "@/lib/backoffice/repository";
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
  });

  it("lists every active product when the query is empty", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", { query: "" });

    expect(productNames(result)).toEqual(activeCatalog);
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
      ["djurförsäkring", "pet care", "Pet Plus"],
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

  it("matches a natural sentence about a cat or dog in either language", async () => {
    const sentences = [
      "insurance for a cat",
      "I would like insurance for my cat",
      "försäkring för en katt",
      "kattförsäkring",
      "jag vill försäkra min katt",
      "dog insurance",
      "do you have anything for dogs",
      "hundförsäkring",
      "försäkring för min hund",
      "a kitten and a puppy",
      "husdjur",
    ];
    for (const query of sentences) {
      expect(productNames(await executeRealtimeTool("lookup_demo_product", { query })), query).toEqual(["Pet Plus"]);
    }
  });

  it("matches natural sentences for the other lines", async () => {
    const cases: Array<[string, string[]]> = [
      ["insurance for my house", ["Villa Cover"]],
      ["försäkring för mitt hus", ["Villa Cover"]],
      ["jag behöver försäkra bilen", ["Auto Core", "Auto Full", "Auto Partial"]],
      ["insure my car", ["Auto Core", "Auto Full", "Auto Partial"]],
      ["vi ska ut och resa", ["Trip Cover"]],
      ["cover for a vacation abroad", ["Trip Cover"]],
      ["jag hyr en lägenhet", ["Home Plus"]],
      ["hyresrätt", ["Rent Easy"]],
    ];
    for (const [query, names] of cases) {
      expect(productNames(await executeRealtimeTool("lookup_demo_product", { query })), query).toEqual(names);
    }
  });

  it("returns every matching line when a sentence names several", async () => {
    const result = await executeRealtimeTool("lookup_demo_product", { query: "home and car insurance" });

    expect(productNames(result)).toEqual(["Auto Core", "Auto Full", "Auto Partial", "Home Plus"]);
  });

  it("still misses a product the catalog does not have", async () => {
    for (const query of ["insurance for my boat", "båtförsäkring", "do you insure drones"]) {
      expect(productNames(await executeRealtimeTool("lookup_demo_product", { query })), query).toEqual([]);
    }
  });

  it("lists every active product for a generic English catalog question", async () => {
    for (const query of ["what do you offer", "what kinds of insurance can I get", "vad erbjuder ni"]) {
      expect(productNames(await executeRealtimeTool("lookup_demo_product", { query })), query).toEqual(activeCatalog);
    }
  });

  it("searches an alias added at runtime without a reseed", async () => {
    expect(productNames(await executeRealtimeTool("lookup_demo_product", { query: "insurance for my hamster" }))).toEqual([]);

    const pet = (await getState()).products.find((product) => product.id === "prd_pet_plus")!;
    await updateProduct("prd_pet_plus", {
      aliases: { en: [...pet.aliases!.en, "hamster"], sv: [...pet.aliases!.sv, "marsvin"] },
    });

    expect(productNames(await executeRealtimeTool("lookup_demo_product", { query: "insurance for my hamster" }))).toEqual(["Pet Plus"]);
    expect(productNames(await executeRealtimeTool("lookup_demo_product", { query: "marsvinsförsäkring" }))).toEqual(["Pet Plus"]);
  });

  it("falls back to description words when no alias matches", async () => {
    await updateProduct("prd_pet_plus", { description: "Demo pet cover for fictional dogs, cats, and parrots." });

    expect(productNames(await executeRealtimeTool("lookup_demo_product", { query: "do you cover parrots" }))).toEqual(["Pet Plus"]);
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
      policy_number: "105",
    }, { callId });

    expect(result).toMatchObject({
      found: true, policy: expect.objectContaining({ policy_number: "••••5", customer: "Ada H." }),
    });
    expect(JSON.stringify(result)).not.toContain("105");
    expect(JSON.stringify(result)).not.toContain("@example.com");
  });

  it("verifies spoken digits and a natural reading without the old prefix", async () => {
    for (const policy_number of ["one zero five", "one oh five", "one hundred five", "one hundred and five"]) {
      const result = await executeRealtimeTool("verify_demo_policy", { policy_number }, { callId });
      expect(result, policy_number).toMatchObject({
        found: true, policy: expect.objectContaining({ policy_number: "••••5", customer: "Ada H." }),
      });
    }

    const grouped = await executeRealtimeTool("verify_demo_policy", { policy_number: "one forty two" }, { callId });
    expect(grouped).toMatchObject({
      found: true, policy: expect.objectContaining({ customer: "Ben O." }),
    });

    const prefixed = await executeRealtimeTool("verify_demo_policy", { policy_number: "ACM-A-10001" }, { callId });
    expect(prefixed).toMatchObject({ found: false });
  });

  it("rejects a browser-style confirmed flag without server call state", async () => {
    const before = (await getState()).claims.length;
    const result = await executeRealtimeTool("create_confirmed_demo_claim", {
      policy_number: "105",
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
      policy_number: "105",
      loss_date: "2026-09-20",
      claim_type: "Windshield damage",
      description: "A fictional chipped windshield.",
      severity: "low",
    };
    await executeRealtimeTool("verify_demo_policy", { policy_number: "one oh five" }, { callId });
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
        policy_number: "five three one",
        loss_date: "2026-09-20",
        claim_type: "Windshield damage",
        description: "A fictional chipped windshield.",
        severity: "low",
      },
      { callId },
    );
    expect(inactive).toMatchObject({ confirmed: false });

    await executeRealtimeTool("verify_demo_policy", { policy_number: "one zero five" }, { callId });
    const sensitive = await executeRealtimeTool(
      "confirm_demo_claim",
      {
        policy_number: "105",
        loss_date: "2026-09-20",
        claim_type: "Windshield damage",
        description: "My SSN is 123-45-6789.",
        severity: "low",
      },
      { callId },
    );
    expect(sensitive).toMatchObject({ confirmed: false });
  });

  it("sees runtime product and policy edits on the next call without a restart", async () => {
    await updateProduct("prd_auto", { description: "Edited demo auto cover.", deductibles: [750] });
    await updatePolicy("pol_ada", { coverage: "Liability only", deductible: 900 });

    const product = await executeRealtimeTool("lookup_demo_product", { query: "auto core" });
    expect(product.products).toEqual([
      expect.objectContaining({ name: "Auto Core", description: "Edited demo auto cover.", deductibles: [750] }),
    ]);
    const policy = await executeRealtimeTool("verify_demo_policy", { policy_number: "105" }, { callId });
    expect(policy).toMatchObject({ found: true, policy: expect.objectContaining({ coverage: "Liability only", deductible: 900 }) });

    await updateProduct("prd_auto", { active: false });
    expect(productNames(await executeRealtimeTool("lookup_demo_product", { query: "auto" }))).toEqual(["Auto Full", "Auto Partial"]);

    await resetState();
    expect(productNames(await executeRealtimeTool("lookup_demo_product", { query: "auto" }))).toEqual(["Auto Core", "Auto Full", "Auto Partial"]);
    expect(await executeRealtimeTool("verify_demo_policy", { policy_number: "105" }, { callId })).toMatchObject({
      policy: expect.objectContaining({ coverage: "Comprehensive", deductible: 500 }),
    });
  });
});
