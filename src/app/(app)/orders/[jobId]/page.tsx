import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { getOrder } from "@/lib/services/orders";
import { ServiceError } from "@/lib/services/errors";
import { StatusBadge, PipelineBar } from "@/components/app/status";
import { OrderTabs, isOrderTab, type OrderTab } from "@/components/order/tabs";
import { TransitionControls } from "@/components/order/transition-controls";
import { OverviewPanel, ResearchPanel, ReferencesPanel } from "@/components/order/panels-a";
import {
  CreativeDnaPanel, ConceptsPanel, GenerationsPanel, CompositePanel, ReviewPanel, RevisionPanel, DeliveryPanel, ActivityPanel,
} from "@/components/order/panels-b";
import { marketplaceLabel } from "@/lib/domain/categories";
import { relativeTime, cn } from "@/lib/utils";
import type { ClientRow, ChannelRow, OrderRow } from "@/lib/types/db";

export async function generateMetadata({ params }: { params: Promise<{ jobId: string }> }) {
  return { title: (await params).jobId.toUpperCase() };
}

export default async function OrderPage({ params, searchParams }: { params: Promise<{ jobId: string }>; searchParams: Promise<{ tab?: string; uploadError?: string }> }) {
  const [{ jobId }, sp] = await Promise.all([params, searchParams]);
  const { db } = await requireUser();

  let order: OrderRow;
  try { order = await getOrder(db, jobId); } catch (e) { if (e instanceof ServiceError && e.status === 404) notFound(); throw e; }

  const tab: OrderTab = isOrderTab(sp.tab) ? sp.tab : "overview";
  const count = (table: string, col = "order_id") => db.from(table).select("id", { count: "exact", head: true }).eq(col, order.id);
  const [{ data: client }, { data: channel }, refs, concepts, gens, comps, revs] = await Promise.all([
    order.client_id ? db.from("clients").select("*").eq("id", order.client_id).single() : Promise.resolve({ data: null }),
    order.channel_id ? db.from("channels").select("*").eq("id", order.channel_id).single() : Promise.resolve({ data: null }),
    count("client_references"), count("concepts"), count("generations"), count("compositions"), count("revisions"),
  ]);

  const late = order.deadline && new Date(order.deadline) < new Date() && !["DELIVERED", "CANCELLED"].includes(order.status);
  const props = { db, order };

  return (
    <>
      <header className="space-y-4 border-b border-border px-6 pb-4 pt-5 max-md:px-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <Link href="/orders" className="hover:text-foreground">Orders</Link><span className="text-subtle">/</span>
              <span className="font-mono text-foreground">{order.job_id}</span>
              <StatusBadge status={order.status} />
            </div>
            <h1 className="mt-2 max-w-3xl text-xl font-semibold tracking-tight">{order.video_title}</h1>
            <div className="mt-1 flex flex-wrap gap-x-3 text-xs text-muted">
              {client && <Link href={`/clients/${(client as ClientRow).id}`} className="hover:text-foreground">{(client as ClientRow).name}</Link>}
              <span>{marketplaceLabel(order.marketplace)}{order.marketplace_order_id ? ` · ${order.marketplace_order_id}` : ""}</span>
              {order.category && <span>{order.category}</span>}
              {order.deadline && <span className={cn(late && "text-danger")}>Due {relativeTime(order.deadline)}</span>}
            </div>
          </div>
          <TransitionControls orderId={order.id} status={order.status} />
        </div>
        <PipelineBar status={order.status} />
        {sp.uploadError && <p className="rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-xs text-danger">Job created, but an upload failed: {sp.uploadError}. Re-upload from Overview or References.</p>}
      </header>
      <OrderTabs jobId={order.job_id} active={tab} counts={{ references: refs.count ?? 0, concepts: concepts.count ?? 0, generations: gens.count ?? 0, composite: comps.count ?? 0, revision: revs.count ?? 0 }} />
      <div className="px-6 py-5 max-md:px-4">
        {tab === "overview" && <OverviewPanel {...props} client={client as ClientRow | null} channel={channel as ChannelRow | null} />}
        {tab === "research" && <ResearchPanel {...props} />}
        {tab === "references" && <ReferencesPanel {...props} />}
        {tab === "creative-dna" && <CreativeDnaPanel {...props} />}
        {tab === "concepts" && <ConceptsPanel {...props} />}
        {tab === "generations" && <GenerationsPanel {...props} />}
        {tab === "composite" && <CompositePanel {...props} />}
        {tab === "review" && <ReviewPanel {...props} />}
        {tab === "revision" && <RevisionPanel {...props} />}
        {tab === "delivery" && <DeliveryPanel {...props} />}
        {tab === "activity" && <ActivityPanel {...props} />}
      </div>
    </>
  );
}
