import { describe, expect, it } from "vitest";
import { normalizeSpokenPolicyNumber } from "./policy-number";

describe("normalizeSpokenPolicyNumber", () => {
  it("accepts digits, spoken digits, and a natural reading", () => {
    for (const spoken of ["105", "1 0 5", "1-0-5", "one zero five", "one oh five", "one o five", "one hundred five", "one hundred and five"]) {
      expect(normalizeSpokenPolicyNumber(spoken), spoken).toBe("105");
    }
    expect(normalizeSpokenPolicyNumber("one forty two")).toBe("142");
    expect(normalizeSpokenPolicyNumber("two oh seven")).toBe("207");
    expect(normalizeSpokenPolicyNumber("six forty")).toBe("640");
  });

  it("does not require or accept the old ACM prefix", () => {
    expect(normalizeSpokenPolicyNumber("ACM-A-10001")).toBeNull();
    expect(normalizeSpokenPolicyNumber("ACM-H-10005")).toBeNull();
    expect(normalizeSpokenPolicyNumber("ACM-R-10007")).toBeNull();
    expect(normalizeSpokenPolicyNumber("99")).toBeNull();
    expect(normalizeSpokenPolicyNumber("10001")).toBeNull();
    expect(normalizeSpokenPolicyNumber("one five")).toBeNull();
  });
});
