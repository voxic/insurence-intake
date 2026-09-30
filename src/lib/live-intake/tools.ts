import { z } from "zod";
import { createClaim, getState } from "@/lib/backoffice/repository";
import { claimCreateSchema as backofficeClaimCreateSchema } from "@/lib/backoffice/schemas";
import type { Claim, Policy, Product } from "@/lib/backoffice/types";
import { normalizeSpokenPolicyNumber } from "@/lib/policy-number";
import { getCustomer, searchCustomers } from "@/mcp/service";
import { maskNumber } from "@/mcp/redaction";
import {
  consumeConfirmation,
  hasVerifiedPolicy,
  recordConfirmation,
  recordVerifiedPolicy,
} from "./call-state";
export { REALTIME_TOOLS } from "./tool-contracts";

const productLookupSchema = z
  .object({ query: z.string().trim().max(80).optional().default("") })
  .strict();
const policyVerificationSchema = z
  .object({ policy_number: z.string().trim().min(3).max(48) })
  .strict();
const claimCreateSchema = z
  .object({
    policy_number: z.string().trim().min(3).max(48),
    loss_date: z.iso.date(),
    claim_type: z.string().trim().min(2).max(80),
    description: z.string().trim().min(4).max(500),
    severity: z.enum(["low", "medium", "high"]),
    confirmation_id: z.string().uuid(),
  })
  .strict();

type ToolResult = Record<string, unknown>;
type ToolContext = { callId: string | null };

function policyDetails(policy: Policy, customer: string | null) {
  return {
    policy_number: maskNumber(policy.number),
    status: policy.status,
    coverage: policy.coverage,
    deductible: policy.deductible,
    expiration_date: policy.expirationDate,
    customer,
  };
}

async function findPolicy(number: string) {
  const canonical = normalizeSpokenPolicyNumber(number);
  if (!canonical) return null;
  const policy = (await getState()).policies.find(
    (candidate) => normalizeSpokenPolicyNumber(candidate.number) === canonical,
  );
  return policy ? { policy } : null;
}

async function verifyPolicyWithMcp(number: string) {
  const canonical = normalizeSpokenPolicyNumber(number);
  if (!canonical) return null;
  const matches = (await searchCustomers({ policyNumber: canonical, limit: 1 })) as {
    customers: Array<{ customerId: string; name: string }>;
  };
  const customer = matches.customers[0];
  if (!customer) return null;
  const local = await findPolicy(canonical);
  if (!local) return null;
  const profile = (await getCustomer({ customerId: customer.customerId })) as {
    policies: Array<{ coverage: string; deductible: number; status: string; policyId: string }>;
  };
  const policy = profile.policies.find((item) => item.policyId === local.policy.id);
  if (!policy) return null;
  return { customer: customer.name, policy: local.policy };
}

// Filler around a catalog question. Category words live on each product in the seed.
const GENERIC_PRODUCT_TOKENS = new Set([
  "a",
  "acme",
  "all",
  "alla",
  "an",
  "any",
  "are",
  "av",
  "available",
  "catalog",
  "catalogue",
  "demo",
  "det",
  "do",
  "en",
  "era",
  "ett",
  "exist",
  "exists",
  "finns",
  "for",
  "för",
  "försäkring",
  "försäkringar",
  "försäkringstyp",
  "försäkringstyper",
  "har",
  "have",
  "insurance",
  "is",
  "just",
  "katalog",
  "kind",
  "kinds",
  "list",
  "lista",
  "ni",
  "now",
  "nu",
  "och",
  "of",
  "olika",
  "our",
  "product",
  "products",
  "produkt",
  "produkter",
  "som",
  "specific",
  "specifika",
  "the",
  "there",
  "typ",
  "type",
  "types",
  "typer",
  "vad",
  "vilka",
  "vilken",
  "vilket",
  "våra",
  "what",
  "which",
  "you",
  "your",
]);

function catalogPhrases(product: Product) {
  return [product.name, product.line, ...product.coverages, ...(product.aliases?.en ?? []), ...(product.aliases?.sv ?? [])]
    .map((value) => value.trim().toLowerCase())
    .filter((value) => value.length >= 3);
}

function includesPhrase(query: string, phrase: string) {
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(?:^|[^a-z0-9åäö])${escaped}(?=$|[^a-z0-9åäö])`, "u").test(query);
}

function isGenericCatalogQuery(query: string) {
  const tokens = query.toLowerCase().split(/[^a-z0-9åäö]+/).filter(Boolean);
  return tokens.length === 0 || tokens.every((token) => GENERIC_PRODUCT_TOKENS.has(token));
}

function matchingProducts(products: Product[], query: string) {
  if (isGenericCatalogQuery(query)) return products;
  const hits = products
    .map((product) => ({
      product,
      phrases: catalogPhrases(product).filter((phrase) => includesPhrase(query, phrase)),
    }))
    .filter((hit) => hit.phrases.length > 0);
  const longest = Math.max(0, ...hits.flatMap((hit) => hit.phrases.map((phrase) => phrase.length)));
  return hits
    .filter((hit) => hit.phrases.some((phrase) => phrase.length === longest))
    .map((hit) => hit.product);
}

function spokenSwedishName(product: Product) {
  const aliases = product.aliases?.sv ?? [];
  return aliases.find((alias) => alias.toLowerCase().includes("försäkring")) ?? aliases[0] ?? product.name;
}

function toCallerProduct(product: Product) {
  return {
    name: product.name,
    swedish_name: spokenSwedishName(product),
    line: product.line,
    description: product.description,
    coverages: product.coverages,
    deductibles: product.deductibles,
    ...(product.priceRange ? { annual_price_range: product.priceRange } : {}),
  };
}

function claimFingerprint(input: Omit<z.infer<typeof claimCreateSchema>, "confirmation_id">) {
  return JSON.stringify({
    ...input,
    policy_number: normalizeSpokenPolicyNumber(input.policy_number) ?? input.policy_number.toLowerCase(),
    description: input.description.trim(),
  });
}

function isLossDateCovered(policy: Policy, lossDate: string) {
  return lossDate >= policy.effectiveDate && lossDate <= policy.expirationDate;
}

function hasSafeClaimDetails(
  policy: Policy,
  input: Omit<z.infer<typeof claimCreateSchema>, "confirmation_id">,
) {
  return backofficeClaimCreateSchema.safeParse({
    customerId: policy.customerId,
    policyId: policy.id,
    lossDate: input.loss_date,
    type: input.claim_type,
    description: input.description,
    severity: input.severity,
    owner: "Unassigned",
    reserve: 0,
  }).success;
}

async function createDemoClaim(
  input: z.infer<typeof claimCreateSchema>,
  context: ToolContext,
): Promise<ToolResult> {
  const { confirmation_id: confirmationId, ...confirmationInput } = input;
  if (!context.callId) {
    return { created: false, error: "A live call session is required to create a demo claim." };
  }
  const result = await verifyPolicyWithMcp(input.policy_number);
  if (!result) return { created: false, error: "No demo policy was found for that number." };
  if (result.policy.status !== "active") {
    return { created: false, error: "That demo policy is not active and cannot accept a claim." };
  }
  if (!hasVerifiedPolicy(context.callId, result.policy.number, result.policy.id)) {
    return { created: false, error: "Verify this policy in the current live call before creating a claim." };
  }
  if (!isLossDateCovered(result.policy, input.loss_date)) {
    return { created: false, error: "The loss date must fall within the active policy period." };
  }
  if (!hasSafeClaimDetails(result.policy, confirmationInput)) {
    return { created: false, error: "Claim details must contain synthetic, non-sensitive data only." };
  }
  if (!consumeConfirmation(context.callId, confirmationId, claimFingerprint(confirmationInput))) {
    return {
      created: false,
      error: "Explicit confirmation for these claim details is required in the current live call.",
    };
  }

  const now = new Date().toISOString();
  const claim: Claim = {
    id: `clm_eve_${crypto.randomUUID()}`,
    number: `CLM-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`,
    customerId: result.policy.customerId,
    policyId: result.policy.id,
    lossDate: input.loss_date,
    reportedDate: now.slice(0, 10),
    type: input.claim_type,
    description: input.description,
    severity: input.severity,
    status: "reported",
    owner: "Unassigned",
    reserve: 0,
    paidAmount: 0,
    createdAt: now,
    updatedAt: now,
    events: [
      {
        id: `evt_eve_${crypto.randomUUID()}`,
        timestamp: now,
        actor: "Eve (demo intake)",
        type: "note",
        note: "Demo claim created after explicit caller confirmation.",
      },
    ],
  };
  const created = await createClaim(claim);
  return {
    created: true,
    claim_number: created.number,
    status: created.status,
    policy: policyDetails(result.policy, result.customer),
  };
}

export async function executeRealtimeTool(
  name: string,
  argumentsJson: unknown,
  context: ToolContext = { callId: null },
): Promise<ToolResult> {
  let input: unknown = argumentsJson;
  if (typeof argumentsJson === "string") {
    try {
      input = JSON.parse(argumentsJson);
    } catch {
      return { error: "Tool arguments must be valid JSON." };
    }
  }

  if (name === "lookup_demo_product") {
    const parsed = productLookupSchema.safeParse(input);
    if (!parsed.success) return { error: "A product search query is required." };
    const query = parsed.data.query.toLowerCase();
    const catalog = (await getState()).products.filter((product) => product.active);
    const matches = matchingProducts(catalog, query)
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 20)
      .map(toCallerProduct);
    return {
      products: matches,
      disclaimer: "Demo information only. Annual ranges are not a quote or binding coverage.",
    };
  }

  if (name === "verify_demo_policy") {
    const parsed = policyVerificationSchema.safeParse(input);
    if (!parsed.success) return { found: false, error: "A policy number is required." };
    const result = await verifyPolicyWithMcp(parsed.data.policy_number);
    if (result && context.callId) {
      recordVerifiedPolicy(context.callId, result.policy.number, result.policy.id);
    }
    return result
      ? { found: true, policy: policyDetails(result.policy, result.customer) }
      : { found: false, error: "No demo policy was found for that number." };
  }

  if (name === "confirm_demo_claim") {
    const parsed = claimCreateSchema.omit({ confirmation_id: true }).safeParse(input);
    if (!parsed.success || !context.callId) {
      return {
        confirmed: false,
        error: "A verified live call and complete non-sensitive claim details are required.",
      };
    }
    const result = await verifyPolicyWithMcp(parsed.data.policy_number);
    if (
      !result ||
      result.policy.status !== "active" ||
      !hasVerifiedPolicy(context.callId, result.policy.number, result.policy.id) ||
      !isLossDateCovered(result.policy, parsed.data.loss_date) ||
      !hasSafeClaimDetails(result.policy, parsed.data)
    ) {
      return { confirmed: false, error: "Verify an active policy and valid loss date in this call first." };
    }
    const confirmationId = recordConfirmation(context.callId, claimFingerprint(parsed.data));
    return confirmationId
      ? { confirmed: true, confirmation_id: confirmationId }
      : { confirmed: false, error: "The live call session has expired." };
  }

  if (name === "create_confirmed_demo_claim") {
    const parsed = claimCreateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        created: false,
        error: "A claim requires a server-issued confirmation after the caller explicitly confirms.",
      };
    }
    return createDemoClaim(parsed.data, context);
  }

  return { error: "Unsupported live intake tool." };
}
