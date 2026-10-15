import { automationRoute } from "@/lib/auth/automation";
import { createOrder, listOrders } from "@/lib/services/orders";
import { recordInbound } from "@/lib/services/automation";

/** POST /api/orders — create a job (e.g. from a Make.com Fiverr scenario). */
export const POST = automationRoute(async ({ req, db, actor }) => {
  const body = await req.json();
  const order = await createOrder(db, body, actor);
  await recordInbound(db, "orders.create", body, order.id);
  return { id: order.id, jobId: order.job_id, status: order.status, category: order.category };
});

/** GET /api/orders?status=REVIEW&q=… */
export const GET = automationRoute(async ({ req, db }) => {
  const sp = req.nextUrl.searchParams;
  const orders = await listOrders(db, { status: sp.getAll("status"), q: sp.get("q") ?? undefined, limit: Number(sp.get("limit") ?? 50) });
  return { orders: orders.map((o) => ({ id: o.id, jobId: o.job_id, status: o.status, videoTitle: o.video_title, client: o.client?.name ?? null, deadline: o.deadline })) };
});
