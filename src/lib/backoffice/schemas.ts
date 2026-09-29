import { z } from "zod";
import { PRODUCT_LINES } from "./types";

export const idSchema = z.string().regex(/^(cus|prd|pol|prc|clm)_[a-z0-9_-]+$/);
const customerStatus = z.enum(["active", "prospect", "inactive"]);
const claimStatus = z.enum(["reported", "reviewing", "approved", "closed"]);

// This demo intentionally stores no sensitive data. Any create/update payload
// carrying one of these keys is rejected before it can reach the JSON store.
export const FORBIDDEN_FIELDS = [
  "ssn",
  "socialSecurityNumber",
  "governmentId",
  "nationalId",
  "passport",
  "driverLicense",
  "dateOfBirth",
  "dob",
  "cardNumber",
  "creditCard",
  "cvv",
  "bankAccount",
  "iban",
  "routingNumber",
  "diagnosis",
  "medicalHistory",
  "healthRecord",
  "password",
  "apiKey",
  "token",
  "secret",
] as const;

export function containsSensitiveClaimContent(value: string) {
  const digits = value.replace(/\D/g, "");
  return (
    /\b\d{3}-?\d{2}-?\d{4}\b/.test(value) ||
    (digits.length >= 13 && digits.length <= 19) ||
    /\b(diagnosis|medical history|health record|credit card|bank account)\b/i.test(value)
  );
}

function forbidSensitiveKeys<T extends z.ZodType>(schema: T): T {
  return schema.superRefine((value, ctx) => {
    if (!value || typeof value !== "object") return;
    for (const key of Object.keys(value)) {
      if ((FORBIDDEN_FIELDS as readonly string[]).includes(key)) {
        ctx.addIssue({
          code: "custom",
          message: `Field "${key}" is not allowed. This demo stores synthetic data only.`,
          path: [key],
        });
      }
    }
  }) as unknown as T;
}

export const customerCreateSchema = forbidSensitiveKeys(
  z
    .object({
      name: z.string().min(2).max(80),
      email: z.email(),
      phone: z.string().min(7).max(24),
      address: z.string().min(4).max(140),
      status: customerStatus.default("prospect"),
    })
    .strict(),
);
export const customerPatchSchema = forbidSensitiveKeys(
  z
    .object({
      name: z.string().min(2).max(80),
      email: z.email(),
      phone: z.string().min(7).max(24),
      address: z.string().min(4).max(140),
      status: customerStatus,
    })
    .strict()
    .partial(),
);
export const productCreateSchema = z
  .object({
    code: z.string().min(3).max(24),
    name: z.string().min(2).max(80),
    line: z.enum(PRODUCT_LINES),
    description: z.string().min(4).max(240),
    coverages: z.array(z.string().min(2)).min(1),
    deductibles: z.array(z.number().int().positive()).min(1),
    active: z.boolean().default(true),
  })
  .strict();
export const productPatchSchema = productCreateSchema.partial();
export const policyCreateSchema = z
  .object({
    customerId: idSchema,
    productId: idSchema,
    number: z.string().min(4).max(32),
    status: z.enum(["active", "expired", "cancelled"]).default("active"),
    effectiveDate: z.iso.date(),
    expirationDate: z.iso.date(),
    coverage: z.string().min(2),
    deductible: z.number().nonnegative(),
    premium: z.number().positive(),
    priceVersion: z.number().int().positive(),
  })
  .strict();
export const pricingRuleSchema = z
  .object({
    productId: idSchema,
    version: z.number().int().positive(),
    active: z.boolean(),
    effectiveDate: z.iso.date(),
    basePremium: z.number().positive(),
    minPremium: z.number().positive(),
    maxPremium: z.number().positive(),
    factors: z.record(z.string(), z.number().positive()),
  })
  .strict()
  .refine((x) => x.maxPremium >= x.minPremium, { message: "Maximum must be at least minimum." });
export const claimCreateSchema = forbidSensitiveKeys(
  z
    .object({
      customerId: idSchema,
      policyId: idSchema,
      lossDate: z.iso.date(),
      type: z.string().min(2).max(80),
      description: z.string().min(4).max(500),
      severity: z.enum(["low", "medium", "high"]),
      owner: z.string().min(2).max(80),
      reserve: z.number().nonnegative(),
    })
    .strict()
    .superRefine((value, ctx) => {
      if (containsSensitiveClaimContent(value.description)) {
        ctx.addIssue({
          code: "custom",
          path: ["description"],
          message: "Claim descriptions cannot contain sensitive data in this synthetic-only demo.",
        });
      }
    }),
);
export const claimPatchSchema = z
  .object({
    status: claimStatus.optional(),
    owner: z.string().min(2).max(80).optional(),
    reserve: z.number().nonnegative().optional(),
    paidAmount: z.number().nonnegative().optional(),
  })
  .strict();
export const claimEventSchema = z
  .object({ note: z.string().min(1).max(500), status: claimStatus.optional() })
  .strict();
export const quoteSchema = z
  .object({
    customerId: idSchema,
    productId: idSchema,
    factor: z.string().min(1).max(40).default("standard"),
  })
  .strict();
