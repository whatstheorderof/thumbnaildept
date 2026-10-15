import { createHmac } from "node:crypto";
import type { DB } from "@/lib/types/db";
import { env } from "@/lib/env";

/** Outgoing events Make.com (or anything else) can subscribe to. */
export const OUTGOING_EVENTS = [
  "research.complete",
  "concepts.complete",
  "generation.complete",
  "review.required",
  "job.approved",
  "delivery.ready",
] as const;
export type OutgoingEvent = (typeof OUTGOING_EVENTS)[number];

export function signPayload(body: string, secret: string) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

/**
 * Records an outgoing event and POSTs it to OUTGOING_WEBHOOK_URL if set.
 * Failures are recorded, never thrown — automation must not break the pipeline.
 */
export async function emitEvent(db: DB, event: OutgoingEvent, orderId: string | null, data: Record<string, unknown>) {
  const payload = { event, orderId, data, sentAt: new Date().toISOString() };
  const target = env.outgoingWebhookUrl ?? null;
  const { data: row } = await db
    .from("automation_events")
    .insert({ order_id: orderId, direction: "outgoing", event_type: event, payload, target_url: target, status: target ? "pending" : "skipped" })
    .select("id")
    .single();

  if (!target || !row) return { delivered: false };

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { "content-type": "application/json", "x-thumbnaildept-event": event };
  if (env.outgoingWebhookSecret) headers["x-thumbnaildept-signature"] = signPayload(body, env.outgoingWebhookSecret);

  try {
    const res = await fetch(target, { method: "POST", headers, body, signal: AbortSignal.timeout(10_000) });
    await db.from("automation_events").update({
      status: res.ok ? "sent" : "failed", response_status: res.status, attempts: 1, sent_at: new Date().toISOString(),
      error: res.ok ? null : (await res.text()).slice(0, 500),
    }).eq("id", row.id);
    return { delivered: res.ok };
  } catch (e) {
    await db.from("automation_events").update({ status: "failed", attempts: 1, error: String(e).slice(0, 500) }).eq("id", row.id);
    return { delivered: false };
  }
}

/** Audit log for inbound automation calls. */
export async function recordInbound(db: DB, eventType: string, payload: unknown, orderId: string | null, status: "received" | "rejected" = "received", error?: string) {
  await db.from("automation_events").insert({
    order_id: orderId, direction: "inbound", event_type: eventType, payload: (payload ?? {}) as object, status, error: error ?? null,
  });
}
