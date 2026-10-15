import { z } from "zod";
import { automationRoute } from "@/lib/auth/automation";
import { transitionOrder } from "@/lib/services/orders";
import { ORDER_STATUSES } from "@/lib/domain/status";

/**
 * POST /api/orders/{id}/transition  { "to": "DELIVERED", "note": "…" }
 * Automation can never move an order to APPROVED — that requires a human.
 */
export const POST = automationRoute<{ id: string }>(async ({ req, db, actor, params }) => {
  const { to, note } = z.object({ to: z.enum(ORDER_STATUSES), note: z.string().max(500).optional() }).parse(await req.json());
  const order = await transitionOrder(db, params.id, to, actor, note);
  return { jobId: order.job_id, status: order.status };
});
