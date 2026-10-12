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

function names(result: { products?: unknown }) {
  return (result.products as Array<{ name: string }>).map((item) => item.name);
}

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
    const property = await reseedDemoData({ confirmation: "RESEED_DEMO_DATA", seedId: "property" });
    expect(property).toMatchObject({ reseeded: true, seedId: "property", counts: { customers: 5, residents: 5, properties: 5, workOrders: 5, categories: 5, products: 0 } });
    const clinic = await reseedDemoData({ confirmation: "RESEED_DEMO_DATA", seedId: "clinic" });
    expect(clinic).toMatchObject({ reseeded: true, seedId: "clinic", counts: { customers: 5, patients: 5, appointments: 5, services: 5, instructions: 5, products: 0 } });
    const insurance = await reseedDemoData({ confirmation: "RESEED_DEMO_DATA", seedId: "insurance" });
    expect(insurance).toMatchObject({ reseeded: true, seedId: "insurance", counts: { customers: 12, products: 10, policies: 7, pricingRules: 10, claims: 4 } });
  });

  it("switches through property and clinic, changing collections, prompts, and phone defaults", async () => {
    await updateCustomer("cus_ada", { name: "Edited Name" });
    await activateSeed("property");
    expect((await getState()).customers.some((customer) => customer.id === "cus_ada")).toBe(false);
    expect(getCollections().residents).toHaveLength(5);
    expect(getCollections().properties).toHaveLength(5);
    expect(getCollections().workOrders.map((row) => row.number)).toEqual(expect.arrayContaining(["248", "112", "361", "475", "590"]));
    expect(getCollections().categories).toHaveLength(5);
    expect(getDemoProfile().agentPrompt).toContain("Harborline");
    expect(getDemoProfile().agentPrompt).toContain("emergency services");
    expect(getDemoProfile().agentPrompt).not.toContain("Acme Insurance");
    expect(getDemoProfile().claimProtocol).toBe(false);
    expect(getPhoneAppearance()).toMatchObject({ displayName: "Harborline Dispatch", subtitle: "Maintenance dispatch", accent: "coral" });
    expect(getDemoProfile().seeds.map((seed) => seed.id)).toEqual(["insurance", "support", "property", "clinic"]);
    expect(getDemoProfile().seeds.find((seed) => seed.id === "property")).toMatchObject({
      summary: expect.stringContaining("Maintenance dispatch"),
      backoffice: expect.stringContaining("work orders"),
    });

    const edited = await updateCollectionRow("workOrders", "wo_jordan", { status: "scheduled", subject: "Kitchen sink leak, demo slot moved" });
    expect(edited).toMatchObject({ status: "scheduled", subject: "Kitchen sink leak, demo slot moved" });

    await activateSeed("clinic");
    expect(getCollections().workOrders).toBeUndefined();
    expect(getCollections().patients).toHaveLength(5);
    expect(getCollections().appointments).toHaveLength(5);
    expect(getCollections().services).toHaveLength(5);
    expect(getCollections().instructions).toHaveLength(5);
    expect(getDemoProfile().agentPrompt).toContain("Willow Clinic");
    expect(getDemoProfile().agentPrompt).toContain("not medical advice");
    expect(getDemoProfile().agentPrompt).toContain("emergency services");
    expect(getPhoneAppearance()).toMatchObject({ displayName: "Willow Clinic", subtitle: "Appointment intake", accent: "indigo" });
    expect(getDemoProfile().seeds.find((seed) => seed.id === "clinic")?.backoffice).toContain("care instructions");

    applyDemoProfile(getDemoProfile());
    expect(loadInstructions()).toContain("appointment intake clerk");
    expect(loadClaimProtocol()).toBe(false);
    const session = buildSessionUpdate(loadInstructions(), { claimProtocol: loadClaimProtocol() });
    expect(session.session.instructions).not.toContain("create_confirmed_demo_claim");

    await activateSeed("insurance");
    expect((await getState()).customers.find((customer) => customer.id === "cus_ada")?.name).toBe("Ada Hart");
  });

  it("resolves property and clinic questions in English and Swedish", async () => {
    await activateSeed("property");
    const propertyCases: Array<[string, string]> = [
      ["The kitchen sink won't stop leaking", "Plumbing leak"],
      ["Det läcker vatten under diskbänken", "Plumbing leak"],
      ["There's no heat in the apartment", "No heat"],
      ["Det är ingen värme i lägenheten", "No heat"],
      ["Elementen är kalla", "No heat"],
      ["Our elevator is stuck between floors", "Elevator outage"],
      ["Hissen har fastnat", "Elevator outage"],
      ["The fridge stopped cooling", "Appliance repair"],
      ["Kylskåpet fungerar inte", "Appliance repair"],
      ["We have mice in the basement", "Pest visit"],
      ["Vi har möss i källaren", "Pest visit"],
    ];
    for (const [query, name] of propertyCases) {
      const result = await executeRealtimeTool("lookup_demo_product", { query });
      expect(names(result), query).toEqual([name]);
    }
    const workOrder = await executeRealtimeTool("verify_demo_policy", { policy_number: "248" });
    expect(workOrder).toMatchObject({ found: true, policy: expect.objectContaining({ customer: "Jordan H.", status: "open" }) });

    await activateSeed("clinic");
    const clinicCases: Array<[string, string]> = [
      ["I need to book a blood test", "Blood draw"],
      ["jag vill boka ett blodprov", "Blood draw"],
      ["Do I need to fast before the blood test", "Fasting before a blood draw"],
      ["måste jag fasta inför blodprovet", "Fasting before a blood draw"],
      ["I need an x-ray", "Imaging visit"],
      ["How do I prepare for the x-ray", "Preparing for an x-ray"],
      ["hur förbereder jag mig för röntgen", "Preparing for an x-ray"],
      ["Can I get a flu shot today", "Vaccination"],
      ["jag behöver en vaccination", "Vaccination"],
      ["I need a sick visit for a sore throat", "Sick visit"],
      ["jag har ont i halsen", "Sick visit"],
      ["I'd like an annual physical", "Annual physical"],
      ["jag vill boka en hälsokontroll", "Annual physical"],
      ["what should I expect at a physical", "What to expect at a physical"],
      ["vad gäller inför hälsokontroll", "What to expect at a physical"],
    ];
    for (const [query, name] of clinicCases) {
      const result = await executeRealtimeTool("lookup_demo_product", { query });
      expect(names(result), query).toEqual([name]);
    }
    const appointment = await executeRealtimeTool("verify_demo_policy", { policy_number: "two sixty three" });
    expect(appointment).toMatchObject({ found: true, policy: expect.objectContaining({ customer: "Robin H.", status: "arrived" }) });
  });

  it("styles every accent preset on the phone screen", () => {
    const css = readFileSync("src/app/globals.css", "utf8");
    for (const accent of ACCENTS) {
      expect(css).toContain(`[data-accent="${accent}"]`);
    }
    expect(css).toContain("var(--phone-accent)");
  });
});
