import { describe, expect, it } from "vitest";
import seed from "../../../data/backoffice/seed.json";
import type { BackofficeState } from "./types";
import { claimStatusVariant, customerStatusVariant, policyRows, policyStatusVariant } from "./view-model";

const state = seed as unknown as BackofficeState;

describe("backoffice view model", () => {
  it("joins every seeded policy to its customer and product", () => {
    const rows = policyRows(state);
    expect(rows).toHaveLength(seed.policies.length);
    expect(rows.filter((row) => row.status === "active")).toHaveLength(6);
    for (const row of rows) {
      expect(row.customerName).not.toBe("Unknown customer");
      expect(row.productName).not.toBe("Unknown product");
      expect(row.premium).toBeGreaterThan(0);
      expect(row.effectiveDate < row.expirationDate).toBe(true);
    }
    const ada = rows.find((row) => row.number === "105");
    expect(ada).toMatchObject({ customerName: "Ada Hart", productName: "Auto Core", status: "active", premium: 1200 });
  });

  it("lists active policies before expired ones, newest first", () => {
    const rows = policyRows(state);
    const firstExpired = rows.findIndex((row) => row.status !== "active");
    expect(rows.slice(0, firstExpired).every((row) => row.status === "active")).toBe(true);
    expect(rows.slice(firstExpired).every((row) => row.status !== "active")).toBe(true);
    expect(rows[0].effectiveDate >= rows[1].effectiveDate).toBe(true);
  });

  it("falls back to placeholder names for orphaned policies", () => {
    const [row] = policyRows({ customers: [], products: [], policies: [state.policies[0]] });
    expect(row.customerName).toBe("Unknown customer");
    expect(row.productName).toBe("Unknown product");
  });

  it("keeps reported red and gives every other status a filled or bordered badge", () => {
    expect(claimStatusVariant.reported).toBe("destructive");
    expect(Object.values(claimStatusVariant).filter((variant) => variant === "outline")).toHaveLength(1);
    expect(Object.values(customerStatusVariant).filter((variant) => variant === "outline")).toHaveLength(1);
    expect(Object.values(policyStatusVariant).filter((variant) => variant === "outline")).toHaveLength(0);
    for (const status of seed.claims.map((claim) => claim.status)) expect(claimStatusVariant[status as keyof typeof claimStatusVariant]).toBeDefined();
    for (const status of seed.policies.map((policy) => policy.status)) expect(policyStatusVariant[status as keyof typeof policyStatusVariant]).toBeDefined();
  });
});
