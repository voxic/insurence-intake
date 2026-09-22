import { NextResponse } from "next/server";
import { z } from "zod";
import { executeRealtimeTool } from "@/lib/live-intake/tools";

const requestSchema = z
  .object({
    name: z.string().min(1).max(80),
    arguments: z.unknown(),
  })
  .strict();

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid live intake tool request." }, { status: 400 });
  }

  // The browser only transports an already-requested Realtime call. Validation,
  // data access, and all writes stay within this server route and its adapter.
  const output = await executeRealtimeTool(parsed.data.name, parsed.data.arguments);
  return NextResponse.json({ output });
}
