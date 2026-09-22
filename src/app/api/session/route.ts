import { NextResponse } from "next/server";
import { createLiveIntakeCall } from "@/lib/live-intake/call-state";

const CLIENT_SECRETS_URL = "https://api.x.ai/v1/realtime/client_secrets";

function extractToken(payload: Record<string, unknown>) {
  if (typeof payload.value === "string" && payload.value) {
    return {
      value: payload.value,
      expiresAt:
        typeof payload.expires_at === "number" ? payload.expires_at : undefined,
    };
  }
  const secret = payload.client_secret;
  if (typeof secret === "string" && secret) {
    return { value: secret };
  }
  if (secret && typeof secret === "object") {
    const nested = secret as Record<string, unknown>;
    if (typeof nested.value === "string" && nested.value) {
      return {
        value: nested.value,
        expiresAt:
          typeof nested.expires_at === "number" ? nested.expires_at : undefined,
      };
    }
  }
  return null;
}

export async function GET() {
  return NextResponse.json({
    configured: Boolean(process.env.XAI_API_KEY),
  });
}

export async function POST() {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        configured: false,
        error:
          "XAI_API_KEY is missing. Add it to .env.local on the server — it never goes to the browser.",
      },
      { status: 503 },
    );
  }

  const response = await fetch(CLIENT_SECRETS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      expires_after: { seconds: 300 },
    }),
  });

  const payload = (await response.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;

  if (!response.ok) {
    const message =
      (typeof payload.error === "object" &&
        payload.error &&
        typeof (payload.error as { message?: string }).message === "string" &&
        (payload.error as { message: string }).message) ||
      (typeof payload.message === "string" && payload.message) ||
      "xAI refused to mint an ephemeral token.";
    return NextResponse.json(
      { configured: true, error: message },
      { status: response.status },
    );
  }

  const token = extractToken(payload);
  if (!token) {
    return NextResponse.json(
      {
        configured: true,
        error: "xAI returned a client secret without a usable token value.",
      },
      { status: 502 },
    );
  }

  const result = NextResponse.json(token);
  result.cookies.set({
    name: "acme_live_call",
    value: createLiveIntakeCall(),
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 300,
  });
  return result;
}
