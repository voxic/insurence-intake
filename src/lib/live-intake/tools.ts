import { z } from "zod";
import { createClaim, getState } from "@/lib/backoffice/repository";
import type { Claim, Policy } from "@/lib/backoffice/types";
import { getCustomer, getProduct, listProducts, searchCustomers } from "@/mcp/service";
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
    confirmed: z.literal(true),
  })
  .strict();

type ToolResult = Record<string, unknown>;

function policyDetails(policy: Policy, customer: string | null) {
  return {
    policy_number: policy.number,
    status: policy.status,
    coverage: policy.coverage,
    deductible: policy.deductible,
    effective_date: policy.effectiveDate,
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

async function createDemoClaim(input: z.infer<typeof claimCreateSchema>): Promise<ToolResult> {
  const result = await verifyPolicyWithMcp(input.policy_number);
  if (!result) return { created: false, error: "No demo policy was found for that number." };
  if (result.policy.status !== "active") {
    return { created: false, error: "That demo policy is not active and cannot accept a claim." };
  }

  const now = new Date().toISOString();
  const state = await getState();
  const claim: Claim = {
    id: `clm_eve_${crypto.randomUUID()}`,
    number: `CLM-${new Date().getFullYear()}${String(state.claims.length + 1).padStart(3, "0")}`,
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

export async function executeRealtimeTool(name: string, argumentsJson: unknown): Promise<ToolResult> {
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
    return result
      ? { found: true, policy: policyDetails(result.policy, result.customer) }
      : { found: false, error: "No demo policy was found for that number." };
  }

  if (name === "create_confirmed_demo_claim") {
    const parsed = claimCreateSchema.safeParse(input);
    if (!parsed.success) {
      return {
        created: false,
        error: "A claim requires valid details and explicit confirmed: true after the caller confirms.",
      };
    }
    return createDemoClaim(parsed.data);
  }

  return { error: "Unsupported live intake tool." };
}
