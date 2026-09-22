import { describe, expect, it } from "vitest";
import {
  FORBIDDEN_FIELDS,
  claimCreateSchema,
  customerCreateSchema,
  customerPatchSchema,
} from "./schemas";

const validCustomer = {
  name: "Ada Hart",
  email: "ada.hart@example.com",
  phone: "555-0101",
  address: "14 Fictional Lane, Testville",
  status: "active" as const,
};

describe("backoffice sensitive-data guards", () => {
  it("accepts a synthetic customer without identity fields", () => {
    const parsed = customerCreateSchema.safeParse(validCustomer);
    expect(parsed.success).toBe(true);
  });

  it("rejects every forbidden sensitive field on create", () => {
    for (const field of FORBIDDEN_FIELDS) {
      const parsed = customerCreateSchema.safeParse({ ...validCustomer, [field]: "x" });
      expect(parsed.success, `expected "${field}" to be rejected`).toBe(false);
    }
  });

  it("rejects forbidden fields on update as well", () => {
    expect(customerPatchSchema.safeParse({ dateOfBirth: "1990-01-01" }).success).toBe(false);
    expect(customerPatchSchema.safeParse({ ssn: "123-45-6789" }).success).toBe(false);
  });

  it("rejects unknown fields that are not part of the record", () => {
    expect(customerCreateSchema.safeParse({ ...validCustomer, nickname: "Adie" }).success).toBe(
      false,
    );
  });

  it("rejects sensitive fields smuggled into a claim", () => {
    const parsed = claimCreateSchema.safeParse({
      customerId: "cus_ada",
      policyId: "pol_ada",
      lossDate: "2026-03-15",
      type: "Windshield",
      description: "Fictional chip",
      severity: "low",
      owner: "M. Vega",
      reserve: 100,
      diagnosis: "none",
    });
    expect(parsed.success).toBe(false);
  });
});
