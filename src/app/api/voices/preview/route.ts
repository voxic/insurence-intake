import { NextResponse } from "next/server";
import { synthesizePreview, VoicePreviewError, voiceRouteAllowed } from "@/lib/voice-preview";
import { isVoiceId, type PreviewLanguage } from "@/lib/voices";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const voiceId = url.searchParams.get("voice")?.trim().toLowerCase() ?? "";
  const language = url.searchParams.get("lang") ?? "en";
  if (!isVoiceId(voiceId)) {
    return NextResponse.json({ error: "Unknown voice." }, { status: 400 });
  }
  if (language !== "en" && language !== "sv") {
    return NextResponse.json({ error: "Preview language must be en or sv." }, { status: 400 });
  }
  if (!voiceRouteAllowed(request)) {
    return NextResponse.json(
      { configured: false, error: "A valid session access token is required to preview a voice." },
      { status: 401, headers: { "WWW-Authenticate": 'Bearer realm="session"' } },
    );
  }

  try {
    const audio = await synthesizePreview(voiceId, language as PreviewLanguage);
    return new NextResponse(Buffer.from(audio.bytes), {
      headers: {
        "Content-Type": audio.contentType,
        "Cache-Control": "private, max-age=86400",
        "X-Preview-Cache": audio.cached ? "hit" : "miss",
      },
    });
  } catch (error) {
    if (error instanceof VoicePreviewError) {
      return NextResponse.json(
        { configured: error.configured, error: error.message },
        { status: error.status },
      );
    }
    throw error;
  }
}
