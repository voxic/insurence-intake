import { NextResponse } from "next/server";
import { z } from "zod";
export function invalid(error: z.ZodError) { return NextResponse.json({ error: "Invalid request.", details: z.treeifyError(error) }, { status: 400 }); }
export function notFound() { return NextResponse.json({ error: "Record not found." }, { status: 404 }); }
export function conflict(message: string) { return NextResponse.json({ error: message }, { status: 409 }); }
export async function body(request: Request) { return request.json().catch(() => null); }
export function createId(prefix: string) { return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 12)}`; }
