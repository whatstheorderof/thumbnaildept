import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { getSettings } from "@/lib/services/settings";
import { formatMoney } from "@/lib/utils";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { db } = await requireUser();
  const [settings, { data: orders }, { data: costs }, { data: reviews }, { data: revisions }, { data: comps }, { data: concepts }, { data: perf }] = await Promise.all([
    getSettings(db),
    db.from("orders").select("id, client_id, status, category, sale_price, marketplace_fee, created_at, delivered_at"),
    db.from("cost_entries").select("provider, cost, currency"),
    db.from("reviews").select("duration_seconds"),
    db.from("revisions").select("order_id"),
    db.from("compositions").select("critic_total, critic_verdict"),
    db.from("concepts").select("style_pattern_id, pattern:style_patterns(name)").not("style_pattern_id", "is", null),
    db.from("performance_results").select("ctr, pattern:style_patterns(name)").not("style_pattern_id", "is", null),
  ]);
  const cur = settings.pricing.currency;
  const live = (orders ?? []).filter((o) => o.status !== "CANCELLED");
  const revenue = live.reduce((s, o) => s + Number(o.sale_price), 0);
  const fees = live.reduce((s, o) => s + Number(o.marketplace_fee ?? 0), 0);
  const aiUsd = (costs ?? []).reduce((s, c) => s + (c.currency === "USD" ? Number(c.cost) : Number(c.cost) / settings.pricing.usdToGbp), 0);
  const aiCost = aiUsd * settings.pricing.usdToGbp;
  const delivered = live.filter((o) => o.delivered_at);
  const fulfilHours = delivered.length ? delivered.reduce((s, o) => s + (+new Date(o.delivered_at!) - +new Date(o.created_at)) / 3.6e6, 0) / delivered.length : null;
  const reviewSecs = (reviews ?? []).filter((r) => r.duration_seconds != null);
  const avgReview = reviewSecs.length ? reviewSecs.reduce((s, r) => s + r.duration_seconds!, 0) / reviewSecs.length : null;
  const revisedOrders = new Set((revisions ?? []).map((r) => r.order_id)).size;
  const scored = (comps ?? []).filter((c) => c.critic_total != null);
  const avgCritic = scored.length ? scored.reduce((s, c) => s + Number(c.critic_total), 0) / scored.length : null;

  const byCategory = tally(live.map((o) => o.category ?? "Uncategorised"));
  const clientOrders = tally(live.filter((o) => o.client_id).map((o) => o.client_id!));
  const returning = Object.values(clientOrders).filter((n) => n > 1).length;
  const patternUse = tally((concepts ?? []).map((c) => (c.pattern as unknown as { name: string } | null)?.name ?? "?"));
  const patternCtr: Record<string, number[]> = {};
  for (const p of perf ?? []) { const n = (p.pattern as unknown as { name: string } | null)?.name; if (n && p.ctr != null) (patternCtr[n] ??= []).push(Number(p.ctr)); }
  const ctrRank = Object.fromEntries(Object.entries(patternCtr).map(([k, v]) => [k, v.reduce((a, b) => a + b, 0) / v.length]));

  const stats: [string, string, string?][] = [
    ["Revenue", formatMoney(revenue, cur, 0)],
    ["Orders", String(live.length)],
    ["Avg selling price", live.length ? formatMoney(revenue / live.length, cur) : "—"],
    ["AI generation cost", formatMoney(aiCost, cur), `$${aiUsd.toFixed(2)}`],
    ["Gross contribution", formatMoney(revenue - fees - aiCost, cur, 0), `after ${formatMoney(fees, cur, 0)} fees`],
    ["Human review time", avgReview != null ? `${Math.round(avgReview / 60)} min` : "—", avgReview == null ? "recorded from Phase 6 reviews" : undefined],
    ["Avg fulfilment", fulfilHours != null ? `${fulfilHours.toFixed(1)} h` : "—", fulfilHours == null ? "no deliveries yet" : undefined],
    ["Revision rate", live.length ? `${Math.round((revisedOrders / live.length) * 100)}%` : "—"],
    ["Avg critic score", avgCritic != null ? avgCritic.toFixed(1) : "—"],
    ["Returning clients", String(returning)],
  ];

  return (
    <>
      <PageHeader title="Analytics" description="Unit economics and what's working. All figures from recorded data; seed/mock costs included." />
      <PageBody className="space-y-5">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border md:grid-cols-5">
          {stats.map(([l, v, sub]) => (
            <div key={l} className="bg-surface px-4 py-3.5"><div className="label-caps">{l}</div><div className="mt-1.5 text-xl font-semibold tabular">{v}</div>{sub && <div className="mt-0.5 text-[11px] text-subtle">{sub}</div>}</div>
          ))}
        </div>
        <div className="grid gap-5 lg:grid-cols-3">
          <Bars title="Jobs by category" data={byCategory} empty="No orders yet" />
          <Bars title="Most-used patterns" data={patternUse} empty="Patterns are counted when concepts use them" />
          <Bars title="Highest-performing patterns" data={ctrRank} empty="Record CTR on delivered jobs to rank patterns" suffix="% CTR" />
        </div>
      </PageBody>
    </>
  );
}

function tally(xs: string[]) { const o: Record<string, number> = {}; for (const x of xs) o[x] = (o[x] ?? 0) + 1; return o; }

function Bars({ title, data, empty, suffix = "" }: { title: string; data: Record<string, number>; empty: string; suffix?: string }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const max = Math.max(...rows.map((r) => r[1]), 1);
  return (
    <Card>
      <CardHeader title={title} />
      <CardBody>
        {rows.length === 0 ? <p className="py-6 text-center text-xs text-muted">{empty}</p> : (
          <ul className="space-y-2">
            {rows.map(([k, v]) => (
              <li key={k} className="text-xs">
                <div className="mb-1 flex justify-between"><span>{k}</span><span className="tabular text-muted">{Number.isInteger(v) ? v : v.toFixed(1)}{suffix}</span></div>
                <div className="h-1.5 rounded-full bg-surface-3"><div className="h-full rounded-full bg-foreground/70" style={{ width: `${(v / max) * 100}%` }} /></div>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}
