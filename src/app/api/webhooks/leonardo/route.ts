import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseLeonardoWebhook, verifyLeonardoWebhook } from "@/lib/adapters/leonardo";
import { applyCompletedGeneration } from "@/lib/services/generations";
import { recordInbound } from "@/lib/services/automation";

export const maxDuration = 120;

/**
 * Leonardo completion webhook. Leonardo sends the webhook API key you
 * configure as `Authorization: Bearer <LEONARDO_WEBHOOK_SECRET>`.
 */
export async function POST(req: NextRequest) {
  if (!verifyLeonardoWebhook(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  }
  const body = await req.json().catch(() => null);
  const db = createSupabaseAdminClient();
  const done = parseLeonardoWebhook(body);
  if (!done) {
    await recordInbound(db, "leonardo.webhook", body, null, "rejected", "Unrecognised payload");
    return NextResponse.json({ error: "Unrecognised payload" }, { status: 400 });
  }
  const result = await applyCompletedGeneration(db, done);
  await recordInbound(db, "leonardo.webhook", { generationId: done.providerGenerationId, status: done.status, images: done.images.length }, null, result.matched ? "received" : "rejected", result.matched ? undefined : "No matching generation");
  // 200 even for unknown ids so Leonardo doesn't retry forever.
  return NextResponse.json({ ok: true, ...result });
}
