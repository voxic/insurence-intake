import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { transcriptDir } from "@/lib/data-paths";
import type { IntakeCall } from "@/lib/types";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  try {
    const raw = await readFile(path.join(transcriptDir(), `${id}.json`), "utf8");
    const call = JSON.parse(raw) as IntakeCall;
    return NextResponse.json(call);
  } catch {
    return NextResponse.json({ error: "Transcript not found." }, { status: 404 });
  }
}
