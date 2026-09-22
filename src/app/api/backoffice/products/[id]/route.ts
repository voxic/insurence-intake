import { NextResponse } from "next/server";
import { body, invalid, notFound } from "@/lib/backoffice/http";
import { idSchema, productPatchSchema } from "@/lib/backoffice/schemas";
import { getProduct, updateProduct } from "@/lib/backoffice/repository";
type Context = { params: Promise<{ id: string }> };
export async function GET(_: Request, { params }: Context) { const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const product = await getProduct(id); return product ? NextResponse.json({ product }) : notFound(); }
export async function PATCH(request: Request, { params }: Context) { const { id } = await params; if (!idSchema.safeParse(id).success) return notFound(); const parsed = productPatchSchema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error); const product = await updateProduct(id, parsed.data); return product ? NextResponse.json({ product }) : notFound(); }
