import { automationRoute } from "@/lib/auth/automation";
import { createRevision } from "@/lib/services/revisions";
import { recordInbound } from "@/lib/services/automation";
import { getOrder } from "@/lib/services/orders";

/** POST /api/orders/{id}/revision  { "feedback": "…" } */
export const POST = automationRoute<{ id: string }>(async ({ req, db, actor, params }) => {
  const body = await req.json();
  const order = await getOrder(db, params.id);
  await recordInbound(db, "orders.revision", body, order.id);
  const r = await createRevision(db, order.id, body, actor);
  return { jobId: order.job_id, revision: r.revision_number, structured: r.structured };
});
