import { automationRoute } from "@/lib/auth/automation";
import { runOrderResearch } from "@/lib/services/research/pipeline";
import { recordInbound } from "@/lib/services/automation";
import { getOrder } from "@/lib/services/orders";

export const maxDuration = 300;

/** POST /api/orders/{id}/start — run the research stage. Emits research.complete. */
export const POST = automationRoute<{ id: string }>(async ({ db, actor, params }) => {
  const order = await getOrder(db, params.id);
  await recordInbound(db, "orders.start", { id: params.id }, order.id);
  const run = await runOrderResearch(db, order.id, actor);
  return { jobId: order.job_id, researchRunId: run.id, videos: run.video_count, status: "RESEARCH_COMPLETE" };
});
