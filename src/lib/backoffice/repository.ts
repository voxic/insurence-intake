import { readFileSync } from "node:fs";
import { backofficeSeedPath } from "@/lib/data-paths";
import { nextClaimStatuses } from "./view-model";
import type { BackofficeState, Claim, ClaimEvent, ClaimStatus, Customer, Policy, PricingRule, Product } from "./types";

// Demo store: one in-memory copy of data/backoffice/seed.json per server process.
// Edits from the backoffice UI, the voice bridge, and MCP all land here and are
// discarded on restart or redeploy; nothing is written back to disk.
// The store hangs off globalThis so Next dev HMR and route bundles share one instance.
const STORE_KEY = Symbol.for("acme.backoffice.store");
type Store = { state: BackofficeState; seededAt: string };
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: Store };

function loadSeed(): BackofficeState {
  return JSON.parse(readFileSync(backofficeSeedPath(), "utf8")) as BackofficeState;
}
function store(): Store {
  const scope = globalThis as GlobalWithStore;
  scope[STORE_KEY] ??= { state: loadSeed(), seededAt: new Date().toISOString() };
  return scope[STORE_KEY];
}

/** Load the seed into memory if it is not there yet. Called at boot and lazily on first read. */
export function ensureSeeded() { return store().seededAt; }
export async function getState() { return store().state; }
function mutate<T>(fn: (state: BackofficeState) => T): Promise<T> { return Promise.resolve(fn(store().state)); }
export const getCustomer = async (id: string) => (await getState()).customers.find((x) => x.id === id);
export const getProduct = async (id: string) => (await getState()).products.find((x) => x.id === id);
export const getClaim = async (id: string) => (await getState()).claims.find((x) => x.id === id);
export const getPolicy = async (id: string) => (await getState()).policies.find((x) => x.id === id);
export const getPricingRule = async (id: string) => (await getState()).pricingRules.find((x) => x.id === id);
export async function createCustomer(customer: Customer) { return mutate((s) => { s.customers.push(customer); return customer; }); }
export async function updateCustomer(id: string, patch: Partial<Customer>) {
  return mutate((s) => { const item = s.customers.find((x) => x.id === id); if (!item) return undefined; Object.assign(item, patch, { updatedAt: new Date().toISOString() }); return item; });
}
export async function createProduct(product: Product) { return mutate((s) => { s.products.push(product); return product; }); }
export async function updateProduct(id: string, patch: Partial<Product>) { return mutate((s) => { const item = s.products.find((x) => x.id === id); if (!item) return undefined; Object.assign(item, patch); return item; }); }
export async function createPolicy(policy: Policy) { return mutate((s) => { s.policies.push(policy); return policy; }); }
export async function updatePolicy(id: string, patch: Partial<Policy>) { return mutate((s) => { const item = s.policies.find((x) => x.id === id); if (!item) return undefined; Object.assign(item, patch); return item; }); }
export async function updatePricingRule(id: string, patch: Partial<PricingRule>) { return mutate((s) => { const item = s.pricingRules.find((x) => x.id === id); if (!item) return undefined; Object.assign(item, patch); return item; }); }
export async function createPricingRule(rule: PricingRule) { return mutate((s) => { s.pricingRules.push(rule); return rule; }); }
export async function createClaim(claim: Claim) { return mutate((s) => { s.claims.push(claim); return claim; }); }
export async function updateClaim(id: string, patch: Partial<Claim>) {
  return mutate((s) => { const item = s.claims.find((x) => x.id === id); if (!item) return undefined; Object.assign(item, patch, { updatedAt: new Date().toISOString() }); return item; });
}
export async function addClaimEvent(claimId: string, event: ClaimEvent) {
  return mutate((s) => { const claim = s.claims.find((x) => x.id === claimId); if (!claim) return undefined; claim.events.push(event); claim.updatedAt = event.timestamp; return claim; });
}
/** Drop every runtime edit and reload data/backoffice/seed.json. */
export async function resetState() { const seed = loadSeed(); const current = store(); current.state = seed; current.seededAt = new Date().toISOString(); return seed; }
export function canTransition(from: ClaimStatus, to: ClaimStatus) { return nextClaimStatuses(from).includes(to); }
