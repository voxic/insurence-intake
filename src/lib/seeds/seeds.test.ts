import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { applyDemoProfile, loadClaimProtocol, loadInstructions } from "@/lib/agent-settings";
import {
  activateSeed, getActiveSeedId, getCatalogRows, getCollections, getDemoProfile, getPhoneAppearance, getState, setPhoneAppearance, updateCustomer,
} from "@/lib/backoffice/repository";
import { executeRealtimeTool } from "@/lib/live-intake/tools";
import { buildSessionUpdate, INTAKE_INSTRUCTIONS } from "@/lib/session";
import { reseedDemoData } from "@/mcp/service";
import { updateCollectionRow } from "./edit-row";
import { ACCENTS } from "./types";

afterEach(async () => {
  await activateSeed("insurance");
  applyDemoProfile({ seedId: "insurance", agentPrompt: INTAKE_INSTRUCTIONS, claimProtocol: true });
});

describe("demo seeds", () => {
  it("boots the insurance seed with aliases and no inactive products", async () => {
    const state = await getState();
    expect(getActiveSeedId()).toBe("insurance");
    expect(state.customers).toHaveLength(12);
    expect(state.products).toHaveLength(10);
    expect(state.policies).toHaveLength(7);
    expect(state.pricingRules).toHaveLength(10);
    expect(state.claims).toHaveLength(4);
    expect(state.products.every((product) => product.active)).toBe(true);
    expect(state.products.find((product) => product.id === "prd_pet_plus")?.aliases?.en).toContain("cat");
    expect(getDemoProfile().agentPrompt).toContain("Acme Insurance");
    expect(getPhoneAppearance()).toMatchObject({ displayName: "Acme Insurance", accent: "teal" });
  });

  it("switches to support, then back, and changes the prompt", async () => {
    await updateCustomer("cus_ada", { name: "Edited Name" });
    await activateSeed("support");
    const support = await getState();
    expect(support.customers.some((customer) => customer.id === "cus_ada")).toBe(false);
    expect(support.products).toHaveLength(0);
    expect(support.policies).toHaveLength(0);
    expect(support.claims).toHaveLength(0);
    expect(getCollections().customers.map((row) => row.name)).toContain("Maya Chen");
    expect(getCollections().tickets.map((row) => row.number)).toContain("204");
    expect(getCollections().topics.map((row) => row.name)).toContain("Wifi password reset");
    expect(getDemoProfile().agentPrompt).toContain("Northstar Services");
    expect(getDemoProfile().agentPrompt).not.toContain("Acme Insurance");
    expect(getPhoneAppearance()).toMatchObject({ displayName: "Northstar Support", accent: "amber" });

    applyDemoProfile(getDemoProfile());
    expect(loadInstructions()).toContain("customer support agent");
    expect(loadClaimProtocol()).toBe(false);
    const session = buildSessionUpdate(loadInstructions(), { claimProtocol: loadClaimProtocol() });
    expect(session.session.instructions).not.toContain("create_confirmed_demo_claim");
    expect(session.session.instructions).toContain("Northstar Services");

    await activateSeed("insurance");
    expect((await getState()).customers.find((customer) => customer.id === "cus_ada")?.name).toBe("Ada Hart");
    expect(getDemoProfile().agentPrompt).toContain("Acme Insurance");
    const cat = await executeRealtimeTool("lookup_demo_product", { query: "insurance for a cat" });
    expect(cat.products).toEqual([expect.objectContaining({ name: "Pet Plus" })]);
  });

  it("keeps a manual phone name and accent until the next seed switch", async () => {
    await setPhoneAppearance({ displayName: "Harbor Desk", accent: "coral" });
    expect(getPhoneAppearance()).toMatchObject({ displayName: "Harbor Desk", accent: "coral", subtitle: "Call-center intake" });
    await activateSeed("support");
    expect(getPhoneAppearance().displayName).toBe("Northstar Support");
    expect(getPhoneAppearance().accent).toBe("amber");
  });

  it("writes a support ticket edit into memory until the seed is reloaded", async () => {
    await activateSeed("support");
    const updated = await updateCollectionRow("tickets", "tkt_maya", { status: "waiting", subject: "Wifi password reset follow-up" });
    expect(updated).toMatchObject({ status: "waiting", subject: "Wifi password reset follow-up" });
    await activateSeed("insurance");
    const edited = await updateCollectionRow("customers", "cus_ada", { name: "Ada Edited" });
    expect(edited).toMatchObject({ name: "Ada Edited" });
    expect((await getState()).customers.find((customer) => customer.id === "cus_ada")?.name).toBe("Ada Edited");
  });

  it("finds a support topic and a ticket number from the active seed", async () => {
    await activateSeed("support");
    const topic = await executeRealtimeTool("lookup_demo_product", { query: "wifi" });
    expect(topic.products).toEqual([expect.objectContaining({ name: "Wifi password reset" })]);
    const ticket = await executeRealtimeTool("verify_demo_policy", { policy_number: "204" });
    expect(ticket).toMatchObject({ found: true, policy: expect.objectContaining({ customer: "Maya C." }) });
    expect(getCatalogRows().every((item) => item.active !== false)).toBe(true);
  });

  it("lets MCP switch to a named seed and reseed", async () => {
    await expect(reseedDemoData({ confirmation: "RESEED_DEMO_DATA", seedId: "nope" })).rejects.toThrow(/Unknown demo seed/);
    const switched = await reseedDemoData({ confirmation: "RESEED_DEMO_DATA", seedId: "support" });
    expect(switched).toMatchObject({ reseeded: true, seedId: "support", counts: { customers: 5, topics: 4, tickets: 4, products: 0 } });
    expect((await getState()).customers.some((customer) => customer.name === "Ada Hart")).toBe(false);
    const reloaded = await reseedDemoData({ confirmation: "RESEED_DEMO_DATA" });
    expect(reloaded).toMatchObject({ reseeded: true, seedId: "support", counts: { topics: 4 } });
    const insurance = await reseedDemoData({ confirmation: "RESEED_DEMO_DATA", seedId: "insurance" });
    expect(insurance).toMatchObject({ reseeded: true, seedId: "insurance", counts: { customers: 12, products: 10, policies: 7, pricingRules: 10, claims: 4 } });
  });

  it("styles every accent preset on the phone screen", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    for (const accent of ACCENTS) {
      expect(css).toContain(`[data-accent="${accent}"]`);
    }
    expect(css).toContain("var(--phone-accent)");
  });
});
