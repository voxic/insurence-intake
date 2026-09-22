import { NextResponse } from "next/server";
import { body, conflict, createId, invalid, notFound } from "@/lib/backoffice/http";
import { claimEventSchema, idSchema } from "@/lib/backoffice/schemas";
import { addClaimEvent, canTransition, getClaim, updateClaim } from "@/lib/backoffice/repository";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, { params }: Context) {
  const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const claim = await getClaim(id); if (!claim) return notFound();
  const parsed = claimEventSchema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.status && parsed.data.status !== claim.status && !canTransition(claim.status, parsed.data.status)) return conflict("This claim status transition is not allowed.");
  const timestamp = new Date().toISOString(); const event = { id: createId("evt"), timestamp, actor: "Demo operator", type: parsed.data.status ? "status" as const : "note" as const, note: parsed.data.note, beforeStatus: parsed.data.status ? claim.status : undefined, afterStatus: parsed.data.status };
  if (parsed.data.status) await updateClaim(id, { status: parsed.data.status });
  const updated = await addClaimEvent(id, event); return NextResponse.json({ claim: updated, event }, { status: 201 });
}
