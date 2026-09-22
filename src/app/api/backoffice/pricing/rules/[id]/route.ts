import { NextResponse } from "next/server";
import { body, invalid, notFound } from "@/lib/backoffice/http";
import { idSchema, pricingRuleSchema } from "@/lib/backoffice/schemas";
import { getState, updatePricingRule } from "@/lib/backoffice/repository";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) { const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const rule = (await getState()).pricingRules.find((x) => x.id === id); return rule ? NextResponse.json({ rule }) : notFound(); }
export async function PATCH(request: Request, { params }: Context) { const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const parsed = pricingRuleSchema.partial().safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error); const rule = await updatePricingRule(id, parsed.data); return rule ? NextResponse.json({ rule }) : notFound(); }
