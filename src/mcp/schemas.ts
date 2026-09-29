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
  policyNumber: z.string().trim().min(4).max(32).optional(),
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
