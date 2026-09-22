import { NextResponse } from "next/server";
import { idSchema, policyCreateSchema } from "@/lib/backoffice/schemas";
import { body, invalid, notFound } from "@/lib/backoffice/http";
import { getPolicy, updatePolicy } from "@/lib/backoffice/repository";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) { const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const policy = await getPolicy(id); return policy ? NextResponse.json({ policy }) : notFound(); }
export async function PATCH(request: Request, { params }: Context) {
  const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const existing = await getPolicy(id); if (!existing) return notFound();
  const parsed = policyCreateSchema.partial().safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error);
  const policy = await updatePolicy(id, parsed.data);
  return NextResponse.json({ policy });
}
