import { describe, expect, it } from "vitest";
import { needsDemoLogin } from "./demo-gate";

describe("needsDemoLogin", () => {
  it("stays open for local dev when the public session secret is unset", () => {
    expect(needsDemoLogin({})).toBe(false);
    expect(needsDemoLogin({ accessTokenRequired: false, demoPasswordRequired: true })).toBe(false);
    expect(needsDemoLogin({ accessTokenRequired: true, demoPasswordRequired: false })).toBe(false);
  });

  it("asks a first-time visitor on a gated host", () => {
    expect(
      needsDemoLogin({ accessTokenRequired: true, demoPasswordRequired: true, demoSessionActive: false }),
    ).toBe(true);
    expect(needsDemoLogin({ accessTokenRequired: true, demoPasswordRequired: true })).toBe(true);
  });

  it("does not ask again while the demo-session cookie is valid", () => {
    expect(
      needsDemoLogin({ accessTokenRequired: true, demoPasswordRequired: true, demoSessionActive: true }),
    ).toBe(false);
  });
});
