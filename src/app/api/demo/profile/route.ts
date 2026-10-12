import { NextResponse } from "next/server";
import { getDemoProfile } from "@/lib/backoffice/repository";

export async function GET() {
  return NextResponse.json(getDemoProfile());
}
