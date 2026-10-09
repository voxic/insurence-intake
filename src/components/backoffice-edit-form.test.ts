import { describe, expect, it } from "vitest";
import { describeError, toPatch, type EditField } from "./backoffice-edit-form";

describe("backoffice edit form", () => {
  it("builds a PATCH body with the types the backoffice schemas expect", () => {
    const fields: EditField[] = [
      { key: "name", label: "Name" },
      { key: "premium", label: "Premium", type: "number" },
      { key: "coverages", label: "Coverages", type: "text-list" },
      { key: "deductibles", label: "Deductibles", type: "number-list" },
      { key: "active", label: "Active", type: "checkbox" },
    ];
    expect(toPatch(fields, { name: " Auto Core ", premium: "1250", coverages: "Liability, Collision,,", deductibles: "250, 500", active: false })).toEqual({
      name: "Auto Core", premium: 1250, coverages: ["Liability", "Collision"], deductibles: [250, 500], active: false,
    });
  });

  it("turns API validation errors into one readable line", () => {
    expect(describeError({ error: "Invalid request.", details: { properties: { email: { errors: ["Invalid email address"] } } } }, 400))
      .toBe("Invalid request. email: Invalid email address");
    expect(describeError({ error: "This claim status transition is not allowed." }, 409)).toBe("This claim status transition is not allowed.");
    expect(describeError(null, 500)).toBe("Save failed (500).");
  });
});
