import type { DB, OrderRow, ResearchRunRow } from "@/lib/types/db";
import type { Actor } from "@/lib/domain/actor";
import { getClaude } from "@/lib/adapters/claude";
import { integrationModes } from "@/lib/env";
import { createYouTube, type VideoHit } from "@/lib/adapters/youtube";
import { slugify } from "@/lib/utils";
import { logActivity } from "../activity";
import { claudeCost, recordCost } from "../costs";
import { getSettings } from "../settings";
import { getOrder, transitionOrder } from "../orders";
import { BUCKETS } from "../uploads";
import { ServiceError } from "../errors";
import { scoreCandidates, type Candidate } from "./scoring";

/**
 * Research pipeline for an order:
 *   Claude → search queries → YouTube search (date-filtered) → video &
 *   channel stats → scoring → store references → download the selected
 *   thumbnails into the run's storage folder → RESEARCH_COMPLETE.
 *
 * Downloaded thumbnails are research material only and are stored under
 * research/<run>/images — never in production asset buckets.
 */
export async function runOrderResearch(db: DB, idOrJobId: string, actor: Actor): Promise<ResearchRunRow> {
  let order = await getOrder(db, idOrJobId);
  if (!["NEW", "RESEARCH_COMPLETE", "RESEARCHING"].includes(order.status)) {
    throw new ServiceError(`${order.job_id} is ${order.status}; research can run from NEW or RESEARCH_COMPLETE`, 409, "invalid_state");
  }
  if (order.status !== "RESEARCHING") order = await transitionOrder(db, order.id, "RESEARCHING", actor);

  const settings = await getSettings(db);
  const { data: runRow, error } = await db.from("research_runs").insert({
    order_id: order.id, kind: "order", topic: order.video_title, category: order.category,
    slug: `${order.job_id.toLowerCase()}-${new Date().toISOString().slice(0, 10)}`,
    params: { ...settings.research }, scoring_weights: settings.scoring_weights, status: "running", started_at: new Date().toISOString(),
    source: integrationModes().youtube === "live" && integrationModes().claude === "live" ? "live" : "mock",
    created_by: actor.userId ?? null,
  }).select("*").single();
  if (error || !runRow) throw new ServiceError(`Could not create research run: ${error?.message}`, 500);
  const run = runRow as ResearchRunRow;

  try {
    const result = await executeResearch(db, run, {
      title: order.video_title, description: order.video_description, category: order.category,
      channelContext: order.channel_url, requestedText: order.requested_text, orderId: order.id,
    });
    await transitionOrder(db, order.id, "RESEARCH_COMPLETE", { type: "system", label: "research" });
    await logActivity(db, {
      orderId: order.id, actor, action: "research.complete",
      message: `Research complete — ${result.videoCount} videos, ${result.selected} selected${result.mode === "mock" ? " · dev mock data" : ""}`,
      data: { runId: run.id },
    });
    return result.run;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    await db.from("research_runs").update({ status: "failed", error: message.slice(0, 1000), completed_at: new Date().toISOString() }).eq("id", run.id);
    await logActivity(db, { orderId: order.id, actor, action: "research.failed", message: `Research failed: ${message.slice(0, 200)}` });
    await transitionOrder(db, order.id, "NEW", { type: "system", label: "research" }, "research failed").catch(() => {});
    throw e;
  }
}

interface ResearchContext {
  title: string; description?: string | null; category?: string | null; channelContext?: string | null; requestedText?: string | null; orderId?: string | null;
}

/** Shared by order research and (later) Reference Hunt / monthly refresh. */
export async function executeResearch(db: DB, run: ResearchRunRow, ctx: ResearchContext) {
  const settings = await getSettings(db);
  const cfg = { ...settings.research, ...(run.params as Partial<typeof settings.research>) };
  const claude = getClaude();
  const youtube = createYouTube();

  // 1. Queries
  const q = await claude.generateSearchQueries({ ...ctx, count: cfg.queryCount });
  await recordCost(db, { orderId: ctx.orderId, researchRunId: run.id, provider: "anthropic", operation: "research.queries", cost: claudeCost(q.usage.model, q.usage.inputTokens, q.usage.outputTokens), units: { ...q.usage }, mode: q.mode });
  const queries = q.result.queries;

  // 2. Search, date-filtered, deduplicated
  const publishedAfter = new Date(Date.now() - cfg.publishedWithinDays * 86_400_000);
  const perQuery = Math.max(5, Math.ceil((cfg.maxVideos * 1.5) / queries.length));
  const hits = new Map<string, VideoHit & { queries: string[] }>();
  for (const query of queries) {
    const results = await youtube.search(query, { maxResults: Math.min(perQuery, 25), publishedAfter });
    for (const h of results) {
      const existing = hits.get(h.videoId);
      if (existing) existing.queries.push(query);
      else hits.set(h.videoId, { ...h, queries: [query] });
    }
  }

  // 3. Stats
  const ids = [...hits.keys()];
  const stats = new Map((await youtube.videoStats(ids)).map((s) => [s.videoId, s]));
  const channelIds = [...new Set([...hits.values()].map((h) => h.channelId))];
  const channelStats = new Map((await youtube.channelStats(channelIds)).map((c) => [c.channelId, c]));

  const candidates: Candidate[] = [...hits.values()].filter((h) => stats.has(h.videoId)).map((h) => ({
    videoId: h.videoId, title: h.title, publishedAt: h.publishedAt, viewCount: stats.get(h.videoId)!.viewCount,
    channelSubscribers: channelStats.get(h.channelId)?.subscriberCount ?? null, matchedQueries: h.queries,
  }));

  // 4. Score and keep the strongest `maxVideos`
  const context = [ctx.title, q.result.topic, ctx.category ?? ""].join(" ");
  const scored = scoreCandidates(candidates, { weights: settings.scoring_weights, context, totalQueries: queries.length }).slice(0, cfg.maxVideos);

  const rows = scored.map((s) => {
    const h = hits.get(s.videoId)!;
    const st = stats.get(s.videoId)!;
    return {
      research_run_id: run.id, video_id: s.videoId, title: s.title, description: h.description?.slice(0, 2000) ?? null,
      channel_id: h.channelId, channel_title: h.channelTitle, channel_subscribers: s.channelSubscribers,
      published_at: s.publishedAt, view_count: s.viewCount, like_count: st.likeCount, comment_count: st.commentCount, duration: st.duration,
      thumbnail_url: h.thumbnailUrl, matched_query: h.queries.join(" | "), category: ctx.category ?? null,
      age_days: s.ageDays, views_per_day: s.viewsPerDay, velocity_score: s.velocityScore, recency_score: s.recencyScore,
      outperformance_score: s.outperformanceScore, relevance_score: s.relevanceScore, novelty_score: s.noveltyScore,
      reference_score: s.referenceScore, rank: s.rank, performance_type: s.performanceType, included: s.rank <= cfg.autoIncludeTop,
    };
  });
  if (rows.length) {
    const { error } = await db.from("youtube_references").insert(rows);
    if (error) throw new ServiceError(`Saving references failed: ${error.message}`, 500);
  }

  await recordCost(db, { orderId: ctx.orderId, researchRunId: run.id, provider: "youtube", operation: "search+videos", cost: 0, units: { quotaUnits: youtube.quotaUsed() }, mode: youtube.mode });

  // 5. Download selected thumbnails (live only — mocks have no images)
  const prefix = run.storage_prefix ?? `orders/${run.slug ?? slugify(ctx.title)}-${run.id.slice(0, 8)}`;
  const downloaded = await downloadThumbnails(db, run.id, prefix);

  const mode = youtube.mode === "live" && q.mode === "live" ? "live" : "mock";
  const { data: done } = await db.from("research_runs").update({
    queries, topic: q.result.topic, status: "complete", video_count: rows.length, storage_prefix: prefix, source: mode,
    completed_at: new Date().toISOString(), params: { ...run.params, downloaded },
  }).eq("id", run.id).select("*").single();

  return { run: done as ResearchRunRow, videoCount: rows.length, selected: rows.filter((r) => r.included).length, mode };
}

async function downloadThumbnails(db: DB, runId: string, prefix: string) {
  const { data: refs } = await db.from("youtube_references").select("id, video_id, rank, thumbnail_url")
    .eq("research_run_id", runId).eq("included", true).not("thumbnail_url", "is", null);
  let count = 0;
  for (const r of refs ?? []) {
    try {
      const res = await fetch(r.thumbnail_url!, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) continue;
      const bytes = new Uint8Array(await res.arrayBuffer());
      const path = `${prefix}/images/${String(r.rank).padStart(2, "0")}-${r.video_id}.jpg`;
      const { error } = await db.storage.from(BUCKETS.research).upload(path, bytes, { contentType: res.headers.get("content-type") ?? "image/jpeg", upsert: true });
      if (!error) { await db.from("youtube_references").update({ stored_image_path: path }).eq("id", r.id); count++; }
    } catch (e) {
      console.warn("[research] thumbnail download failed", r.video_id, e);
    }
  }
  return count;
}

export type ReferenceFlag = "included" | "excluded" | "favourite" | "locked";

/** Toggle curation flags. Locked references can't be excluded; excluding un-includes. */
export async function setReferenceFlag(db: DB, referenceId: string, flag: ReferenceFlag, value: boolean, actor: Actor) {
  const { data: ref } = await db.from("youtube_references").select("id, locked, title, research_run_id").eq("id", referenceId).single();
  if (!ref) throw new ServiceError("Reference not found", 404);
  if (ref.locked && flag !== "locked" && ((flag === "excluded" && value) || (flag === "included" && !value))) {
    throw new ServiceError("Unlock this reference before removing it", 409, "locked");
  }
  const patch: Record<string, boolean> = { [flag]: value };
  if (flag === "excluded" && value) patch.included = false;
  if (flag === "included" && value) patch.excluded = false;
  if (flag === "locked" && value) { patch.included = true; patch.excluded = false; }
  await db.from("youtube_references").update(patch).eq("id", referenceId);
  const { data: run } = await db.from("research_runs").select("order_id").eq("id", ref.research_run_id).single();
  if (run?.order_id && (flag === "locked" || flag === "excluded")) {
    await logActivity(db, { orderId: run.order_id, actor, action: `reference.${flag}`, message: `${value ? "" : "Un-"}${flag === "locked" ? "locked" : "excluded"} “${ref.title}”` });
  }
}

export async function latestRun(db: DB, orderId: string) {
  const { data } = await db.from("research_runs").select("*").eq("order_id", orderId).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return (data as ResearchRunRow | null) ?? null;
}

export type { OrderRow };
