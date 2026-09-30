import { NextResponse } from "next/server";
import { catalogPayload, loadVoiceChoices, voiceRouteAllowed } from "@/lib/voice-preview";

export async function GET(request: Request) {
  const payload = voiceRouteAllowed(request) ? await loadVoiceChoices() : catalogPayload(false);
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
