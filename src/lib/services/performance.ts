import { z } from "zod";
import type { DB } from "@/lib/types/db";
import type { Actor } from "@/lib/domain/actor";
import { logActivity } from "./activity";
import { ServiceError } from "./errors";

const num = z.number().nonnegative().optional().nullable();
export const performanceSchema = z.object({
  orderId: z.string().uuid(),
  videoUrl: z.string().trim().url().optional().nullable().or(z.literal("").transform(() => null)),
  publishedAt: z.string().optional().nullable().transform((v) => (v ? new Date(v).toISOString() : null)),
  impressions: num, ctr: z.number().min(0).max(100).optional().nullable(), views: num, watchTimeHours: num,
  abTestWinner: z.boolean().optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
});

/** Manual post-publication entry, linked back to the winning concept/pattern/brief/thumbnail. */
export async function recordPerformance(db: DB, raw: z.input<typeof performanceSchema>, actor: Actor) {
  const p = performanceSchema.parse(raw);
  const { data: win } = await db.from("reviews").select("composition_id, composition:compositions(concept_id, concept:concepts(style_pattern_id, creative_brief_id))")
    .eq("order_id", p.orderId).eq("is_winner", true).order("created_at", { ascending: false }).limit(1).maybeSingle();
  const comp = (win?.composition ?? null) as unknown as { concept_id: string | null; concept: { style_pattern_id: string | null; creative_brief_id: string | null } | null } | null;
  const { error } = await db.from("performance_results").insert({
    order_id: p.orderId, composition_id: win?.composition_id ?? null, concept_id: comp?.concept_id ?? null,
    style_pattern_id: comp?.concept?.style_pattern_id ?? null, creative_brief_id: comp?.concept?.creative_brief_id ?? null,
    video_url: p.videoUrl, published_at: p.publishedAt, impressions: p.impressions, ctr: p.ctr, views: p.views,
    watch_time_hours: p.watchTimeHours, ab_test_winner: p.abTestWinner, notes: p.notes, recorded_by: actor.userId ?? null,
  });
  if (error) throw new ServiceError(error.message, 500);
  await logActivity(db, { orderId: p.orderId, actor, action: "performance.recorded", message: `Performance recorded${p.ctr != null ? ` · CTR ${p.ctr}%` : ""}` });
}
