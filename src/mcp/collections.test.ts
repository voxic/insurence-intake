import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it } from "vitest";
import { activateSeed } from "@/lib/backoffice/repository";
import { updateCollectionRow } from "@/lib/seeds/edit-row";
import { createMcpServer, mcpToolNames } from "./server";
import { listDemoCollections, listDemoRows, searchDemoRows, updateDemoCustomer } from "./service";

const seeds = [
  {
    seed: "insurance",
    people: "customers",
    person: "Ada",
    personId: "cus_ada",
    cases: "claims",
    caseQuery: "26002",
    caseId: "clm_ben",
    ids: ["customers", "policies", "products", "pricingRules", "claims"],
  },
  {
    seed: "support",
    people: "customers",
    person: "Maya",
    personId: "cus_maya",
    cases: "tickets",
    caseQuery: "204",
    caseId: "tkt_maya",
    ids: ["customers", "tickets", "topics"],
  },
  {
    seed: "property",
    people: "residents",
    person: "Jordan",
    personId: "cus_jordan",
    cases: "workOrders",
    caseQuery: "248",
    caseId: "wo_jordan",
    ids: ["residents", "properties", "workOrders", "categories"],
  },
  {
    seed: "clinic",
    people: "patients",
    person: "Avery",
    personId: "cus_avery",
    cases: "appointments",
    caseQuery: "263",
    caseId: "appt_robin",
    ids: ["patients", "appointments", "services", "instructions"],
  },
] as const;

afterEach(async () => {
  await activateSeed("insurance");
});

describe("seed collection MCP tools", () => {
  it("registers the collection tools beside the insurance tools", () => {
    expect(() => createMcpServer()).not.toThrow();
    expect(mcpToolNames).toEqual(expect.arrayContaining(["list_demo_collections", "list_demo_rows", "search_demo_rows"]));
  });

  it.each(seeds)("lists and searches $people and $cases on $seed", async (spec) => {
    await activateSeed(spec.seed);
    const catalog = await listDemoCollections({});
    expect(catalog.seedId).toBe(spec.seed);
    expect(catalog.collections.map((collection) => collection.id)).toEqual([...spec.ids]);
    expect(catalog.collections.find((collection) => collection.id === spec.people)?.searchFields).toEqual(
      expect.arrayContaining(["name", "status"]),
    );
    expect(catalog.collections.find((collection) => collection.id === spec.cases)?.searchFields).toEqual(
      expect.arrayContaining(["number", "status"]),
    );

    const people = await listDemoRows({ collection: spec.people });
    expect(people).toMatchObject({ available: true, seedId: spec.seed, collection: spec.people });
    expect(people.rows.length).toBeGreaterThan(1);
    expect(people.rows.some((row) => row.id === spec.personId)).toBe(true);

    const peopleHit = await searchDemoRows({ collection: spec.people, query: spec.person });
    expect(peopleHit.rows.map((row) => row.id)).toEqual([spec.personId]);
    expect(peopleHit.count).toBeLessThan(people.count);

    const cases = await listDemoRows({ collection: spec.cases });
    expect(cases.rows.some((row) => row.id === spec.caseId)).toBe(true);
    const caseHit = await searchDemoRows({ collection: spec.cases, query: spec.caseQuery });
    expect(caseHit.rows.map((row) => row.id)).toEqual([spec.caseId]);
    expect(caseHit.count).toBeLessThan(cases.count);
  });

  it("lists and searches insurance policies as case records", async () => {
    const policies = await listDemoRows({ collection: "policies" });
    expect(policies.rows.map((row) => row.id)).toContain("pol_ada");
    const hit = await searchDemoRows({ collection: "policies", query: "105" });
    expect(hit.rows.map((row) => row.id)).toEqual(["pol_ada"]);
    expect(hit.count).toBeLessThan(policies.count);
  });

  it("returns a subset when several rows share a status", async () => {
    await activateSeed("support");
    const tickets = await listDemoRows({ collection: "tickets" });
    const open = await searchDemoRows({ collection: "tickets", query: "open" });
    expect(tickets.rows).toHaveLength(4);
    expect(open.rows.map((row) => row.id).sort()).toEqual(["tkt_maya", "tkt_priya"]);
    expect(open.rows.every((row) => row.status === "open")).toBe(true);
    const none = await searchDemoRows({ collection: "tickets", query: "zzzz-not-a-ticket" });
    expect(none).toMatchObject({ available: true, count: 0, rows: [] });
  });

  it("returns a miss and the valid ids instead of inventing rows", async () => {
    const listed = await listDemoRows({ collection: "tickets" });
    const searched = await searchDemoRows({ collection: "tickets", query: "204" });
    expect(listed).toMatchObject({
      available: false,
      seedId: "insurance",
      collection: "tickets",
      rows: [],
      collections: ["customers", "policies", "products", "pricingRules", "claims"],
    });
    expect("collections" in searched ? searched.collections : []).toEqual(
      "collections" in listed ? listed.collections : [],
    );
    expect(searched.rows).toEqual([]);
    expect(JSON.stringify(listed)).not.toContain("tkt_");
    expect(listed.summary).toContain("Valid collection ids");

    await activateSeed("clinic");
    const customers = await searchDemoRows({ collection: "customers", query: "Avery" });
    expect(customers).toMatchObject({
      available: false,
      seedId: "clinic",
      rows: [],
      collections: ["patients", "appointments", "services", "instructions"],
    });
    expect(JSON.stringify(customers)).not.toContain("cus_avery");
    expect(customers.summary).toContain("patients, appointments, services, instructions");
  });

  it("reads a row edited in memory and leaves the seed file alone", async () => {
    await updateDemoCustomer({ customerId: "cus_ada", name: "Ada Runtime" });
    const customers = await listDemoRows({ collection: "customers" });
    expect(customers.rows.find((row) => row.id === "cus_ada")).toMatchObject({ name: "Ada Runtime", status: "active" });

    await activateSeed("support");
    await updateCollectionRow("tickets", "tkt_maya", { status: "waiting", subject: "Runtime edit visible to MCP" });
    const found = await searchDemoRows({ collection: "tickets", query: "Runtime edit visible" });
    expect(found.rows).toEqual([
      expect.objectContaining({ id: "tkt_maya", status: "waiting", subject: "Runtime edit visible to MCP" }),
    ]);
    const onDisk = JSON.parse(readFileSync("data/seeds/support.json", "utf8")) as {
      tickets: Array<{ id: string; subject: string }>;
    };
    expect(onDisk.tickets.find((row) => row.id === "tkt_maya")?.subject).toBe(
      "Wifi keeps dropping after a password change",
    );
  });

  it("rejects an empty collection search", async () => {
    await expect(searchDemoRows({ collection: "customers" })).rejects.toThrow();
    await expect(searchDemoRows({ collection: "customers", query: " " })).rejects.toThrow();
  });
});
