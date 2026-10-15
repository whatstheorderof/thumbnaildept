import { automationRoute } from "@/lib/auth/automation";
import { getOrder } from "@/lib/services/orders";

/** GET /api/orders/{id|JOB-000123} */
export const GET = automationRoute<{ id: string }>(async ({ db, params }) => {
  const order = await getOrder(db, params.id);
  const { data: latest } = await db.from("research_runs").select("id, status, video_count, completed_at").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return { order, research: latest };
});
