import type { DB, ActivityRow } from "@/lib/types/db";
import type { Actor } from "@/lib/domain/actor";

export async function logActivity(
  db: DB,
  entry: { orderId: string | null; actor: Actor; action: string; message: string; data?: Record<string, unknown> },
) {
  const { error } = await db.from("activity_log").insert({
    order_id: entry.orderId,
    actor_type: entry.actor.type,
    actor_id: entry.actor.userId ?? null,
    action: entry.action,
    message: entry.message,
    data: { ...(entry.data ?? {}), ...(entry.actor.label ? { actor: entry.actor.label } : {}) },
  });
  if (error) console.error("[activity] failed to log", entry.action, error.message);
}

export async function listActivity(db: DB, orderId: string, limit = 100) {
  const { data } = await db.from("activity_log").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(limit);
  return (data ?? []) as ActivityRow[];
}
