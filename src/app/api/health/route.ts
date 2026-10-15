import { NextResponse } from "next/server";
import { integrationModes } from "@/lib/env";

export function GET() {
  return NextResponse.json({ ok: true, integrations: integrationModes() });
}
