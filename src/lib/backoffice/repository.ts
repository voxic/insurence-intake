import { readFileSync } from "node:fs";
import path from "node:path";
import type { CatalogItem } from "@/lib/live-intake/product-search";
import { getSeedDefinition, listSeeds } from "@/lib/seeds/registry";
import type { DemoProfile, DemoRow, PhoneDefaults } from "@/lib/seeds/types";
import { nextClaimStatuses } from "./view-model";
import type { BackofficeState, Claim, ClaimEvent, ClaimStatus, Customer, Policy, PricingRule, Product } from "./types";

// One in-memory copy of the active seed per process. Edits from the backoffice,
// the voice bridge, and MCP land here and are discarded on restart, reseed, or seed switch.
// The store hangs off globalThis so Next dev HMR and route bundles share one instance.
const STORE_KEY = Symbol.for("acme.backoffice.store.v2");
const DEFAULT_SEED_ID = "insurance";

type Store = {
  seedId: string;
  collections: Record<string, DemoRow[]>;
  phone: PhoneDefaults;
  seededAt: string;
};
type GlobalWithStore = typeof globalThis & { [STORE_KEY]?: Store };

function readCollections(seedId: string) {
  const definition = getSeedDefinition(seedId);
  if (!definition) throw new Error(`Unknown demo seed "${seedId}".`);
  return JSON.parse(readFileSync(path.join(process.cwd(), definition.file), "utf8")) as Record<string, DemoRow[]>;
}

function freshStore(seedId = DEFAULT_SEED_ID): Store {
  const definition = getSeedDefinition(seedId);
  if (!definition) throw new Error(`Unknown demo seed "${seedId}".`);
  return {
    seedId,
    collections: readCollections(seedId),
    phone: { ...definition.phone },
    seededAt: new Date().toISOString(),
  };
}

function store(): Store {
  const scope = globalThis as GlobalWithStore;
  scope[STORE_KEY] ??= freshStore();
  return scope[STORE_KEY];
}

function mutate<T>(fn: (collections: Record<string, DemoRow[]>) => T): Promise<T> {
  return Promise.resolve(fn(store().collections));
}

/** Load the insurance seed into memory if it is not there yet. Called at boot and lazily on first read. */
export function ensureSeeded() { return store().seededAt; }
export function getActiveSeedId() { return store().seedId; }
export function getActiveManifest() {
  const definition = getSeedDefinition(store().seedId);
  if (!definition) throw new Error(`Unknown demo seed "${store().seedId}".`);
  return definition;
}
export function listSeedChoices() {
  return listSeeds().map((seed) => ({ id: seed.id, label: seed.label }));
}
export function getPhoneAppearance(): PhoneDefaults {
  return { ...store().phone };
}
export function getDemoProfile(): DemoProfile {
  const manifest = getActiveManifest();
  return {
    seedId: manifest.id,
    label: manifest.label,
    agentPrompt: manifest.agentPrompt,
    claimProtocol: manifest.claimProtocol === true,
    phone: getPhoneAppearance(),
    seeds: listSeedChoices(),
  };
}
export function getCollections() { return store().collections; }

export async function setPhoneAppearance(patch: { displayName: string; accent: PhoneDefaults["accent"] }) {
  const phone = store().phone;
  phone.displayName = patch.displayName.trim();
  phone.accent = patch.accent;
  return getPhoneAppearance();
}

// Voice tools and MCP still read these five insurance keys. Other seeds leave the missing ones empty.
export async function getState(): Promise<BackofficeState> {
  const collections = store().collections;
  return {
    customers: (collections.customers ?? []) as Customer[],
    products: (collections.products ?? []) as Product[],
    policies: (collections.policies ?? []) as Policy[],
    pricingRules: (collections.pricingRules ?? []) as PricingRule[],
    claims: (collections.claims ?? []) as Claim[],
  };
}

export function collectionCounts() {
  return Object.fromEntries(Object.entries(store().collections).map(([key, rows]) => [key, rows.length]));
}

export function getCatalogRows(): CatalogItem[] {
  const id = getActiveManifest().collections.find((collection) => collection.role === "catalog")?.id;
  if (!id) return [];
  return (store().collections[id] ?? []) as unknown as CatalogItem[];
}

export type LookupRow = {
  id: string;
  number: string;
  customerId: string;
  status: string;
  coverage?: string;
  deductible?: number;
  expirationDate?: string;
  effectiveDate?: string;
  productId?: string;
  subject?: string;
};

export function getLookupRows(): LookupRow[] {
  const id = getActiveManifest().collections.find((collection) => collection.role === "lookup")?.id;
  if (!id) return [];
  return (store().collections[id] ?? []).map((row) => ({
    id: String(row.id),
    number: String(row.number ?? ""),
    customerId: String(row.customerId ?? ""),
    status: String(row.status ?? ""),
    coverage: typeof row.coverage === "string" ? row.coverage : typeof row.subject === "string" ? row.subject : undefined,
    deductible: typeof row.deductible === "number" ? row.deductible : undefined,
    expirationDate: typeof row.expirationDate === "string" ? row.expirationDate : undefined,
    effectiveDate: typeof row.effectiveDate === "string" ? row.effectiveDate : typeof row.openedAt === "string" ? row.openedAt : undefined,
    productId: typeof row.productId === "string" ? row.productId : typeof row.topicId === "string" ? row.topicId : undefined,
    subject: typeof row.subject === "string" ? row.subject : undefined,
  }));
}

/** Drop runtime edits and load a named seed. Phone name and accent return to that seed's defaults. */
export async function activateSeed(seedId: string) {
  const definition = getSeedDefinition(seedId);
  if (!definition) throw new Error(`Unknown demo seed "${seedId}".`);
  const current = store();
  current.seedId = seedId;
  current.collections = readCollections(seedId);
  current.phone = { ...definition.phone };
  current.seededAt = new Date().toISOString();
  return getState();
}

/** Drop every runtime edit and reload the active seed. Boot and a plain reseed stay on insurance. */
export async function resetState() {
  return activateSeed(store().seedId);
}

export const getCustomer = async (id: string) => (await getState()).customers.find((item) => item.id === id);
export const getProduct = async (id: string) => (await getState()).products.find((item) => item.id === id);
export const getClaim = async (id: string) => (await getState()).claims.find((item) => item.id === id);
export const getPolicy = async (id: string) => (await getState()).policies.find((item) => item.id === id);
export const getPricingRule = async (id: string) => (await getState()).pricingRules.find((item) => item.id === id);

export async function createCustomer(customer: Customer) {
  return mutate((collections) => { (collections.customers as Customer[]).push(customer); return customer; });
}
export async function updateCustomer(id: string, patch: Partial<Customer>) {
  return mutate((collections) => {
    const item = (collections.customers as Customer[] | undefined)?.find((row) => row.id === id);
    if (!item) return undefined;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    return item;
  });
}
export async function createProduct(product: Product) {
  return mutate((collections) => { (collections.products as Product[]).push(product); return product; });
}
export async function updateProduct(id: string, patch: Partial<Product>) {
  return mutate((collections) => {
    const item = (collections.products as Product[] | undefined)?.find((row) => row.id === id);
    if (!item) return undefined;
    Object.assign(item, patch);
    return item;
  });
}
export async function createPolicy(policy: Policy) {
  return mutate((collections) => { (collections.policies as Policy[]).push(policy); return policy; });
}
export async function updatePolicy(id: string, patch: Partial<Policy>) {
  return mutate((collections) => {
    const item = (collections.policies as Policy[] | undefined)?.find((row) => row.id === id);
    if (!item) return undefined;
    Object.assign(item, patch);
    return item;
  });
}
export async function updatePricingRule(id: string, patch: Partial<PricingRule>) {
  return mutate((collections) => {
    const item = (collections.pricingRules as PricingRule[] | undefined)?.find((row) => row.id === id);
    if (!item) return undefined;
    Object.assign(item, patch);
    return item;
  });
}
export async function createPricingRule(rule: PricingRule) {
  return mutate((collections) => { (collections.pricingRules as PricingRule[]).push(rule); return rule; });
}
export async function createClaim(claim: Claim) {
  return mutate((collections) => {
    const claims = collections.claims as Claim[] | undefined;
    if (!claims) return claim;
    claims.push(claim);
    return claim;
  });
}
export async function updateClaim(id: string, patch: Partial<Claim>) {
  return mutate((collections) => {
    const item = (collections.claims as Claim[] | undefined)?.find((row) => row.id === id);
    if (!item) return undefined;
    Object.assign(item, patch, { updatedAt: new Date().toISOString() });
    return item;
  });
}
export async function addClaimEvent(claimId: string, event: ClaimEvent) {
  return mutate((collections) => {
    const claim = (collections.claims as Claim[] | undefined)?.find((row) => row.id === claimId);
    if (!claim) return undefined;
    claim.events.push(event);
    claim.updatedAt = event.timestamp;
    return claim;
  });
}
export function canTransition(from: ClaimStatus, to: ClaimStatus) { return nextClaimStatuses(from).includes(to); }
