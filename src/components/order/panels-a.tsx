import Link from "next/link";
import type { DB, OrderRow, ClientRow, ChannelRow, OrderAssetRow, ClientReferenceRow, YoutubeReferenceRow, ResearchRunRow } from "@/lib/types/db";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, MockBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Thumbnail } from "@/components/app/thumbnail";
import { Uploader } from "@/components/app/uploader";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { ResearchGrid, type GridRef } from "./research-grid";
import { DeleteAssetButton } from "./delete-asset-button";
import { DetectCategoryButton } from "./detect-category-button";
import { BUCKETS, signedUrls } from "@/lib/services/uploads";
import { getOrderEconomics } from "@/lib/services/costs";
import { marketplaceLabel, DEFAULT_CATEGORIES } from "@/lib/domain/categories";
import { updateOrderAction, addReferenceUrlsAction } from "@/app/(app)/orders/actions";
import { formatDateTime, formatMoney, formatCompact } from "@/lib/utils";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 border-b border-border py-2 text-[13px] last:border-0 max-sm:grid-cols-1 max-sm:gap-0.5">
      <dt className="text-muted">{label}</dt><dd className="min-w-0 break-words">{children || <span className="text-subtle">—</span>}</dd>
    </div>
  );
}

// ── OVERVIEW ────────────────────────────────────────────────────────
export async function OverviewPanel({ db, order, client, channel }: { db: DB; order: OrderRow; client: ClientRow | null; channel: ChannelRow | null }) {
  const [{ data: assetRows }, econ] = await Promise.all([
    db.from("order_assets").select("*").eq("order_id", order.id).order("created_at"),
    getOrderEconomics(db, order),
  ]);
  const assets = (assetRows ?? []) as OrderAssetRow[];
  const urls = await signedUrls(db, BUCKETS.orderAssets, assets.map((a) => a.storage_path));
  const local = (d: string | null) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");

  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="space-y-5">
        <Card>
          <CardHeader title="Brief" />
          <CardBody className="py-1">
            <dl>
              <Row label="Video title">{order.video_title}</Row>
              <Row label="Description"><span className="whitespace-pre-wrap">{order.video_description}</span></Row>
              <Row label="Requested text">{order.requested_text}</Row>
              <Row label="Category">
                <span className="inline-flex items-center gap-2">
                  {order.category}
                  {order.detected_category && <Badge>detected {order.detected_category} · {Math.round(Number(order.category_confidence ?? 0) * 100)}%</Badge>}
                  <DetectCategoryButton orderId={order.id} />
                </span>
              </Row>
              <Row label="Client notes"><span className="whitespace-pre-wrap">{order.client_notes}</span></Row>
              <Row label="Things to avoid"><span className="whitespace-pre-wrap">{order.things_to_avoid}</span></Row>
              <Row label="Channel">{order.channel_url && <a href={order.channel_url} target="_blank" rel="noreferrer" className="underline-offset-2 hover:underline">{order.channel_url}</a>}</Row>
              <Row label="Marketplace">{marketplaceLabel(order.marketplace)}{order.marketplace_order_id ? ` · ${order.marketplace_order_id}` : ""}</Row>
              <Row label="Deadline">{order.deadline ? formatDateTime(order.deadline) : null}</Row>
            </dl>
          </CardBody>
          <details className="group border-t border-border">
            <summary className="cursor-pointer list-none px-4 py-2.5 text-xs text-muted hover:text-foreground">Edit brief</summary>
            <ActionForm action={updateOrderAction.bind(null, order.id)} className="space-y-3 px-4 pb-4">
              <Field label="Video title"><Input name="videoTitle" defaultValue={order.video_title} required /></Field>
              <Field label="Description"><Textarea name="videoDescription" defaultValue={order.video_description ?? ""} rows={3} /></Field>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Requested text"><Input name="requestedText" defaultValue={order.requested_text ?? ""} /></Field>
                <Field label="Category">
                  <Input name="category" defaultValue={order.category ?? ""} list="categories" />
                  <datalist id="categories">{DEFAULT_CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                </Field>
              </div>
              <Field label="Client notes"><Textarea name="clientNotes" defaultValue={order.client_notes ?? ""} rows={2} /></Field>
              <Field label="Things to avoid"><Textarea name="thingsToAvoid" defaultValue={order.things_to_avoid ?? ""} rows={2} /></Field>
              <Field label="Deadline"><Input name="deadline" type="datetime-local" defaultValue={local(order.deadline)} /></Field>
              <SubmitButton size="sm" pendingLabel="Saving…">Save brief</SubmitButton>
            </ActionForm>
          </details>
        </Card>

        <Card>
          <CardHeader title="Client assets" description="Production material supplied by the client. Real photos of the client are preserved, not regenerated." />
          <CardBody className="space-y-4">
            {assets.length > 0 && (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {assets.map((a) => (
                  <div key={a.id} className="group relative">
                    <Thumbnail src={a.mime_type?.startsWith("image/") ? urls[a.storage_path] : null} seed={a.id} label={a.file_name} size="sm" className="aspect-square" />
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Badge>{a.kind.replace("_", " ")}</Badge>
                      {a.width && <span className="text-[10px] tabular text-subtle">{a.width}×{a.height}</span>}
                      <DeleteAssetButton assetId={a.id} />
                    </div>
                    <div className="mt-0.5 truncate text-[11px] text-muted">{a.file_name}</div>
                  </div>
                ))}
              </div>
            )}
            <div className="grid gap-2 sm:grid-cols-3">
              <Uploader target={{ scope: "order_asset", orderId: order.id, kind: "face_photo" }} label="Add face photos" compact />
              <Uploader target={{ scope: "order_asset", orderId: order.id, kind: "logo" }} label="Add logos" compact />
              <Uploader target={{ scope: "order_asset", orderId: order.id, kind: "client_asset" }} label="Add other assets" accept="image/*,.ttf,.otf,.woff,.woff2,.zip,.pdf" compact />
            </div>
          </CardBody>
        </Card>
      </div>

      <div className="space-y-5">
        <Card>
          <CardHeader title="Economics" description="Sale price, fees and recorded API cost" />
          <CardBody className="py-1">
            <dl>
              <Row label="Sale price">{formatMoney(econ.salePrice, econ.currency)}</Row>
              <Row label="Marketplace fee">{formatMoney(econ.marketplaceFee, econ.currency)}</Row>
              <Row label="Production cost">{formatMoney(econ.productionCost, econ.currency)} <span className="text-subtle">(${econ.productionCostUsd.toFixed(3)})</span></Row>
              {Object.entries(econ.byProvider).map(([p, v]) => <Row key={p} label={`· ${p}`}><span className="text-muted">${v.toFixed(4)}</span></Row>)}
              <Row label="Est. margin"><span className="font-medium">{formatMoney(econ.margin, econ.currency)}</span> <span className="text-subtle">({econ.marginPct.toFixed(0)}%)</span></Row>
            </dl>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Client" action={client && <Link href={`/clients/${client.id}`} className="text-xs text-muted hover:text-foreground">Profile →</Link>} />
          <CardBody className="py-1">
            {client ? (
              <dl>
                <Row label="Name">{client.name}</Row>
                <Row label="Brand colours">{client.brand_colours.length > 0 && <span className="flex gap-1">{client.brand_colours.map((c) => <span key={c} title={c} className="size-4 rounded-sm border border-border" style={{ background: c }} />)}</span>}</Row>
                <Row label="Fonts">{client.preferred_fonts.join(", ")}</Row>
                <Row label="Preferences">{client.visual_preferences}</Row>
                <Row label="Avoid">{client.things_to_avoid}</Row>
              </dl>
            ) : <p className="py-3 text-xs text-muted">No client profile attached.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Channel" />
          <CardBody className="py-1">
            {channel ? (
              <dl>
                <Row label="Channel">{channel.title ?? channel.handle ?? channel.url}</Row>
                <Row label="Subscribers">{channel.subscriber_count ? formatCompact(channel.subscriber_count) : null}</Row>
                <Row label="Locked">{channel.locked_characteristics.filter((l) => l.locked).map((l) => <div key={l.label}>{l.label}</div>)}</Row>
              </dl>
            ) : <p className="py-3 text-xs text-muted">No channel linked.</p>}
          </CardBody>
        </Card>
        <p className="px-1 text-[11px] text-subtle">Created {formatDateTime(order.created_at)} · status since {formatDateTime(order.status_changed_at)}</p>
      </div>
    </div>
  );
}

// ── RESEARCH ────────────────────────────────────────────────────────
export async function ResearchPanel({ db, order }: { db: DB; order: OrderRow }) {
  const { data: runs } = await db.from("research_runs").select("*").eq("order_id", order.id).order("created_at", { ascending: false });
  const run = (runs?.[0] ?? null) as ResearchRunRow | null;
  if (!run) {
    return <EmptyState title="No research yet">Start research from the controls above. Claude writes search queries, YouTube is searched with a date filter, and every result is scored for velocity, recency, outperformance and relevance.</EmptyState>;
  }
  const { data: refRows } = await db.from("youtube_references").select("*").eq("research_run_id", run.id).order("rank");
  const refs = (refRows ?? []) as YoutubeReferenceRow[];
  const stored = await signedUrls(db, BUCKETS.research, refs.map((r) => r.stored_image_path));
  const gridRefs: GridRef[] = refs.map((r) => ({ ...r, imageUrl: (r.stored_image_path && stored[r.stored_image_path]) || r.thumbnail_url, linkable: run.source === "live" }));
  const selected = refs.filter((r) => r.included && !r.excluded).length;

  return (
    <div className="space-y-5">
      <Card>
        <CardBody className="flex flex-wrap items-start gap-x-8 gap-y-3">
          <Meta label="Run">{formatDateTime(run.completed_at ?? run.created_at)} <MockBadge mode={run.source} /></Meta>
          <Meta label="Status">{run.status}{run.error ? ` — ${run.error}` : ""}</Meta>
          <Meta label="Videos">{run.video_count} found · {selected} selected</Meta>
          <Meta label="Weights">{run.scoring_weights ? Object.entries(run.scoring_weights).map(([k, v]) => `${k} ${v}`).join(" · ") : "—"}</Meta>
          <div className="w-full">
            <div className="label-caps mb-1.5">Queries</div>
            <div className="flex flex-wrap gap-1">{run.queries.map((q) => <Badge key={q} mono>{q}</Badge>)}</div>
          </div>
          <p className="w-full text-[11px] text-subtle">Contact sheet generation arrives in Phase 2. Market references are analysis material only — never production artwork.</p>
        </CardBody>
      </Card>
      <ResearchGrid refs={gridRefs} jobId={order.job_id} />
      {(runs?.length ?? 0) > 1 && <p className="text-[11px] text-subtle">{runs!.length - 1} earlier run(s) kept for history.</p>}
    </div>
  );
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div className="label-caps mb-1">{label}</div><div className="flex items-center gap-1.5 text-[13px]">{children}</div></div>;
}

// ── REFERENCES (client-supplied) ────────────────────────────────────
export async function ReferencesPanel({ db, order }: { db: DB; order: OrderRow }) {
  const { data } = await db.from("client_references").select("*").eq("order_id", order.id).order("created_at");
  const refs = (data ?? []) as ClientReferenceRow[];
  const urls = await signedUrls(db, BUCKETS.orderAssets, refs.map((r) => r.storage_path));
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card>
        <CardHeader title="Client references" description="What the client pointed at. Feeds Client DNA; kept with this job." />
        <CardBody>
          {refs.length === 0 ? <EmptyState title="No client references">Upload images or paste URLs on the right.</EmptyState> : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
              {refs.map((r) => (
                <div key={r.id}>
                  {r.source === "upload"
                    ? <Thumbnail src={r.storage_path ? urls[r.storage_path] : null} seed={r.id} label={r.file_name ?? "upload"} />
                    : <a href={r.url!} target="_blank" rel="noreferrer"><Thumbnail src={youtubeThumb(r.url)} seed={r.id} label={r.url ?? ""} /></a>}
                  <div className="mt-1.5 flex items-center gap-1.5"><Badge>{r.source}</Badge><span className="truncate text-[11px] text-muted">{r.file_name ?? r.url}</span></div>
                  {r.note && <p className="mt-0.5 text-[11px] text-subtle">{r.note}</p>}
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
      <div className="space-y-5">
        <Card><CardHeader title="Upload reference images" /><CardBody><Uploader target={{ scope: "order_reference", orderId: order.id }} /></CardBody></Card>
        <Card>
          <CardHeader title="Paste reference URLs" />
          <CardBody>
            <ActionForm action={addReferenceUrlsAction.bind(null, order.id)} resetOnSuccess className="space-y-2">
              <Textarea name="urls" rows={4} placeholder="One URL per line" className="font-mono text-xs" />
              <SubmitButton size="sm" variant="secondary">Add URLs</SubmitButton>
            </ActionForm>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function youtubeThumb(url: string | null) {
  const m = url?.match(/(?:v=|youtu\.be\/|shorts\/)([\w-]{11})/);
  return m ? `https://i.ytimg.com/vi/${m[1]}/hqdefault.jpg` : null;
}

