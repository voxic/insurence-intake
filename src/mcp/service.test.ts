import { afterEach, describe, expect, it } from "vitest";
import { getState, resetState } from "@/lib/backoffice/repository";
import { mcpToolNames } from "./server";
import { redact } from "./redaction";
import {
  getClaim,
  getCustomer,
  getPriceIndication,
  getProduct,
  listProducts,
  readResource,
  searchClaims,
  searchCustomers,
} from "./service";

afterEach(async () => { await resetState(); });

describe("demo MCP service", () => {
  it("masks customer PII and policy numbers", async () => {
    const result = await getCustomer({ customerId: "cus_ada" });
    expect(result?.customer).toMatchObject({ name: "Ada H.", phone: "***-***-0101", email: "a***@example.com" });
    expect(JSON.stringify(result)).not.toContain("14 Fictional Lane");
    expect(JSON.stringify(result)).not.toContain("ACM-A-10001");
  });

  it("requires a customer search identifier and rejects larger requested limits", async () => {
    await expect(searchCustomers({ limit: 10 })).rejects.toThrow();
    await expect(searchCustomers({ name: "a", limit: 11 })).rejects.toThrow();
  });

  it("only searches claims with a customer or claim identifier", async () => {
    await expect(searchClaims({ status: "reported" })).rejects.toThrow();
    const result = await searchClaims({ claimNumber: "26002" });
    expect(result.claims).toEqual([expect.objectContaining({ claimId: "clm_ben", claimNumber: "••••6002" })]);
  });

  it("does not reveal a claim when customer ownership does not match", async () => {
    expect(await getClaim({ claimId: "clm_ada", customerId: "cus_ben" })).toBeUndefined();
  });

  it("returns a deterministic, non-binding price indication", async () => {
    const first = await getPriceIndication({ productId: "prd_auto" });
    const second = await getPriceIndication({ productId: "prd_auto" });
    expect(first).toEqual(second);
    expect(first).toMatchObject({ indication: true, annualRange: { low: 1080, high: 1320 } });
    expect(first?.disclaimer).toContain("not a quote");
  });

  it("uses the same backoffice catalog for products and resources", async () => {
    const products = await listProducts({ limit: 20 });
    const catalog = await readResource("insurance://demo/catalog") as { products: unknown[] };
    expect(products.products).toHaveLength(11);
    expect(catalog.products).toHaveLength(11);
    expect(await getProduct({ productId: "prd_pet" })).toMatchObject({ product: { active: false } });
  });

  it("never returns government IDs, payment data, secrets, transcripts, or unmasked contact fields", async () => {
    const state = await getState();
    const payloads = [
      await searchCustomers({ name: "Ada" }),
      await getCustomer({ customerId: "cus_ada" }),
      await listProducts({ limit: 10 }),
      await getProduct({ productId: "prd_auto" }),
      await getPriceIndication({ customerId: "cus_ada", productId: "prd_auto" }),
      await searchClaims({ customerId: "cus_ada" }),
      await getClaim({ claimId: "clm_ada", customerId: "cus_ada" }),
      await readResource("insurance://demo/catalog"),
      await readResource("insurance://demo/pricing-methodology"),
      await readResource("insurance://demo/data-notice"),
      await readResource("insurance://demo/customer/cus_ada/summary"),
      await readResource("insurance://demo/claim/clm_ada/summary"),
    ];
    const serialized = JSON.stringify(payloads);
    for (const customer of state.customers) {
      expect(serialized).not.toContain(customer.name);
      expect(serialized).not.toContain(customer.email);
      expect(serialized).not.toContain(customer.phone);
      expect(serialized).not.toContain(customer.address);
    }
    expect(serialized).not.toMatch(/"dateOfBirth"|"dob"/i);
    for (const policy of state.policies) expect(serialized).not.toContain(policy.number);
    for (const claim of state.claims) {
      expect(serialized).not.toContain(claim.number);
      expect(serialized).not.toContain(claim.description);
      for (const event of claim.events) expect(serialized).not.toContain(event.note);
    }
    expect(serialized).not.toMatch(/"paidAmount"|"reserve"|"premium"|"ssn"|"passport"|"cvv"|"iban"|"transcript"|"callId"/i);
    expect(mcpToolNames.join(",")).not.toMatch(/transcript|handoff|create_|update_|bind_/);
    expect(redact({ ssn: "123-45-6789", paidAmount: 3100, customer: { address: "nope", name: "Ada H." } })).toEqual({
      customer: { name: "Ada H." },
    });
  });
});
