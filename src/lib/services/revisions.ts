import { z } from "zod";
import type { DB, RevisionRow } from "@/lib/types/db";
import type { Actor } from "@/lib/domain/actor";
import { getClaude } from "@/lib/adapters/claude";
import { canTransition } from "@/lib/domain/status";
import { logActivity } from "./activity";
import { claudeCost, recordCost } from "./costs";
import { getOrder, transitionOrder } from "./orders";
import { ServiceError } from "./errors";

export const revisionInputSchema = z.object({ feedback: z.string().trim().min(3, "Paste the customer's feedback").max(10000) });

/**
 * Store marketplace feedback, have Claude split it into PRESERVE / CHANGE /
 * REMOVE / ADD, and move the order into REVISION. Unaffected elements are
 * listed under PRESERVE so the compositor rebuilds only what changed.
 */
export async function createRevision(db: DB, idOrJobId: string, raw: z.input<typeof revisionInputSchema>, actor: Actor) {
  const { feedback } = revisionInputSchema.parse(raw);
  const order = await getOrder(db, idOrJobId);
  if (order.status !== "REVISION" && !canTransition(order.status, "REVISION", actor.type)) {
    throw new ServiceError(`${order.job_id} is ${order.status}; revisions start from review, approval or delivery`, 409, "invalid_state");
  }

  const { data: last } = await db.from("revisions").select("revision_number").eq("order_id", order.id).order("revision_number", { ascending: false }).limit(1).maybeSingle();
  const { data: winner } = await db.from("reviews").select("composition_id").eq("order_id", order.id).eq("is_winner", true).order("created_at", { ascending: false }).limit(1).maybeSingle();

  const { result, usage, mode } = await getClaude().structureRevision({ feedback, orderTitle: order.video_title });
  await recordCost(db, { orderId: order.id, provider: "anthropic", operation: "revision.structure", cost: claudeCost(usage.model, usage.inputTokens, usage.outputTokens), units: { ...usage }, mode });

  const { data, error } = await db.from("revisions").insert({
    order_id: order.id, revision_number: (last?.revision_number ?? 0) + 1, raw_feedback: feedback, structured: result,
    base_composition_id: winner?.composition_id ?? null, source_mode: mode, created_by: actor.userId ?? null,
  }).select("*").single();
  if (error) throw new ServiceError(error.message, 500);
  const revision = data as RevisionRow;

  if (order.status !== "REVISION") await transitionOrder(db, order.id, "REVISION", actor, `revision #${revision.revision_number}`);
  await logActivity(db, {
    orderId: order.id, actor, action: "revision.created",
    message: `Revision #${revision.revision_number}: ${result.change.length} change, ${result.remove.length} remove, ${result.add.length} add${mode === "mock" ? " · dev mock" : ""}`,
  });
  return revision;
}

export async function listRevisions(db: DB, orderId: string) {
  const { data } = await db.from("revisions").select("*").eq("order_id", orderId).order("revision_number", { ascending: false });
  return (data ?? []) as RevisionRow[];
}
