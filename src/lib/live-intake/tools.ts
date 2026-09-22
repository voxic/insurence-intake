import { z } from "zod";
import { createClaim, getState } from "@/lib/backoffice/repository";
import { claimCreateSchema as backofficeClaimCreateSchema } from "@/lib/backoffice/schemas";
import type { Claim, Policy } from "@/lib/backoffice/types";
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
  .object({ query: z.string().trim().min(2).max(80) })
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
          .filter((product) =>
            [product.name, product.lineOfBusiness, ...product.coverages]
              .join(" ")
              .toLowerCase()
              .includes(query),
          )
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
