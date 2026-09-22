import { NextResponse } from "next/server";
import { body, conflict, createId, invalid } from "@/lib/backoffice/http";
import { pricingRuleSchema } from "@/lib/backoffice/schemas";
import { createPricingRule, getState } from "@/lib/backoffice/repository";
export async function GET() { return NextResponse.json({ rules: (await getState()).pricingRules }); }
export async function POST(request: Request) { const parsed = pricingRuleSchema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error); const state = await getState(); if (state.pricingRules.some((x) => x.productId === parsed.data.productId && x.version === parsed.data.version)) return conflict("Rule version already exists."); const rule = await createPricingRule({ ...parsed.data, id: createId("prc") }); return NextResponse.json({ rule }, { status: 201 }); }
