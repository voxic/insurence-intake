import { afterEach, describe, expect, it } from "vitest";
import seed from "../../../data/backoffice/seed.json";
import { canTransition, ensureSeeded, getPolicy, getProduct, getState, resetState, updateCustomer, updatePolicy, updateProduct } from "./repository";

afterEach(async () => { await resetState(); });
describe("backoffice repository", () => {
  it("seeds memory from data/backoffice/seed.json on boot", async () => {
    expect(ensureSeeded()).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    const state = await getState();
    expect(state).toEqual(seed);
    expect(state.customers).toHaveLength(12);
    expect(state.products).toHaveLength(10);
    expect(state.claims).toHaveLength(4);
  });
  it("keeps an edit in memory and reads it back on the next call", async () => {
    await updatePolicy("pol_ada", { coverage: "Liability only", premium: 999 });
    expect(await getPolicy("pol_ada")).toMatchObject({ coverage: "Liability only", premium: 999, number: "105" });
    await updateProduct("prd_auto", { description: "Edited in the backoffice." });
    expect((await getProduct("prd_auto"))?.description).toBe("Edited in the backoffice.");
    expect((await getState()).policies.find((x) => x.id === "pol_ada")?.premium).toBe(999);
  });
  it("returns undefined for unknown ids without touching the store", async () => {
    expect(await updateCustomer("cus_missing", { status: "inactive" })).toBeUndefined();
    expect(await getState()).toEqual(seed);
  });
  it("reseeds back to the committed seed, discarding every runtime edit", async () => {
    await updatePolicy("pol_ada", { status: "cancelled" });
    await updateCustomer("cus_ada", { name: "Edited Name" });
    const restored = await resetState();
    expect(restored).toEqual(seed);
    expect(await getState()).toEqual(seed);
    expect((await getPolicy("pol_ada"))?.status).toBe("active");
  });
  it("only permits forward claim workflow transitions", () => {
    expect(canTransition("reported", "reviewing")).toBe(true);
    expect(canTransition("reported", "approved")).toBe(false);
    expect(canTransition("closed", "reviewing")).toBe(false);
  });
});
