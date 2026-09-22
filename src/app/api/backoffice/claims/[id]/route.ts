import { NextResponse } from "next/server";
import { body, conflict, invalid, notFound } from "@/lib/backoffice/http";
import { claimPatchSchema, idSchema } from "@/lib/backoffice/schemas";
import { canTransition, getClaim, updateClaim } from "@/lib/backoffice/repository";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) { const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const claim = await getClaim(id); return claim ? NextResponse.json({ claim }) : notFound(); }
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const current = await getClaim(id); if (!current) return notFound();
  const parsed = claimPatchSchema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error);
  if (parsed.data.status && parsed.data.status !== current.status && !canTransition(current.status, parsed.data.status)) return conflict("This claim status transition is not allowed.");
  const claim = await updateClaim(id, parsed.data); return NextResponse.json({ claim });
}
