import { z } from "zod";
import {
  canTransition, getActiveSeedId, getCollections, getState, updateClaim, updateCustomer, updatePolicy, updatePricingRule, updateProduct,
} from "@/lib/backoffice/repository";
import {
  claimPatchSchema, customerPatchSchema, FORBIDDEN_FIELDS, policyCreateSchema, pricingRuleSchema, productPatchSchema,
} from "@/lib/backoffice/schemas";
import { getSeedDefinition } from "./registry";
import type { DemoRow, FieldDef } from "./types";

export class DemoDataError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

const blocked = new Set<string>(["__proto__", "constructor", "prototype", "id", ...FORBIDDEN_FIELDS]);

function coerce(field: FieldDef, value: unknown) {
  if (field.type === "checkbox") return Boolean(value);
  if (field.type === "number") return typeof value === "number" ? value : Number(String(value).trim());
  if (field.type === "text-list") {
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  }
  if (field.type === "number-list") {
    const list = Array.isArray(value) ? value : String(value).split(",");
    return list.map((item) => Number(String(item).trim())).filter((item) => !Number.isNaN(item));
  }
  const text = typeof value === "string" ? value.trim() : value;
  if (field.type === "select" && field.options && !field.options.includes(String(text))) {
    throw new DemoDataError(`${field.label} must be one of ${field.options.join(", ")}.`);
  }
  return text;
}

export async function updateCollectionRow(collectionId: string, id: string, patch: Record<string, unknown>) {
  const manifest = getSeedDefinition(getActiveSeedId());
  const collection = manifest?.collections.find((item) => item.id === collectionId);
  if (!collection) return undefined;
  for (const key of Object.keys(patch)) {
    if (blocked.has(key)) throw new DemoDataError(`Field "${key}" is not allowed. This demo stores synthetic data only.`);
  }
  const editable = new Map(collection.fields.filter((field) => field.edit !== false && field.key !== "id").map((field) => [field.key, field]));
  const allowed = Object.fromEntries(Object.entries(patch).filter(([key]) => editable.has(key)));
  if (Object.keys(allowed).length === 0) throw new DemoDataError("Provide at least one editable field.");

  if (getActiveSeedId() === "insurance") {
    if (collectionId === "customers") return updateCustomer(id, customerPatchSchema.parse(allowed));
    if (collectionId === "products") return updateProduct(id, productPatchSchema.parse(allowed));
    if (collectionId === "policies") return updatePolicy(id, policyCreateSchema.partial().parse(allowed));
    if (collectionId === "pricingRules") {
      const current = (await getState()).pricingRules.find((rule) => rule.id === id);
      if (!current) return undefined;
      return updatePricingRule(id, pricingRuleSchema.parse({ ...current, ...allowed }));
    }
    if (collectionId === "claims") {
      const current = (await getState()).claims.find((claim) => claim.id === id);
      if (!current) return undefined;
      const parsed = claimPatchSchema.parse(allowed);
      if (parsed.status && parsed.status !== current.status && !canTransition(current.status, parsed.status)) {
        throw new DemoDataError("This claim status transition is not allowed.", 409);
      }
      return updateClaim(id, parsed);
    }
  }

  const rows = getCollections()[collectionId];
  const row = rows?.find((item) => item.id === id);
  if (!row) return undefined;
  const next: DemoRow = { ...row };
  for (const [key, value] of Object.entries(allowed)) {
    const field = editable.get(key);
    if (!field) continue;
    next[key] = coerce(field, value);
  }
  Object.assign(row, next);
  return row;
}

export function isZodError(error: unknown): error is z.ZodError {
  return error instanceof z.ZodError;
}
