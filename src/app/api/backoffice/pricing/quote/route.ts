import { NextResponse } from "next/server";
import { body, conflict, invalid, notFound } from "@/lib/backoffice/http";
import { quoteSchema } from "@/lib/backoffice/schemas";
import { getCustomer, getProduct, getState } from "@/lib/backoffice/repository";
export async function POST(request: Request) {
  const parsed = quoteSchema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error);
  const { customerId, productId, factor } = parsed.data;
  if (!(await getCustomer(customerId)) || !(await getProduct(productId))) return notFound();
  const rule = (await getState()).pricingRules.find((x) => x.productId === productId && x.active); if (!rule) return conflict("No active price indication is available.");
  const multiplier = rule.factors[factor]; if (!multiplier) return invalid(quoteSchema.safeParse({ ...parsed.data, factor: "" }).error!);
  const rawPremium = rule.basePremium * multiplier; const premium = Math.min(rule.maxPremium, Math.max(rule.minPremium, rawPremium));
  return NextResponse.json({ indication: true, premium, ruleVersion: rule.version, breakdown: [{ label: "Base premium", amount: rule.basePremium }, { label: `${factor} factor`, multiplier }, { label: "Bounded annual indication", amount: premium }] });
}
