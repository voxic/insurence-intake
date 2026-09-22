import { NextResponse } from "next/server";
import { customerCreateSchema } from "@/lib/backoffice/schemas";
import { body, createId, invalid } from "@/lib/backoffice/http";
import { createCustomer, getState } from "@/lib/backoffice/repository";
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams; const q = params.get("q")?.toLowerCase(); const status = params.get("status");
  let customers = (await getState()).customers;
  if (q) customers = customers.filter((x) => `${x.name} ${x.email}`.toLowerCase().includes(q));
  if (status) customers = customers.filter((x) => x.status === status);
  return NextResponse.json({ customers, total: customers.length });
}
export async function POST(request: Request) {
  const parsed = customerCreateSchema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error);
  const now = new Date().toISOString(); const customer = await createCustomer({ ...parsed.data, id: createId("cus"), createdAt: now, updatedAt: now });
  return NextResponse.json({ customer }, { status: 201 });
}
