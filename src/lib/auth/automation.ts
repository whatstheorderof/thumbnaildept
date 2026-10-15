import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { env } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { automationActor } from "@/lib/domain/actor";
import { ServiceError } from "@/lib/services/errors";
import type { DB } from "@/lib/types/db";
import type { Actor } from "@/lib/domain/actor";

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function automationKeyFrom(req: NextRequest) {
  return req.headers.get("x-api-key") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? null;
}

/**
 * Wrap an inbound automation route (Make.com, scripts). Checks the API key,
 * provides a service-role client + automation actor, and maps errors to JSON.
 */
export function automationRoute<P extends Record<string, string>>(
  handler: (ctx: { req: NextRequest; db: DB; actor: Actor; params: P }) => Promise<unknown>,
) {
  return async (req: NextRequest, { params }: { params: Promise<P> }) => {
    const key = automationKeyFrom(req);
    if (!env.automationApiKey) return NextResponse.json({ error: "AUTOMATION_API_KEY is not configured" }, { status: 503 });
    if (!key || !safeEqual(key, env.automationApiKey)) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
    try {
      const db = createSupabaseAdminClient();
      const result = await handler({ req, db, actor: automationActor(req.headers.get("x-automation-source") ?? "automation"), params: await params });
      return NextResponse.json(result ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

export function errorResponse(e: unknown) {
  if (e instanceof ZodError) return NextResponse.json({ error: "Invalid input", issues: e.issues }, { status: 422 });
  if (e instanceof ServiceError) return NextResponse.json({ error: e.message, code: e.code }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: "Internal error" }, { status: 500 });
}
