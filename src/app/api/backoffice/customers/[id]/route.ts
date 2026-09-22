import { NextResponse } from "next/server";
import { customerPatchSchema, idSchema } from "@/lib/backoffice/schemas";
import { body, invalid, notFound } from "@/lib/backoffice/http";
import { getCustomer, getState, updateCustomer } from "@/lib/backoffice/repository";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) {
  const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const customer = await getCustomer(id); if (!customer) return notFound();
  const state = await getState(); return NextResponse.json({ customer, policies: state.policies.filter((x) => x.customerId === id), claims: state.claims.filter((x) => x.customerId === id) });
}
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const parsed = customerPatchSchema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error);
  const customer = await updateCustomer(id, parsed.data); return customer ? NextResponse.json({ customer }) : notFound();
}
