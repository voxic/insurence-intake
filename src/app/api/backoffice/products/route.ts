import { NextResponse } from "next/server";
import { body, createId, invalid } from "@/lib/backoffice/http";
import { productCreateSchema } from "@/lib/backoffice/schemas";
import { createProduct, getState } from "@/lib/backoffice/repository";
export async function GET() { return NextResponse.json({ products: (await getState()).products }); }
export async function POST(request: Request) { const parsed = productCreateSchema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error); const product = await createProduct({ ...parsed.data, id: createId("prd") }); return NextResponse.json({ product }, { status: 201 }); }
