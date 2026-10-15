import { requireUser } from "@/lib/auth/session";
import { PageHeader, PageBody } from "@/components/app/page-header";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Thumbnail, ScorePill } from "@/components/app/thumbnail";
import { Badge } from "@/components/ui/badge";
import { BUCKETS, signedUrls } from "@/lib/services/uploads";
import { DEFAULT_CATEGORIES } from "@/lib/domain/categories";
import { formatCompact } from "@/lib/utils";
import type { YoutubeReferenceRow } from "@/lib/types/db";

export const metadata = { title: "Reference Library" };

const TAGS = ["large-face", "no-text", "oversized-object", "split-screen", "before-after", "minimal", "high-saturation", "documentary", "luxury", "chaotic", "clean"];
const PERF = ["breakout", "small-channel-winner", "steady", "evergreen"];

export default async function LibraryPage({ searchParams }: { searchParams: Promise<{ q?: string; category?: string; tag?: string; perf?: string; sort?: string }> }) {
  const sp = await searchParams;
  const { db } = await requireUser();
  let q = db.from("youtube_references").select("*").eq("excluded", false).limit(120);
  if (sp.q) q = q.ilike("title", `%${sp.q.replace(/[%,]/g, " ")}%`);
  if (sp.category) q = q.eq("category", sp.category);
  if (sp.tag) q = q.contains("tags", [sp.tag]);
  if (sp.perf) q = q.eq("performance_type", sp.perf);
  q = sp.sort === "recent" ? q.order("published_at", { ascending: false }) : sp.sort === "velocity" ? q.order("views_per_day", { ascending: false }) : q.order("reference_score", { ascending: false });
  const { data } = await q;
  const refs = (data ?? []) as YoutubeReferenceRow[];
  const urls = await signedUrls(db, BUCKETS.research, refs.map((r) => r.stored_image_path));

  return (
    <>
      <PageHeader title="Reference Library" description="Every scored market reference, searchable by category, performance and visual pattern. Analysis material only." />
      <PageBody className="space-y-5">
        <form className="flex flex-wrap items-end gap-2">
          <Input name="q" defaultValue={sp.q} placeholder="Search titles" className="w-56" />
          <Select name="category" defaultValue={sp.category ?? ""} className="w-40"><option value="">All categories</option>{DEFAULT_CATEGORIES.map((c) => <option key={c}>{c}</option>)}</Select>
          <Select name="perf" defaultValue={sp.perf ?? ""} className="w-44"><option value="">Any performance</option>{PERF.map((p) => <option key={p}>{p}</option>)}</Select>
          <Select name="tag" defaultValue={sp.tag ?? ""} className="w-40"><option value="">Any pattern</option>{TAGS.map((t) => <option key={t}>{t}</option>)}</Select>
          <Select name="sort" defaultValue={sp.sort ?? ""} className="w-36"><option value="">Top score</option><option value="velocity">Velocity</option><option value="recent">Newest</option></Select>
          <Button type="submit" variant="secondary">Filter</Button>
        </form>
        <div className="flex flex-wrap gap-1">
          {TAGS.map((t) => <a key={t} href={`/library?${new URLSearchParams({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v)), tag: t } as Record<string, string>)}`}><Badge className={sp.tag === t ? "border-border-strong text-foreground" : "hover:text-foreground"}>{t}</Badge></a>)}
        </div>
        {refs.length === 0 ? <EmptyState title="No references match">References from every research run collect here. AI tagging arrives with vision analysis (Phase 3).</EmptyState> : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-4 xl:grid-cols-6">
            {refs.map((r) => (
              <div key={r.id}>
                <Thumbnail src={(r.stored_image_path && urls[r.stored_image_path]) || r.thumbnail_url} seed={r.video_id} label={r.title} size="sm">
                  <ScorePill value={r.reference_score} className="absolute left-1 top-1" />
                </Thumbnail>
                <p className="mt-1.5 line-clamp-2 text-[11px] leading-snug">{r.title}</p>
                <p className="mt-0.5 text-[10px] tabular text-subtle">{r.category} · {formatCompact(r.views_per_day)}/day</p>
                <div className="mt-1 flex flex-wrap gap-0.5">{r.tags.slice(0, 3).map((t) => <span key={t} className="rounded bg-surface-3 px-1 text-[9px] text-muted">{t}</span>)}</div>
              </div>
            ))}
          </div>
        )}
      </PageBody>
    </>
  );
}
