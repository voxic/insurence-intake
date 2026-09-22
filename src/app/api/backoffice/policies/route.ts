import { NextResponse } from "next/server";
import { body, conflict, createId, invalid } from "@/lib/backoffice/http";
import { policyCreateSchema } from "@/lib/backoffice/schemas";
import { createPolicy, getCustomer, getProduct, getState } from "@/lib/backoffice/repository";
export async function GET() { return NextResponse.json({ policies: (await getState()).policies }); }
export async function POST(request: Request) {
  const parsed = policyCreateSchema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error);
  if (!(await getCustomer(parsed.data.customerId)) || !(await getProduct(parsed.data.productId))) return conflict("Customer and product must exist.");
  const policy = await createPolicy({ ...parsed.data, id: createId("pol") }); return NextResponse.json({ policy }, { status: 201 });
}
