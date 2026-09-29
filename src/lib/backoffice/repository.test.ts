import { afterEach, describe, expect, it } from "vitest";
import { canTransition, getState, resetState } from "./repository";

afterEach(async () => { await resetState(); });
describe("backoffice repository", () => {
  it("initializes the fake seeded portfolio", async () => {
    const state = await getState();
    expect(state.customers).toHaveLength(12);
    expect(state.products).toHaveLength(11);
    expect(state.claims).toHaveLength(4);
  });
  it("only permits forward claim workflow transitions", () => {
    expect(canTransition("reported", "reviewing")).toBe(true);
    expect(canTransition("reported", "approved")).toBe(false);
    expect(canTransition("closed", "reviewing")).toBe(false);
  });
});
