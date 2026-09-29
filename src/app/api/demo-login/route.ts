import { NextResponse } from "next/server";
import {
  createDemoSession,
  DEMO_SESSION_COOKIE,
  isValidDemoPassword,
} from "@/lib/demo-password";

const DEMO_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { password?: unknown } | null;
  if (typeof body?.password !== "string" || !isValidDemoPassword(body.password)) {
    return NextResponse.json({ error: "Incorrect demo password." }, { status: 401 });
  }

  const session = createDemoSession();
  if (!session) {
    return NextResponse.json(
      { error: "Demo password login is not configured." },
      { status: 503 },
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set({
    name: DEMO_SESSION_COOKIE,
    value: session,
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    // Site-wide so every page load (/, /settings) can see the gate is already open.
    path: "/",
    maxAge: DEMO_SESSION_MAX_AGE_SECONDS,
  });
  return response;
}
