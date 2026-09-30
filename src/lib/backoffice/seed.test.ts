import { describe, expect, it } from "vitest";
import seed from "../../../data/backoffice/seed.json";
import { PRODUCT_LINES } from "./types";

describe("backoffice seed", () => {
  it("uses unique ids and required product fields", () => {
    const ids = [
      ...seed.customers.map((item) => item.id),
      ...seed.products.map((item) => item.id),
      ...seed.policies.map((item) => item.id),
      ...seed.pricingRules.map((item) => item.id),
      ...seed.claims.map((item) => item.id),
      ...seed.claims.flatMap((claim) => claim.events.map((event) => event.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);

    for (const product of seed.products) {
      expect(product.id).toMatch(/^prd_[a-z0-9_-]+$/);
      expect(product.code.length).toBeGreaterThanOrEqual(3);
      expect(product.name.length).toBeGreaterThanOrEqual(2);
      expect(PRODUCT_LINES).toContain(product.line);
      expect(product.description.length).toBeGreaterThanOrEqual(4);
      expect(product.coverages.length).toBeGreaterThan(0);
      expect(product.deductibles.length).toBeGreaterThan(0);
      expect(product.deductibles.every((amount) => Number.isInteger(amount) && amount >= 0)).toBe(true);
      expect(product.aliases.en.length).toBeGreaterThan(0);
      expect(product.aliases.sv.length).toBeGreaterThan(0);
      expect(product.priceRange.currency).toBe("USD");
      expect(product.priceRange.max).toBeGreaterThanOrEqual(product.priceRange.min);
      expect(product.priceRange.min).toBeGreaterThan(0);
    }

    expect(seed.products.filter((product) => product.active !== true).map((product) => product.id)).toEqual([]);

    const productIds = new Set(seed.products.map((product) => product.id));
    for (const rule of seed.pricingRules) expect(productIds.has(rule.productId)).toBe(true);
    for (const line of ["home", "villa", "renters", "travel", "pet", "life", "accident"] as const) {
      expect(seed.products.some((product) => product.line === line && product.active)).toBe(true);
    }
    expect(seed.products.filter((product) => product.line === "auto" && product.active)).toHaveLength(3);
  });

  it("uses a unique three-digit policy number on every policy", () => {
    const numbers = seed.policies.map((policy) => policy.number);
    expect(new Set(numbers).size).toBe(numbers.length);
    for (const number of numbers) {
      expect(number).toMatch(/^[1-9]\d{2}$/);
      expect(Number(number)).toBeGreaterThanOrEqual(100);
      expect(Number(number)).toBeLessThanOrEqual(999);
    }
    expect(numbers).toEqual(["105", "142", "207", "318", "426", "531", "640"]);
  });
});
