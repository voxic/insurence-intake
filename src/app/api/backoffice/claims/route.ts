import { NextResponse } from "next/server";
import { body, conflict, createId, invalid } from "@/lib/backoffice/http";
import { claimCreateSchema } from "@/lib/backoffice/schemas";
import { createClaim, getCustomer, getPolicy, getState } from "@/lib/backoffice/repository";
export async function GET(request: Request) { const status = new URL(request.url).searchParams.get("status"); let claims = (await getState()).claims; if (status) claims = claims.filter((x) => x.status === status); return NextResponse.json({ claims }); }
export async function POST(request: Request) {
  const parsed = claimCreateSchema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error);
  const policy = await getPolicy(parsed.data.policyId); if (!(await getCustomer(parsed.data.customerId)) || !policy || policy.customerId !== parsed.data.customerId) return conflict("Claim customer and policy must match.");
  const now = new Date().toISOString(); const claim = await createClaim({ ...parsed.data, id: createId("clm"), number: `CLM-${new Date().getFullYear()}${String((await getState()).claims.length + 1).padStart(3, "0")}`, reportedDate: now.slice(0, 10), status: "reported", paidAmount: 0, createdAt: now, updatedAt: now, events: [{ id: createId("evt"), timestamp: now, actor: "Demo operator", type: "note", note: "Demo claim created manually." }] });
  return NextResponse.json({ claim }, { status: 201 });
}
