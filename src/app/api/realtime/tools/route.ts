import { NextResponse } from "next/server";
import { z } from "zod";
import { executeRealtimeTool } from "@/lib/live-intake/tools";

const requestSchema = z
  .object({
    name: z.string().min(1).max(80),
    arguments: z.unknown(),
  })
  .strict();

function getCallId(request: Request) {
  const cookie = request.headers.get("cookie") ?? "";
  return (
    cookie
      .split(";")
      .map((entry) => entry.trim().split("="))
      .find(([name]) => name === "acme_live_call")?.[1] ?? null
  );
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid live intake tool request." }, { status: 400 });
  }

  const output = await executeRealtimeTool(parsed.data.name, parsed.data.arguments, {
    callId: getCallId(request),
  });
  return NextResponse.json({ output });
}
