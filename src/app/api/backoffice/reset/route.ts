import { NextResponse } from "next/server";
import { body, invalid } from "@/lib/backoffice/http";
import { resetState } from "@/lib/backoffice/repository";
import { z } from "zod";
const schema = z.object({ confirmation: z.literal("RESET_DEMO_DATA") });
export async function POST(request: Request) { const parsed = schema.safeParse(await body(request)); if (!parsed.success) return invalid(parsed.error); await resetState(); return NextResponse.json({ reset: true }); }
