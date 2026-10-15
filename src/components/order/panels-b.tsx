import type {
  DB, OrderRow, TrendDnaRow, CreativeBriefRow, ConceptRow, GenerationRow, GenerationImageRow, CompositionRow, ReviewRow,
  DeliverableRow, ActivityRow, AutomationEventRow, PerformanceResultRow,
} from "@/lib/types/db";
import { Card, CardHeader, CardBody } from "@/components/ui/card";
import { Badge, MockBadge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Thumbnail, ScorePill } from "@/components/app/thumbnail";
import { ActionForm } from "@/components/app/action-form";
import { SubmitButton } from "@/components/app/submit-button";
import { CopyButton } from "@/components/app/copy-button";
import { Input, Textarea } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { BUCKETS, signedUrls } from "@/lib/services/uploads";
import { listRevisions } from "@/lib/services/revisions";
import { getSettings, CRITIC_DIMENSIONS } from "@/lib/services/settings";
import { canTransition } from "@/lib/domain/status";
import { createRevisionAction, recordPerformanceAction } from "@/app/(app)/orders/actions";
import { cn, formatDateTime, formatCompact, relativeTime } from "@/lib/utils";

function List({ title, items, tone }: { title: string; items: string[]; tone?: "keep" | "add" | "avoid" | "opp" }) {
  return (
    <div>
      <div className="label-caps mb-2">{title}</div>
      {items.length === 0 ? <p className="text-xs text-subtle">—</p> : (
        <ul className="space-y-1.5">
          {items.map((i) => (
            <li key={i} className="flex gap-2 text-[13px] leading-snug">
              <span className={cn("mt-[7px] size-1 shrink-0 rounded-full", tone === "avoid" ? "bg-danger" : tone === "opp" ? "bg-[var(--tone-review)]" : tone === "add" ? "bg-[var(--tone-approved)]" : "bg-muted")} />{i}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── CREATIVE DNA ────────────────────────────────────────────────────
export async function CreativeDnaPanel({ db, order }: { db: DB; order: OrderRow }) {
  const [{ data: dna }, { data: briefs }] = await Promise.all([
    db.from("trend_dna").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
    db.from("creative_briefs").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1),
  ]);
  const rows = (dna ?? []) as TrendDnaRow[];
  const brief = (briefs?.[0] ?? null) as CreativeBriefRow | null;
  if (!rows.length && !brief) {
    return <EmptyState phase={3} title="Creative DNA not generated yet">Claude vision analyses the selected references into Market DNA, the client&apos;s references into Client DNA and their channel into Channel DNA, then combines them into what to preserve, adopt, avoid and where to differentiate.</EmptyState>;
  }
  const by = (s: TrendDnaRow["source"]) => rows.find((r) => r.source === s);
  const market = by("market");
  return (
    <div className="space-y-5">
      {brief && (
        <Card>
          <CardHeader title="Creative DNA" description={brief.summary ?? undefined} />
          <CardBody className="grid gap-6 md:grid-cols-4">
            <List title="Preserve" items={brief.preserve} tone="keep" />
            <List title="Adopt" items={brief.adopt} tone="add" />
            <List title="Avoid" items={brief.avoid} tone="avoid" />
            <List title="Differentiate" items={brief.differentiate} tone="opp" />
          </CardBody>
        </Card>
      )}
      {market && (
        <Card>
          <CardHeader title={<span className="flex items-center gap-2">Market DNA <MockBadge mode={market.source_mode} /></span>} description={`${market.reference_count} references · ${market.summary ?? ""}`} />
          <CardBody className="grid gap-6 md:grid-cols-3">
            <List title="Common patterns" items={market.common_patterns} />
            <List title="Emerging patterns" items={market.emerging_patterns} tone="add" />
            <List title="Declining patterns" items={market.declining_patterns} tone="avoid" />
            <List title="Visual opportunities" items={market.visual_opportunities} tone="opp" />
            <List title="Overused conventions" items={market.overused_conventions} tone="avoid" />
            <List title="Contrarian opportunities" items={market.contrarian_opportunities} tone="opp" />
          </CardBody>
        </Card>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {(["client", "channel"] as const).map((s) => {
          const d = by(s);
          return (
            <Card key={s}>
              <CardHeader title={s === "client" ? "Client DNA" : "Channel DNA"} description={d?.summary ?? undefined} />
              <CardBody>{d ? <List title="Recurring" items={d.common_patterns} /> : <p className="text-xs text-subtle">Not generated (Phase 3).</p>}</CardBody>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── CONCEPTS ────────────────────────────────────────────────────────
const STRATEGY = { category_leader: "Category leader", current_trend: "Current trend", contrarian: "Contrarian" } as const;

export async function ConceptsPanel({ db, order }: { db: DB; order: OrderRow }) {
  const { data } = await db.from("concepts").select("*, pattern:style_patterns(name)").eq("order_id", order.id).order("slot");
  const concepts = (data ?? []) as (ConceptRow & { pattern: { name: string } | null })[];
  if (!concepts.length) return <EmptyState phase={3} title="No concepts yet">Three genuinely different concepts — A: category leader, B: current trend, C: contrarian — are generated from Creative DNA.</EmptyState>;
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      {concepts.map((c) => (
        <Card key={c.id} className="flex flex-col">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="grid size-6 place-items-center rounded bg-accent text-xs font-bold text-accent-foreground">{c.slot}</span>
              <span className="label-caps">{STRATEGY[c.strategy]}</span>
              <MockBadge mode={c.source_mode} />
              {c.pattern && <Badge className="ml-auto">{c.pattern.name}</Badge>}
            </div>
            <h3 className="mt-2 text-[15px] font-semibold tracking-tight">{c.name}</h3>
            <p className="mt-1 text-[13px] text-muted">{c.visual_hook}</p>
            {c.viewer_question && <p className="mt-2 text-[13px] italic">“{c.viewer_question}”</p>}
          </div>
          <dl className="flex-1 divide-y divide-border text-[12px]">
            {([
              ["Composition", c.composition], ["Foreground", c.foreground], ["Background", c.background], ["Human subject", c.human_subject],
              ["Object", c.object], ["Expression", c.expression], ["Colour", c.colour_strategy], ["Text", c.text_recommendation],
              ["Rationale", c.reference_rationale], ["Why it may work", c.why_it_may_work], ["Risk", c.risk],
            ] as const).map(([k, v]) => v ? (
              <div key={k} className="grid grid-cols-[100px_1fr] gap-2 px-4 py-1.5"><dt className="text-muted">{k}</dt><dd>{v}</dd></div>
            ) : null)}
          </dl>
          {c.generation_prompt && (
            <details className="border-t border-border px-4 py-2.5 text-[11px]">
              <summary className="cursor-pointer text-muted">Generation prompt</summary>
              <p className="mt-2 font-mono leading-relaxed">{c.generation_prompt}</p>
              {c.negative_prompt && <p className="mt-2 font-mono text-subtle">− {c.negative_prompt}</p>}
            </details>
          )}
        </Card>
      ))}
    </div>
  );
}

// ── GENERATIONS ─────────────────────────────────────────────────────
export async function GenerationsPanel({ db, order }: { db: DB; order: OrderRow }) {
  const { data } = await db.from("generations").select("*, concept:concepts(slot, name), images:generation_images(*)").eq("order_id", order.id).order("created_at");
  const gens = (data ?? []) as (GenerationRow & { concept: { slot: string; name: string } | null; images: GenerationImageRow[] })[];
  if (!gens.length) return <EmptyState phase={4} title="No generations yet">Each concept generates four Leonardo candidates (backgrounds, scenes, objects, lighting — never final typography). Completion arrives via the /api/webhooks/leonardo webhook.</EmptyState>;
  const urls = await signedUrls(db, BUCKETS.generations, gens.flatMap((g) => g.images.map((i) => i.storage_path)));
  return (
    <div className="space-y-5">
      {gens.map((g) => (
        <Card key={g.id}>
          <CardHeader
            title={<span className="flex items-center gap-2">{g.concept ? `Concept ${g.concept.slot} — ${g.concept.name}` : "Generation"} <MockBadge mode={g.source_mode} /></span>}
            description={`${g.status} · ${g.model ?? "model?"} · ${g.num_images} images${g.generation_time_ms ? ` · ${(g.generation_time_ms / 1000).toFixed(1)}s` : ""}${g.cost != null ? ` · $${Number(g.cost).toFixed(3)}` : ""}`}
            action={<span className="font-mono text-[10px] text-subtle">{g.provider_generation_id}</span>}
          />
          <CardBody>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {g.images.map((i, n) => <Thumbnail key={i.id} src={(i.storage_path && urls[i.storage_path]) || i.source_url} seed={i.id} label={`${g.concept?.slot ?? ""}${n + 1}`} size="sm" />)}
              {g.images.length === 0 && <p className="col-span-full text-xs text-muted">Waiting for webhook…</p>}
            </div>
          </CardBody>
        </Card>
      ))}
    </div>
  );
}

// ── COMPOSITE ───────────────────────────────────────────────────────
export async function CompositePanel({ db, order }: { db: DB; order: OrderRow }) {
  const { data } = await db.from("compositions").select("*, concept:concepts(slot, name)").eq("order_id", order.id).order("created_at");
  const comps = (data ?? []) as (CompositionRow & { concept: { slot: string; name: string } | null })[];
  if (!comps.length) return <EmptyState phase={5} title="No composites yet">The Sharp + SVG compositor builds 1280×720 thumbnails from layers — the client&apos;s real photo, generated backgrounds, editable typography, strokes, glows, arrows — with a safe zone for YouTube&apos;s duration label.</EmptyState>;
  return (
    <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
      {comps.map((c) => (
        <div key={c.id}>
          <Thumbnail src={null} seed={c.id} label={`${c.concept ? `${c.concept.slot} · ${c.concept.name}` : "Composite"} v${c.version}`}>
            {/* YouTube duration-label safe zone */}
            <div className="pointer-events-none absolute bottom-[3%] right-[2%] h-[11%] w-[13%] rounded-sm border border-dashed border-white/40" title="Duration label safe zone" />
          </Thumbnail>
          <div className="mt-1.5 flex items-center gap-2 text-[11px] text-muted">
            <Badge>{c.status}</Badge>{(c.layers as unknown[]).length} layers
          </div>
        </div>
      ))}
    </div>
  );
}

// ── REVIEW ──────────────────────────────────────────────────────────
export async function ReviewPanel({ db, order }: { db: DB; order: OrderRow }) {
  const [{ data }, { data: reviews }, settings] = await Promise.all([
    db.from("compositions").select("*, concept:concepts(slot, name)").eq("order_id", order.id).order("critic_total", { ascending: false, nullsFirst: false }),
    db.from("reviews").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
    getSettings(db),
  ]);
  const comps = (data ?? []) as (CompositionRow & { concept: { slot: string; name: string } | null })[];
  if (!comps.length) return <EmptyState phase={6} title="Nothing to review yet">Every candidate is scored by the automated critic (10 dimensions, weighted to 100, plus a 1280/320/160 multi-size test) before it reaches human review.</EmptyState>;
  const top = comps.filter((c) => c.critic_verdict !== "reject").slice(0, 3);
  const rejected = comps.filter((c) => c.critic_verdict === "reject");
  return (
    <div className="space-y-5">
      <p className="text-xs text-muted">
        Thresholds: below {settings.critic.rejectBelow} reject · {settings.critic.rejectBelow}–{settings.critic.reviewFrom - 1} marginal · {settings.critic.reviewFrom}+ human review.
        {" "}A human must approve before delivery — use <span className="text-foreground">Move → Approved</span> above. Dedicated approve/edit/regenerate actions and exports arrive in Phase 6.
      </p>
      <div className="grid gap-5 xl:grid-cols-3">
        {top.map((c, i) => (
          <Card key={c.id} className={cn(i === 0 && "ring-1 ring-foreground/30")}>
            <div className="p-3">
              <Thumbnail src={null} seed={c.id} label={c.concept?.name ?? "Candidate"} size="lg">
                <ScorePill value={c.critic_total} className="absolute left-2 top-2 text-xs" />
                {i === 0 && <span className="absolute right-2 top-2 rounded bg-white px-1.5 py-0.5 text-[10px] font-semibold text-black">RECOMMENDED</span>}
              </Thumbnail>
              <div className="mt-3 flex gap-3">
                <div className="w-1/3"><Thumbnail src={null} seed={c.id} label="" size="sm" /><div className="mt-1 text-center text-[10px] text-subtle">320×180</div></div>
                <div className="w-1/6"><Thumbnail src={null} seed={c.id} label="" size="sm" /><div className="mt-1 text-center text-[10px] text-subtle">160×90</div></div>
              </div>
            </div>
            <div className="border-t border-border px-4 py-3">
              <div className="flex items-center gap-2"><span className="label-caps">Concept {c.concept?.slot}</span><Badge>{c.critic_verdict}</Badge></div>
              <p className="mt-1.5 text-[13px] leading-snug">{c.critic_summary}</p>
            </div>
            {c.critic_scores && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 border-t border-border px-4 py-3 text-[11px]">
                {CRITIC_DIMENSIONS.map(([k, label]) => (
                  <div key={k} className="flex items-center justify-between gap-2"><span className="truncate text-muted">{label}</span><span className="tabular">{c.critic_scores![k] ?? "–"}</span></div>
                ))}
              </div>
            )}
          </Card>
        ))}
      </div>
      {rejected.length > 0 && (
        <div>
          <div className="label-caps mb-2">Auto-rejected</div>
          <ul className="space-y-1 text-xs text-muted">{rejected.map((c) => <li key={c.id}>{Math.round(Number(c.critic_total))} — {c.critic_summary}</li>)}</ul>
        </div>
      )}
      {(reviews ?? []).length > 0 && (
        <div>
          <div className="label-caps mb-2">Review history</div>
          <ul className="space-y-1 text-xs">{(reviews as ReviewRow[]).map((r) => <li key={r.id}>{r.decision}{r.is_winner ? " · winner" : ""} — {r.notes} <span className="text-subtle">{relativeTime(r.created_at)}</span></li>)}</ul>
        </div>
      )}
    </div>
  );
}

// ── REVISION ────────────────────────────────────────────────────────
export async function RevisionPanel({ db, order }: { db: DB; order: OrderRow }) {
  const revisions = await listRevisions(db, order.id);
  const canStart = order.status === "REVISION" || canTransition(order.status, "REVISION", "user");
  return (
    <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
      <Card className="self-start">
        <CardHeader title="New revision" description="Paste the customer's feedback exactly as sent. Claude turns it into Preserve / Change / Remove / Add." />
        <CardBody>
          {canStart ? (
            <ActionForm action={createRevisionAction.bind(null, order.id)} resetOnSuccess className="space-y-3">
              <Textarea name="feedback" rows={7} placeholder="e.g. Love the background but can you make my face bigger and remove the arrow? Maybe add our logo." required />
              <SubmitButton pendingLabel="Structuring…">Create revision</SubmitButton>
            </ActionForm>
          ) : <p className="text-xs text-muted">Revisions start once the job is in review, approved or delivered.</p>}
        </CardBody>
      </Card>
      <div className="space-y-4">
        {revisions.length === 0 ? <EmptyState title="No revisions">Revision history is kept here in full.</EmptyState> : revisions.map((r) => (
          <Card key={r.id}>
            <CardHeader title={<span className="flex items-center gap-2">Revision #{r.revision_number} <Badge>{r.status}</Badge> <MockBadge mode={r.source_mode} /></span>} description={formatDateTime(r.created_at)} />
            <CardBody className="space-y-4">
              <blockquote className="border-l-2 border-border pl-3 text-[13px] text-muted whitespace-pre-wrap">{r.raw_feedback}</blockquote>
              {r.structured && (
                <div className="grid gap-5 md:grid-cols-4">
                  <List title="Preserve" items={r.structured.preserve} tone="keep" />
                  <List title="Change" items={r.structured.change} tone="opp" />
                  <List title="Remove" items={r.structured.remove} tone="avoid" />
                  <List title="Add" items={r.structured.add} tone="add" />
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ── DELIVERY ────────────────────────────────────────────────────────
export async function DeliveryPanel({ db, order }: { db: DB; order: OrderRow }) {
  const [{ data: dels }, { data: perf }] = await Promise.all([
    db.from("deliverables").select("*").eq("order_id", order.id).order("created_at"),
    db.from("performance_results").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
  ]);
  const deliverables = (dels ?? []) as DeliverableRow[];
  const urls = await signedUrls(db, BUCKETS.deliverables, deliverables.map((d) => d.storage_path));
  const message = deliverables.find((d) => d.delivery_message)?.delivery_message;
  const approved = ["APPROVED", "READY_TO_DELIVER", "DELIVERED"].includes(order.status);
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-5">
        {deliverables.length === 0 ? (
          <EmptyState phase={6} title={approved ? "Exports not generated yet" : "Not approved yet"}>
            On approval the exporter writes {order.job_id}-final.jpg, -final.png, -preview.jpg, -mobile-preview.jpg and -feed-preview.jpg to storage and drafts the customer delivery message.
          </EmptyState>
        ) : (
          <Card>
            <CardHeader title="Files" />
            <CardBody className="space-y-1">
              {deliverables.map((d) => (
                <div key={d.id} className="flex items-center gap-3 text-[13px]">
                  <span className="font-mono">{d.file_name}</span><Badge>{d.kind}</Badge>
                  {urls[d.storage_path] && <a href={urls[d.storage_path]} className="ml-auto text-xs underline">Download</a>}
                </div>
              ))}
            </CardBody>
          </Card>
        )}
        {message && (
          <Card>
            <CardHeader title="Delivery message" action={<CopyButton text={message} />} />
            <CardBody><p className="whitespace-pre-wrap text-[13px]">{message}</p></CardBody>
          </Card>
        )}
      </div>
      <Card className="self-start">
        <CardHeader title="Performance" description="Record post-publication results. Linked back to the winning concept, pattern and Creative DNA." />
        <CardBody>
          {(perf ?? []).length > 0 && (
            <ul className="mb-4 space-y-1 text-xs">
              {(perf as PerformanceResultRow[]).map((p) => (
                <li key={p.id} className="tabular">{formatCompact(p.impressions)} impr · {p.ctr ?? "–"}% CTR · {formatCompact(p.views)} views {p.ab_test_winner ? "· A/B winner" : ""} <span className="text-subtle">{relativeTime(p.created_at)}</span></li>
              ))}
            </ul>
          )}
          <ActionForm action={recordPerformanceAction.bind(null, order.id)} resetOnSuccess className="space-y-3">
            <Field label="Video URL"><Input name="videoUrl" type="url" placeholder="https://youtube.com/watch?v=…" /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Published"><Input name="publishedAt" type="date" /></Field>
              <Field label="Impressions"><Input name="impressions" inputMode="numeric" /></Field>
              <Field label="CTR %"><Input name="ctr" inputMode="decimal" /></Field>
              <Field label="Views"><Input name="views" inputMode="numeric" /></Field>
              <Field label="Watch time (h)"><Input name="watchTimeHours" inputMode="decimal" /></Field>
              <label className="flex items-end gap-2 pb-2 text-xs text-muted"><input type="checkbox" name="abTestWinner" className="accent-white" />A/B test winner</label>
            </div>
            <Field label="Notes"><Textarea name="notes" rows={2} /></Field>
            <SubmitButton size="sm" variant="secondary">Save results</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>
    </div>
  );
}

// ── ACTIVITY ────────────────────────────────────────────────────────
export async function ActivityPanel({ db, order }: { db: DB; order: OrderRow }) {
  const [{ data: act }, { data: events }, { data: costs }] = await Promise.all([
    db.from("activity_log").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(200),
    db.from("automation_events").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(100),
    db.from("cost_entries").select("*").eq("order_id", order.id).order("created_at", { ascending: false }),
  ]);
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <CardHeader title="Timeline" />
        <ul className="divide-y divide-border">
          {((act ?? []) as ActivityRow[]).map((a) => (
            <li key={a.id} className="flex gap-3 px-4 py-2 text-[13px]">
              <span className="w-[110px] shrink-0 text-[11px] tabular text-subtle">{formatDateTime(a.created_at)}</span>
              <span className="min-w-0 flex-1">{a.message}</span>
              <Badge>{a.actor_type}</Badge>
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-5">
        <Card>
          <CardHeader title="Webhooks & automation" description="Outgoing events and inbound calls for this job" />
          {(events ?? []).length === 0 ? <CardBody><p className="text-xs text-muted">No events yet.</p></CardBody> : (
            <Table>
              <THead><TR><TH>Event</TH><TH>Dir</TH><TH>Status</TH><TH>When</TH></TR></THead>
              <TBody>{((events ?? []) as AutomationEventRow[]).map((e) => (
                <TR key={e.id}><TD className="font-mono text-xs">{e.event_type}</TD><TD className="text-xs text-muted">{e.direction}</TD><TD><Badge>{e.status}{e.response_status ? ` ${e.response_status}` : ""}</Badge></TD><TD className="text-xs text-muted">{relativeTime(e.created_at)}</TD></TR>
              ))}</TBody>
            </Table>
          )}
        </Card>
        <Card>
          <CardHeader title="API costs" />
          {(costs ?? []).length === 0 ? <CardBody><p className="text-xs text-muted">No costs recorded.</p></CardBody> : (
            <Table>
              <THead><TR><TH>Provider</TH><TH>Operation</TH><TH className="text-right">Cost</TH></TR></THead>
              <TBody>{(costs ?? []).map((c) => (
                <TR key={c.id}><TD className="text-xs">{c.provider} <MockBadge mode={c.source_mode} /></TD><TD className="font-mono text-xs text-muted">{c.operation}</TD><TD className="text-right text-xs tabular">${Number(c.cost).toFixed(4)}</TD></TR>
              ))}</TBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
