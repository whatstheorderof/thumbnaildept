import { z } from "zod";
import type { DB, OrderRow, ClientRow } from "@/lib/types/db";
import type { Actor } from "@/lib/domain/actor";
import { canTransition, isOrderStatus, STATUS_META, type OrderStatus, ORDER_STATUSES } from "@/lib/domain/status";
import { getClaude } from "@/lib/adapters/claude";
import { isJobId, isUuid } from "@/lib/utils";
import { logActivity } from "./activity";
import { claudeCost, recordCost } from "./costs";
import { emitEvent } from "./automation";
import { getSettings } from "./settings";
import { findOrCreateClient } from "./clients";
import { ServiceError, must, notFound } from "./errors";

const optionalText = z.string().trim().max(5000).optional().nullable().transform((v) => (v ? v : null));

export const createOrderSchema = z.object({
  marketplace: z.enum(["fiverr", "upwork", "direct", "other"]).default("fiverr"),
  marketplaceOrderId: optionalText,
  clientId: z.string().uuid().optional().nullable(),
  /** For automation: create/find a client by name instead of id. */
  clientName: optionalText,
  clientUsername: optionalText,
  videoTitle: z.string().trim().min(2, "Video title is required").max(300),
  videoDescription: optionalText,
  channelUrl: z.string().trim().url("Channel URL must be a valid URL").optional().nullable().or(z.literal("").transform(() => null)),
  requestedText: optionalText,
  category: optionalText,
  autoDetectCategory: z.boolean().default(false),
  clientNotes: optionalText,
  thingsToAvoid: optionalText,
  deadline: z.string().optional().nullable().transform((v) => (v ? new Date(v).toISOString() : null)),
  salePrice: z.number().min(0).optional(),
  referenceUrls: z.array(z.string().trim().url()).max(30).default([]),
});
export type CreateOrderInput = z.input<typeof createOrderSchema>;

export async function createOrder(db: DB, raw: CreateOrderInput, actor: Actor) {
  const input = createOrderSchema.parse(raw);
  const settings = await getSettings(db);

  let clientId = input.clientId ?? null;
  if (!clientId && input.clientName) {
    const client = await findOrCreateClient(db, { name: input.clientName, marketplace: input.marketplace, marketplaceUsername: input.clientUsername, channelUrl: input.channelUrl });
    clientId = client.id;
  }

  let client: ClientRow | null = null;
  if (clientId) {
    client = must(await db.from("clients").select("*").eq("id", clientId).single(), "Client") as ClientRow;
  }

  // Channel: link to an existing channel profile by URL, or create one.
  const channelUrl = input.channelUrl ?? client?.channel_url ?? null;
  let channelId: string | null = null;
  if (channelUrl) {
    const { data: existing } = await db.from("channels").select("id").ilike("url", channelUrl).maybeSingle();
    if (existing) channelId = existing.id;
    else {
      const { data: created } = await db.from("channels").insert({ url: channelUrl, client_id: clientId }).select("id").single();
      channelId = created?.id ?? null;
    }
  }

  const salePrice = input.salePrice ?? settings.pricing.defaultSalePrice;
  const feePct = settings.pricing.marketplaceFeePct[input.marketplace] ?? 0;

  const insert = await db.from("orders").insert({
    client_id: clientId,
    channel_id: channelId,
    marketplace: input.marketplace,
    marketplace_order_id: input.marketplaceOrderId,
    video_title: input.videoTitle,
    video_description: input.videoDescription,
    channel_url: channelUrl,
    requested_text: input.requestedText,
    category: input.category,
    auto_detect_category: input.autoDetectCategory,
    client_notes: input.clientNotes,
    things_to_avoid: input.thingsToAvoid ?? client?.things_to_avoid ?? null,
    deadline: input.deadline,
    sale_price: salePrice,
    currency: settings.pricing.currency,
    marketplace_fee: Number(((salePrice * feePct) / 100).toFixed(2)),
    created_by: actor.userId ?? null,
    assigned_to: actor.type === "user" ? actor.userId ?? null : null,
  }).select("*").single();

  if (insert.error?.code === "23505") throw new ServiceError("An order with this marketplace order ID already exists", 409, "duplicate");
  const order = must(insert, "Create order") as OrderRow;

  if (input.referenceUrls.length) {
    await db.from("client_references").insert(input.referenceUrls.map((url) => ({
      order_id: order.id, client_id: clientId, source: "url", url, created_by: actor.userId ?? null,
    })));
  }

  await logActivity(db, {
    orderId: order.id, actor, action: "order.created",
    message: `Order created${input.marketplaceOrderId ? ` from ${input.marketplace} ${input.marketplaceOrderId}` : ""}`,
  });

  if (input.autoDetectCategory && !input.category) {
    await detectCategory(db, order, actor).catch((e) => console.error("[orders] category detection failed", e));
  }

  return must(await db.from("orders").select("*").eq("id", order.id).single(), "Order") as OrderRow;
}

export async function detectCategory(db: DB, order: OrderRow, actor: Actor) {
  const { result, usage, mode } = await getClaude().detectCategory({
    title: order.video_title, description: order.video_description, channelContext: order.channel_url,
  });
  await db.from("orders").update({
    detected_category: result.category, category_confidence: result.confidence, category: order.category ?? result.category,
  }).eq("id", order.id);
  await recordCost(db, { orderId: order.id, provider: "anthropic", operation: "category.detect", cost: claudeCost(usage.model, usage.inputTokens, usage.outputTokens), units: { ...usage }, mode });
  await logActivity(db, {
    orderId: order.id, actor, action: "category.detected",
    message: `Category detected: ${result.category} (${Math.round(result.confidence * 100)}%)${mode === "mock" ? " · dev mock" : ""}`,
  });
  return result;
}

export const updateOrderSchema = createOrderSchema
  .pick({ videoTitle: true, videoDescription: true, requestedText: true, category: true, clientNotes: true, thingsToAvoid: true, deadline: true, marketplaceOrderId: true })
  .partial();

export async function updateOrder(db: DB, orderId: string, raw: z.input<typeof updateOrderSchema>, actor: Actor) {
  const input = updateOrderSchema.parse(raw);
  const patch: Record<string, unknown> = {};
  const map = { videoTitle: "video_title", videoDescription: "video_description", requestedText: "requested_text", category: "category", clientNotes: "client_notes", thingsToAvoid: "things_to_avoid", deadline: "deadline", marketplaceOrderId: "marketplace_order_id" } as const;
  for (const [k, col] of Object.entries(map)) if (k in input) patch[col] = input[k as keyof typeof input];
  const order = must(await db.from("orders").update(patch).eq("id", orderId).select("*").single(), "Order") as OrderRow;
  await logActivity(db, { orderId, actor, action: "order.updated", message: `Updated ${Object.keys(patch).length} field(s)`, data: { fields: Object.keys(patch) } });
  return order;
}

/** Resolve an order by UUID or JOB-000123. */
export async function getOrder(db: DB, idOrJobId: string): Promise<OrderRow> {
  const q = db.from("orders").select("*");
  const res = isUuid(idOrJobId)
    ? await q.eq("id", idOrJobId).maybeSingle()
    : isJobId(idOrJobId)
      ? await q.eq("job_id", idOrJobId.toUpperCase()).maybeSingle()
      : null;
  if (!res?.data) throw notFound(`Order ${idOrJobId}`);
  return res.data as OrderRow;
}

export interface OrderListItem extends OrderRow { client: Pick<ClientRow, "id" | "name"> | null }

export async function listOrders(db: DB, filters: { status?: string | string[]; q?: string; clientId?: string; limit?: number } = {}) {
  let q = db.from("orders").select("*, client:clients(id, name)").order("created_at", { ascending: false }).limit(filters.limit ?? 200);
  const statuses = (Array.isArray(filters.status) ? filters.status : filters.status ? [filters.status] : []).filter(isOrderStatus);
  if (statuses.length) q = q.in("status", statuses);
  if (filters.clientId) q = q.eq("client_id", filters.clientId);
  if (filters.q) {
    const term = filters.q.replace(/[%,()]/g, " ").trim();
    if (term) q = q.or(`video_title.ilike.%${term}%,job_id.ilike.%${term}%,marketplace_order_id.ilike.%${term}%`);
  }
  const { data, error } = await q;
  if (error) throw new ServiceError(error.message, 500);
  return (data ?? []) as OrderListItem[];
}

export async function countByStatus(db: DB) {
  const { data } = await db.from("orders").select("status");
  const counts = Object.fromEntries(ORDER_STATUSES.map((s) => [s, 0])) as Record<OrderStatus, number>;
  for (const r of data ?? []) counts[r.status as OrderStatus]++;
  return counts;
}

const EVENT_FOR_STATUS: Partial<Record<OrderStatus, Parameters<typeof emitEvent>[1]>> = {
  RESEARCH_COMPLETE: "research.complete",
  CONCEPTS_READY: "concepts.complete",
  GENERATIONS_READY: "generation.complete",
  REVIEW: "review.required",
  APPROVED: "job.approved",
  READY_TO_DELIVER: "delivery.ready",
};

/**
 * Move an order to a new status, enforcing the state machine and the
 * human-approval rule. Emits the matching outgoing webhook.
 */
export async function transitionOrder(db: DB, idOrJobId: string, to: OrderStatus, actor: Actor, note?: string) {
  const order = await getOrder(db, idOrJobId);
  if (order.status === to) return order;
  if (!canTransition(order.status, to, actor.type)) {
    const reason = to === "APPROVED" && actor.type !== "user"
      ? "Only a signed-in reviewer can approve an order"
      : `Cannot move ${order.job_id} from ${STATUS_META[order.status].label} to ${STATUS_META[to].label}`;
    throw new ServiceError(reason, 409, "invalid_transition");
  }

  const now = new Date().toISOString();
  const patch: Record<string, unknown> = { status: to };
  if (to === "RESEARCHING" && !order.started_at) patch.started_at = now;
  if (to === "APPROVED") { patch.approved_by = actor.userId ?? null; patch.approved_at = now; }
  if (to === "DELIVERED") patch.delivered_at = now;
  if (to === "REVISION") { patch.approved_by = null; patch.approved_at = null; }

  // Optimistic concurrency: only update if status is still what we read.
  const res = await db.from("orders").update(patch).eq("id", order.id).eq("status", order.status).select("*").maybeSingle();
  if (res.error) throw new ServiceError(res.error.message, 500);
  if (!res.data) throw new ServiceError(`${order.job_id} changed while you were working — refresh and try again`, 409, "conflict");
  const updated = res.data as OrderRow;

  await logActivity(db, {
    orderId: order.id, actor, action: "status.changed",
    message: `${STATUS_META[order.status].label} → ${STATUS_META[to].label}${note ? ` · ${note}` : ""}`,
    data: { from: order.status, to },
  });

  const event = EVENT_FOR_STATUS[to];
  if (event) await emitEvent(db, event, order.id, { jobId: order.job_id, status: to, from: order.status });

  return updated;
}
