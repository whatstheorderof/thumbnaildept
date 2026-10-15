import type { DB, CostEntryRow, OrderRow, SourceMode } from "@/lib/types/db";
import { getSettings } from "./settings";

export type CostProvider = "anthropic" | "leonardo" | "youtube" | "storage" | "other";

export async function recordCost(
  db: DB,
  entry: { orderId?: string | null; researchRunId?: string | null; provider: CostProvider; operation: string; cost: number; currency?: string; units?: Record<string, unknown>; mode: SourceMode },
) {
  const { error } = await db.from("cost_entries").insert({
    order_id: entry.orderId ?? null,
    research_run_id: entry.researchRunId ?? null,
    provider: entry.provider,
    operation: entry.operation,
    cost: Number(entry.cost.toFixed(6)),
    currency: entry.currency ?? "USD",
    units: entry.units ?? {},
    source_mode: entry.mode,
  });
  if (error) console.error("[costs] failed to record", entry.operation, error.message);
}

/**
 * Approximate Claude pricing (USD per million tokens) used for cost tracking.
 * Update these when pricing changes; the actual bill is authoritative.
 */
const CLAUDE_PRICING: Record<string, { input: number; output: number }> = {
  default: { input: 3, output: 15 },
};
export function claudeCost(model: string, inputTokens: number, outputTokens: number) {
  const p = CLAUDE_PRICING[model] ?? CLAUDE_PRICING.default;
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export interface OrderEconomics {
  salePrice: number;
  marketplaceFee: number;
  productionCost: number; // in sale currency
  productionCostUsd: number;
  margin: number;
  marginPct: number;
  byProvider: Record<string, number>; // USD
  currency: string;
}

export function computeEconomics(order: Pick<OrderRow, "sale_price" | "marketplace_fee" | "marketplace" | "currency">, entries: Pick<CostEntryRow, "provider" | "cost" | "currency">[], feePct: number, usdToGbp: number): OrderEconomics {
  const byProvider: Record<string, number> = {};
  let usd = 0;
  for (const e of entries) {
    const v = e.currency === "USD" ? Number(e.cost) : Number(e.cost) / usdToGbp;
    byProvider[e.provider] = (byProvider[e.provider] ?? 0) + v;
    usd += v;
  }
  const salePrice = Number(order.sale_price);
  const fee = order.marketplace_fee != null ? Number(order.marketplace_fee) : (salePrice * feePct) / 100;
  const productionCost = order.currency === "GBP" ? usd * usdToGbp : usd;
  const margin = salePrice - fee - productionCost;
  return { salePrice, marketplaceFee: fee, productionCost, productionCostUsd: usd, margin, marginPct: salePrice ? (margin / salePrice) * 100 : 0, byProvider, currency: order.currency };
}

export async function getOrderEconomics(db: DB, order: OrderRow) {
  const [settings, { data }] = await Promise.all([
    getSettings(db),
    db.from("cost_entries").select("provider, cost, currency").eq("order_id", order.id),
  ]);
  const feePct = settings.pricing.marketplaceFeePct[order.marketplace] ?? 0;
  return computeEconomics(order, (data ?? []) as CostEntryRow[], feePct, settings.pricing.usdToGbp);
}
