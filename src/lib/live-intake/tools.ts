import { z } from "zod";
import { createClaim, getState } from "@/lib/backoffice/repository";
import { claimCreateSchema as backofficeClaimCreateSchema } from "@/lib/backoffice/schemas";
import type { Claim, Policy, ProductLine } from "@/lib/backoffice/types";
import { getCustomer, getProduct, listProducts, searchCustomers } from "@/mcp/service";
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
  .object({ policy_number: z.string().trim().min(4).max(32) })
  .strict();
const claimCreateSchema = z
  .object({
    policy_number: z.string().trim().min(4).max(32),
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
  const policy = (await getState()).policies.find(
    (candidate) => candidate.number.toLowerCase() === number.toLowerCase(),
  );
  return policy ? { policy } : null;
}

async function verifyPolicyWithMcp(number: string) {
  const matches = (await searchCustomers({ policyNumber: number, limit: 1 })) as {
    customers: Array<{ customerId: string; name: string }>;
  };
  const customer = matches.customers[0];
  if (!customer) return null;
  const local = await findPolicy(number);
  if (!local) return null;
  const profile = (await getCustomer({ customerId: customer.customerId })) as {
    policies: Array<{ coverage: string; deductible: number; status: string; policyId: string }>;
  };
  const policy = profile.policies.find((item) => item.policyId === local.policy.id);
  if (!policy) return null;
  return { customer: customer.name, policy: local.policy };
}

function linePattern(alternatives: string[]) {
  return new RegExp(`(?:^|[^a-z0-9åäö])(?:${alternatives.join("|")})(?=$|[^a-z0-9åäö])`, "u");
}

// Catalog names and lines are English. Match category language inside the question
// instead of requiring the whole query to be a substring of those fields.
const PRODUCT_LINE_PATTERNS: Array<{ line: ProductLine; pattern: RegExp }> = [
  {
    line: "home",
    pattern: linePattern([
      "hemförsäkr\\w*",
      "villaförsäkr\\w*",
      "boendeförsäkr\\w*",
      "villahem\\w*",
      "homeowners?(?:\\s+insurance)?",
      "home(?:\\s+insurance)?",
      "household(?:\\s+insurance)?",
      "house(?:\\s+insurance)?",
      "dwelling",
      "hem",
      "villa",
    ]),
  },
  {
    line: "auto",
    pattern: linePattern([
      "bilförsäkr\\w*",
      "fordonsförsäkr\\w*",
      "motorfordonsförsäkr\\w*",
      "trafikförsäkr\\w*",
      "helförsäkr\\w*",
      "halvförsäkr\\w*",
      "automobiles?(?:\\s+insurance)?",
      "auto(?:\\s+insurance)?",
      "cars?(?:\\s+insurance)?",
      "vehicles?(?:\\s+insurance)?",
      "collision",
      "comprehensive",
      "bil",
    ]),
  },
  {
    line: "renters",
    pattern: linePattern([
      "hyresförsäkr\\w*",
      "hyresgästförsäkr\\w*",
      "inboendeförsäkr\\w*",
      "renters?(?:\\s+insurance)?",
      "tenants?(?:\\s+insurance)?",
      "contents(?:\\s+insurance)?",
    ]),
  },
  {
    line: "pet",
    pattern: linePattern([
      "husdjursförsäkr\\w*",
      "djurförsäkr\\w*",
      "hundförsäkr\\w*",
      "kattförsäkr\\w*",
      "pets?(?:\\s+(?:insurance|care))?",
    ]),
  },
];

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

function productQueryPlan(query: string) {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return { listAll: true, lines: [] as ProductLine[], tokens: [] as string[] };
  const lines = [
    ...new Set(
      PRODUCT_LINE_PATTERNS.filter(({ pattern }) => pattern.test(trimmed)).map(({ line }) => line),
    ),
  ];
  if (lines.length > 0) return { listAll: false, lines, tokens: [] as string[] };
  const tokens = trimmed
    .split(/[^a-z0-9åäö]+/)
    .filter((token) => token.length >= 3 && !GENERIC_PRODUCT_TOKENS.has(token));
  return { listAll: tokens.length === 0, lines, tokens };
}

function claimFingerprint(input: Omit<z.infer<typeof claimCreateSchema>, "confirmation_id">) {
  return JSON.stringify({
    ...input,
    policy_number: input.policy_number.toLowerCase(),
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
  if (!hasVerifiedPolicy(context.callId, input.policy_number, result.policy.id)) {
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
    const plan = productQueryPlan(query);
    const catalog = (await listProducts({ limit: 10 })) as {
      products: Array<{
        productId: string;
        name: string;
        lineOfBusiness: string;
        active: boolean;
        coverages: string[];
      }>;
    };
    const products = (
      await Promise.all(
        catalog.products
          .filter((product) => product.active)
          .filter((product) => {
            if (plan.listAll) return true;
            if (plan.lines.includes(product.lineOfBusiness as ProductLine)) return true;
            const haystack = [product.name, product.lineOfBusiness, ...product.coverages]
              .join(" ")
              .toLowerCase();
            return plan.tokens.some((token) => haystack.includes(token));
          })
          .slice(0, 10)
          .map((product) => getProduct({ productId: product.productId })),
      )
    ).filter((product): product is NonNullable<typeof product> => Boolean(product));
    return { products, disclaimer: "Demo information only. It is not a quote or binding coverage." };
  }

  if (name === "verify_demo_policy") {
    const parsed = policyVerificationSchema.safeParse(input);
    if (!parsed.success) return { found: false, error: "A policy number is required." };
    const result = await verifyPolicyWithMcp(parsed.data.policy_number);
    if (result && context.callId) {
      recordVerifiedPolicy(context.callId, parsed.data.policy_number, result.policy.id);
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
      !hasVerifiedPolicy(context.callId, parsed.data.policy_number, result.policy.id) ||
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
