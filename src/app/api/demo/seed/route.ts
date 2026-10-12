import { NextResponse } from "next/server";
import { z } from "zod";
import { body, invalid } from "@/lib/backoffice/http";
import { activateSeed, getDemoProfile } from "@/lib/backoffice/repository";

const schema = z.object({
  seedId: z.string().trim().min(1).max(40),
  confirmation: z.literal("SWITCH_DEMO_SEED"),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await body(request));
  if (!parsed.success) return invalid(parsed.error);
  try {
    await activateSeed(parsed.data.seedId);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown demo seed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
  return NextResponse.json({ switched: true, profile: getDemoProfile() });
}
