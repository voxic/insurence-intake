import { NextResponse } from "next/server";
import { z } from "zod";
import { body, invalid, notFound } from "@/lib/backoffice/http";
import { DemoDataError, isZodError, updateCollectionRow } from "@/lib/seeds/edit-row";

type Context = { params: Promise<{ collection: string; id: string }> };

export async function PATCH(request: Request, { params }: Context) {
  const { collection, id } = await params;
  if (!/^[a-z][a-z0-9_-]{1,80}$/.test(id)) return notFound();
  const parsed = z.record(z.string(), z.unknown()).safeParse(await body(request));
  if (!parsed.success) return invalid(parsed.error);
  try {
    const row = await updateCollectionRow(collection, id, parsed.data);
    return row ? NextResponse.json({ row }) : notFound();
  } catch (error) {
    if (isZodError(error)) return invalid(error);
    if (error instanceof DemoDataError) return NextResponse.json({ error: error.message }, { status: error.status });
    throw error;
  }
}
