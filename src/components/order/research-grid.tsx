"use client";
import { useMemo, useOptimistic, useState, useTransition } from "react";
import { Check, Ban, Star, Lock, ExternalLink } from "lucide-react";
import { Thumbnail, ScorePill } from "@/components/app/thumbnail";
import { referenceFlagAction } from "@/app/(app)/orders/actions";
import type { YoutubeReferenceRow } from "@/lib/types/db";
import type { ReferenceFlag } from "@/lib/services/research/pipeline";
import { cn, formatCompact } from "@/lib/utils";

export type GridRef = Pick<YoutubeReferenceRow,
  "id" | "video_id" | "title" | "channel_title" | "channel_subscribers" | "view_count" | "age_days" | "views_per_day" | "reference_score" |
  "velocity_score" | "recency_score" | "outperformance_score" | "relevance_score" | "novelty_score" | "performance_type" | "rank" |
  "included" | "excluded" | "favourite" | "locked" | "tags"> & { imageUrl: string | null; linkable: boolean };

const FILTERS = [
  ["top", "Top References"], ["recent", "Recent"], ["breakouts", "Breakouts"], ["velocity", "Highest Velocity"],
  ["largest", "Largest"], ["small", "Small Channel Winners"], ["outliers", "Visual Outliers"], ["all", "All"],
] as const;
type Filter = (typeof FILTERS)[number][0];

function apply(refs: GridRef[], f: Filter) {
  const by = (k: keyof GridRef) => (a: GridRef, b: GridRef) => Number(b[k] ?? -1) - Number(a[k] ?? -1);
  switch (f) {
    case "top": return refs.filter((r) => r.included && !r.excluded).sort(by("reference_score"));
    case "recent": return refs.filter((r) => Number(r.age_days) <= 30).sort((a, b) => Number(a.age_days) - Number(b.age_days));
    case "breakouts": return refs.filter((r) => r.performance_type === "breakout").sort(by("views_per_day"));
    case "velocity": return [...refs].sort(by("views_per_day"));
    case "largest": return [...refs].sort(by("view_count"));
    case "small": return refs.filter((r) => r.performance_type === "small-channel-winner" || (r.channel_subscribers ?? Infinity) < 100_000).sort(by("outperformance_score"));
    case "outliers": return refs.filter((r) => r.novelty_score != null).sort(by("novelty_score"));
    default: return [...refs].sort((a, b) => (a.rank ?? 999) - (b.rank ?? 999));
  }
}

export function ResearchGrid({ refs, jobId }: { refs: GridRef[]; jobId: string }) {
  const [filter, setFilter] = useState<Filter>("top");
  const [error, setError] = useState<string | null>(null);
  const [, start] = useTransition();
  const [optimistic, setOptimistic] = useOptimistic(refs, (state, u: { id: string; patch: Partial<GridRef> }) =>
    state.map((r) => (r.id === u.id ? { ...r, ...u.patch } : r)));
  const visible = useMemo(() => apply(optimistic, filter), [optimistic, filter]);
  const counts = useMemo(() => Object.fromEntries(FILTERS.map(([k]) => [k, apply(optimistic, k).length])), [optimistic]);

  function toggle(r: GridRef, flag: ReferenceFlag) {
    const value = !r[flag];
    const patch: Partial<GridRef> = { [flag]: value };
    if (flag === "excluded" && value) patch.included = false;
    if (flag === "included" && value) patch.excluded = false;
    if (flag === "locked" && value) { patch.included = true; patch.excluded = false; }
    start(async () => {
      setError(null);
      setOptimistic({ id: r.id, patch });
      const res = await referenceFlagAction(r.id, flag, value, jobId);
      if (!res.ok) setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1">
        {FILTERS.map(([k, label]) => (
          <button key={k} onClick={() => setFilter(k)} className={cn("flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs", filter === k ? "border-border-strong bg-surface-3 text-foreground" : "border-transparent text-muted hover:text-foreground")}>
            {label}<span className="tabular text-subtle">{counts[k]}</span>
          </button>
        ))}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      {visible.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-4 py-8 text-center text-xs text-muted">
          {filter === "outliers" ? "Visual novelty scores come from Claude vision analysis (Phase 3)." : "No references match this filter."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {visible.map((r) => (
            <article key={r.id} className={cn("group", r.excluded && "opacity-40")}>
              <Thumbnail src={r.imageUrl} seed={r.video_id} label={r.title} className={cn(r.included && !r.excluded && "ring-1 ring-foreground/50")}>
                <ScorePill value={r.reference_score} className="absolute left-1.5 top-1.5" />
                <div className="absolute right-1.5 top-1.5 flex gap-1">
                  {r.locked && <Lock className="size-3.5 rounded bg-black/70 p-0.5 text-white" />}
                  {r.favourite && <Star className="size-3.5 rounded bg-black/70 p-0.5 text-white" fill="currentColor" />}
                </div>
                <div className="absolute inset-x-1.5 bottom-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100 max-lg:opacity-100">
                  <FlagButton on={r.included} onClick={() => toggle(r, "included")} label="Include"><Check /></FlagButton>
                  <FlagButton on={r.excluded} onClick={() => toggle(r, "excluded")} label="Exclude"><Ban /></FlagButton>
                  <FlagButton on={r.favourite} onClick={() => toggle(r, "favourite")} label="Favourite"><Star /></FlagButton>
                  <FlagButton on={r.locked} onClick={() => toggle(r, "locked")} label="Lock"><Lock /></FlagButton>
                  {r.linkable && (
                    <a href={`https://www.youtube.com/watch?v=${r.video_id}`} target="_blank" rel="noreferrer" className="ml-auto grid size-6 place-items-center rounded bg-black/70 text-white/80 hover:text-white" title="Open on YouTube"><ExternalLink className="size-3" /></a>
                  )}
                </div>
              </Thumbnail>
              <h4 className="mt-2 line-clamp-2 text-[12px] font-medium leading-snug">{r.title}</h4>
              <div className="mt-0.5 truncate text-[11px] text-muted">{r.channel_title}{r.channel_subscribers ? ` · ${formatCompact(r.channel_subscribers)} subs` : ""}</div>
              <div className="mt-1 flex flex-wrap gap-x-2.5 text-[11px] tabular text-subtle">
                <span>{formatCompact(r.view_count)} views</span>
                <span>{Math.round(Number(r.age_days))}d</span>
                <span className="text-muted">{formatCompact(r.views_per_day)}/day</span>
              </div>
              <div className="mt-1 text-[10px] tabular text-subtle" title="velocity / recency / outperformance / relevance / novelty">
                V{fmt(r.velocity_score)} · R{fmt(r.recency_score)} · O{fmt(r.outperformance_score)} · S{fmt(r.relevance_score)} · N{fmt(r.novelty_score)}
                {r.performance_type && r.performance_type !== "steady" && <span className="ml-1.5 rounded border border-border px-1">{r.performance_type}</span>}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

const fmt = (n: number | null) => (n == null ? "–" : Math.round(Number(n)));

function FlagButton({ on, onClick, label, children }: { on: boolean; onClick: () => void; label: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} title={label} aria-pressed={on}
      className={cn("grid size-6 place-items-center rounded [&_svg]:size-3", on ? "bg-white text-black" : "bg-black/70 text-white/80 hover:text-white")}>
      {children}
    </button>
  );
}
