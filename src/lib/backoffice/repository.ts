import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { BackofficeState, Claim, ClaimEvent, ClaimStatus, Customer, Policy, PricingRule, Product } from "./types";

const DATA_DIR = path.join(process.cwd(), "data", "backoffice");
const SEED_PATH = path.join(DATA_DIR, "seed.json");
const STATE_PATH = path.join(DATA_DIR, "state.json");
let writeQueue = Promise.resolve();

async function readJson(file: string): Promise<BackofficeState> {
  return JSON.parse(await readFile(file, "utf8")) as BackofficeState;
}
async function writeState(state: BackofficeState) {
  await mkdir(DATA_DIR, { recursive: true });
  const temp = `${STATE_PATH}.tmp`;
  await writeFile(temp, JSON.stringify(state, null, 2), "utf8");
  await rename(temp, STATE_PATH);
}
export async function getState() {
  try { return await readJson(STATE_PATH); } catch {
    const seed = await readJson(SEED_PATH);
    await writeState(seed);
    return seed;
  }
}
async function mutate<T>(fn: (state: BackofficeState) => T): Promise<T> {
  let output!: T;
  writeQueue = writeQueue.then(async () => { const state = await getState(); output = fn(state); await writeState(state); });
  await writeQueue;
  return output;
}
export const getCustomer = async (id: string) => (await getState()).customers.find((x) => x.id === id);
export const getProduct = async (id: string) => (await getState()).products.find((x) => x.id === id);
export const getClaim = async (id: string) => (await getState()).claims.find((x) => x.id === id);
export const getPolicy = async (id: string) => (await getState()).policies.find((x) => x.id === id);
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
export async function resetState() { const seed = await readJson(SEED_PATH); await mutate((s) => { Object.assign(s, seed); return s; }); return seed; }
export function canTransition(from: ClaimStatus, to: ClaimStatus) {
  return ({ reported: ["reviewing", "closed"], reviewing: ["approved", "closed"], approved: ["closed"], closed: [] } satisfies Record<ClaimStatus, ClaimStatus[]>)[from].includes(to);
}
