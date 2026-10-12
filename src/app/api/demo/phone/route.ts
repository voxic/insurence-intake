import { NextResponse } from "next/server";
import { z } from "zod";
import { body, invalid } from "@/lib/backoffice/http";
import { getDemoProfile, setPhoneAppearance } from "@/lib/backoffice/repository";
import { ACCENTS } from "@/lib/seeds/types";

const schema = z.object({
  displayName: z.string().trim().min(2).max(48),
  accent: z.enum(ACCENTS),
});

export async function POST(request: Request) {
  const parsed = schema.safeParse(await body(request));
  if (!parsed.success) return invalid(parsed.error);
  await setPhoneAppearance(parsed.data);
  return NextResponse.json({ phone: getDemoProfile().phone });
}
