import type { DB, ResearchRunRow } from "@/lib/types/db";
import type { Actor } from "@/lib/domain/actor";
import { slugify } from "@/lib/utils";
import { ServiceError } from "../errors";
import { getSettings } from "../settings";
import { executeResearch } from "./pipeline";

/**
 * REFERENCE HUNT (research stage). Saves into the Reference Library under
 * reference-hunts/<slug-date>/. Contact sheet (Phase 2), vision analysis and
 * Trend DNA (Phase 3) attach to the same run when those stages land.
 */
export async function runReferenceHunt(db: DB, input: { topic: string; category?: string | null; withinDays?: number; count?: number }, actor: Actor): Promise<ResearchRunRow> {
  const topic = input.topic.trim();
  if (topic.length < 3) throw new ServiceError("Topic is too short");
  const settings = await getSettings(db);
  const slug = `${slugify(topic)}-${new Date().toISOString().slice(0, 10)}`;
  const { data, error } = await db.from("research_runs").insert({
    kind: "reference_hunt", topic, category: input.category ?? null, slug, status: "running", started_at: new Date().toISOString(),
    storage_prefix: `reference-hunts/${slug}`, scoring_weights: settings.scoring_weights,
    params: { ...settings.research, publishedWithinDays: input.withinDays ?? settings.research.publishedWithinDays, maxVideos: input.count ?? settings.research.maxVideos },
    created_by: actor.userId ?? null,
  }).select("*").single();
  if (error || !data) throw new ServiceError(`Could not create hunt: ${error?.message}`, 500);
  try {
    const { run } = await executeResearch(db, data as ResearchRunRow, { title: topic, category: input.category });
    return run;
  } catch (e) {
    await db.from("research_runs").update({ status: "failed", error: String(e).slice(0, 1000) }).eq("id", data.id);
    throw e;
  }
}
