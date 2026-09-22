import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import type { IntakeCall } from "@/lib/types";

const TRANSCRIPT_DIR = path.join(process.cwd(), "data", "transcripts");
const memory = new Map<string, IntakeCall>();

function isCall(value: unknown): value is IntakeCall {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.id === "string" &&
    typeof record.startedAt === "string" &&
    Array.isArray(record.turns)
  );
}

async function ensureDir() {
  await mkdir(TRANSCRIPT_DIR, { recursive: true });
}

export async function GET() {
  await ensureDir();
  const fromMemory = [...memory.values()];
  const files = await readdir(TRANSCRIPT_DIR).catch(() => []);
  const fromDisk: IntakeCall[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(path.join(TRANSCRIPT_DIR, file), "utf8");
      const parsed = JSON.parse(raw) as unknown;
      if (isCall(parsed) && !memory.has(parsed.id)) {
        fromDisk.push(parsed);
      }
    } catch {
      // skip unreadable files
    }
  }
  const calls = [...fromMemory, ...fromDisk].sort((a, b) =>
    b.startedAt.localeCompare(a.startedAt),
  );
  return NextResponse.json({ calls });
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as unknown;
  if (!isCall(body)) {
    return NextResponse.json({ error: "Invalid transcript payload." }, { status: 400 });
  }

  memory.set(body.id, body);
  await ensureDir();
  await writeFile(
    path.join(TRANSCRIPT_DIR, `${body.id}.json`),
    JSON.stringify(body, null, 2),
    "utf8",
  );

  return NextResponse.json({ id: body.id, stored: true });
}
