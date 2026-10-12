import { z } from "zod";
import { PRODUCT_LINES } from "@/lib/backoffice/types";

const limit = z.number().int().min(1).max(10).default(10);
const productLimit = z.number().int().min(1).max(20).default(20);
const customerId = z.string().regex(/^cus_[a-z0-9_-]+$/);
const productId = z.string().regex(/^prd_[a-z0-9_-]+$/);
const claimId = z.string().regex(/^clm_[a-z0-9_-]+$/);

export const searchCustomersInput = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  phoneLast4: z.string().regex(/^\d{4}$/).optional(),
  policyNumber: z.string().trim().min(3).max(48).optional(),
  limit,
}).refine((input) => input.name || input.phoneLast4 || input.policyNumber, {
  message: "Provide a name, phoneLast4, or policyNumber.",
});

export const getCustomerInput = z.object({ customerId });
export const listProductsInput = z.object({
  lineOfBusiness: z.enum(PRODUCT_LINES).optional(),
  state: z.string().trim().length(2).optional(),
  limit: productLimit,
});
export const getProductInput = z.object({ productId });
export const priceIndicationInput = z.object({
  customerId: customerId.optional(),
  productId,
  coverageOptions: z.object({
    factor: z.enum(["standard", "preferred", "highRisk"]).optional(),
  }).optional(),
});
export const searchClaimsInput = z.object({
  customerId: customerId.optional(),
  claimNumber: z.string().trim().min(4).max(32).optional(),
  status: z.enum(["reported", "reviewing", "approved", "closed"]).optional(),
  limit,
}).refine((input) => input.customerId || input.claimNumber, {
  message: "Provide a customerId or claimNumber.",
});
export const getClaimInput = z.object({ claimId, customerId });

// Write tools. Patches stay inside the backoffice field set and are re-validated by the
// backoffice schemas in the service, so sensitive-field rejection applies to MCP too.
const policyId = z.string().regex(/^pol_[a-z0-9_-]+$/);
const pricingRuleId = z.string().regex(/^prc_[a-z0-9_-]+$/);
const requirePatch = { message: "Provide at least one field to change." };
const hasPatch = (input: Record<string, unknown>, ids: string[]) =>
  Object.keys(input).some((key) => !ids.includes(key) && input[key] !== undefined);

export const updateCustomerInput = z.object({
  customerId,
  name: z.string().trim().min(2).max(80).optional(),
  email: z.email().optional(),
  phone: z.string().trim().min(7).max(24).optional(),
  address: z.string().trim().min(4).max(140).optional(),
  status: z.enum(["active", "prospect", "inactive"]).optional(),
}).refine((input) => hasPatch(input, ["customerId"]), requirePatch);
export const updateProductInput = z.object({
  productId,
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().min(4).max(240).optional(),
  coverages: z.array(z.string().trim().min(2)).min(1).optional(),
  deductibles: z.array(z.number().int().positive()).min(1).optional(),
  active: z.boolean().optional(),
}).refine((input) => hasPatch(input, ["productId"]), requirePatch);
export const updatePolicyInput = z.object({
  policyId,
  status: z.enum(["active", "expired", "cancelled"]).optional(),
  coverage: z.string().trim().min(2).optional(),
  deductible: z.number().nonnegative().optional(),
  premium: z.number().positive().optional(),
  effectiveDate: z.iso.date().optional(),
  expirationDate: z.iso.date().optional(),
}).refine((input) => hasPatch(input, ["policyId"]), requirePatch);
export const updatePricingRuleInput = z.object({
  pricingRuleId,
  active: z.boolean().optional(),
  basePremium: z.number().positive().optional(),
  minPremium: z.number().positive().optional(),
  maxPremium: z.number().positive().optional(),
  factors: z.record(z.string(), z.number().positive()).optional(),
}).refine((input) => hasPatch(input, ["pricingRuleId"]), requirePatch);
export const updateClaimInput = z.object({
  claimId,
  customerId,
  status: z.enum(["reported", "reviewing", "approved", "closed"]).optional(),
  owner: z.string().trim().min(2).max(80).optional(),
  reserve: z.number().nonnegative().optional(),
}).refine((input) => hasPatch(input, ["claimId", "customerId"]), requirePatch);
export const reseedInput = z.object({
  confirmation: z.literal("RESEED_DEMO_DATA").describe("Type RESEED_DEMO_DATA to discard every runtime edit."),
  seedId: z.string().trim().min(1).max(40).optional().describe("Seed to load: insurance, support, property, or clinic. Omit to reload the active seed."),
});

export const customerCardSchema = z.object({
  customerId,
  name: z.string(),
  phone: z.string(),
  email: z.string(),
  status: z.enum(["active", "prospect", "inactive"]),
});
export const productCardSchema = z.object({
  productId,
  name: z.string(),
  lineOfBusiness: z.enum(PRODUCT_LINES),
  active: z.boolean(),
  coverages: z.array(z.string()),
});
export const claimCardSchema = z.object({
  claimId,
  claimNumber: z.string(),
  customerId,
  status: z.enum(["reported", "reviewing", "approved", "closed"]),
  type: z.string(),
  lossDate: z.string(),
});
