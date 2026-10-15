import { z } from "zod";
import type { DB } from "@/lib/types/db";

export const scoringWeightsSchema = z.object({
  velocity: z.number().min(0).max(100),
  recency: z.number().min(0).max(100),
  outperformance: z.number().min(0).max(100),
  relevance: z.number().min(0).max(100),
  novelty: z.number().min(0).max(100),
});
export type ScoringWeights = z.infer<typeof scoringWeightsSchema>;

export const CRITIC_DIMENSIONS = [
  ["visualClarity", "Visual clarity"],
  ["mobileReadability", "Mobile readability"],
  ["focalHierarchy", "Focal hierarchy"],
  ["curiosity", "Curiosity"],
  ["titleComplement", "Title complement"],
  ["categoryRelevance", "Category relevance"],
  ["competitiveDifferentiation", "Competitive differentiation"],
  ["clientFit", "Client fit"],
  ["artefactQuality", "Artefact quality"],
  ["honesty", "Honesty"],
] as const;
export type CriticDimension = (typeof CRITIC_DIMENSIONS)[number][0];

export const criticSettingsSchema = z.object({
  rejectBelow: z.number().min(0).max(100),
  reviewFrom: z.number().min(0).max(100),
  weights: z.record(z.string(), z.number().min(0)),
}).refine((v) => v.reviewFrom >= v.rejectBelow, { message: "Review threshold must be ≥ reject threshold" });

export const pricingSchema = z.object({
  defaultSalePrice: z.number().min(0),
  currency: z.string().length(3),
  marketplaceFeePct: z.record(z.string(), z.number().min(0).max(100)),
  usdToGbp: z.number().positive(),
});

export const generationSettingsSchema = z.object({
  candidatesPerConcept: z.number().int().min(1).max(8),
  width: z.number().int().min(512).max(2048),
  height: z.number().int().min(512).max(2048),
});

export const researchSettingsSchema = z.object({
  queryCount: z.number().int().min(3).max(12),
  maxVideos: z.number().int().min(10).max(100),
  publishedWithinDays: z.number().int().min(7).max(1095),
  autoIncludeTop: z.number().int().min(4).max(30),
});

export const DEFAULT_SETTINGS = {
  scoring_weights: { velocity: 35, recency: 25, outperformance: 20, relevance: 10, novelty: 10 } as ScoringWeights,
  critic: {
    rejectBelow: 70,
    reviewFrom: 80,
    weights: {
      visualClarity: 12, mobileReadability: 12, focalHierarchy: 10, curiosity: 12, titleComplement: 10,
      categoryRelevance: 8, competitiveDifferentiation: 12, clientFit: 8, artefactQuality: 10, honesty: 6,
    } as Record<string, number>,
  },
  pricing: { defaultSalePrice: 20, currency: "GBP", marketplaceFeePct: { fiverr: 20, upwork: 10, direct: 0, other: 0 } as Record<string, number>, usdToGbp: 0.79 },
  generation: { candidatesPerConcept: 4, width: 1344, height: 768 },
  research: { queryCount: 8, maxVideos: 60, publishedWithinDays: 180, autoIncludeTop: 16 },
};

export type AppSettings = typeof DEFAULT_SETTINGS;
export type SettingsKey = keyof AppSettings;

const schemas = {
  scoring_weights: scoringWeightsSchema,
  critic: criticSettingsSchema,
  pricing: pricingSchema,
  generation: generationSettingsSchema,
  research: researchSettingsSchema,
} satisfies Record<SettingsKey, z.ZodType>;

/** Load all settings, falling back to defaults per key (and per invalid value). */
export async function getSettings(db: DB): Promise<AppSettings> {
  const { data } = await db.from("app_settings").select("key, value");
  const out: AppSettings = structuredClone(DEFAULT_SETTINGS);
  for (const row of data ?? []) {
    const key = row.key as SettingsKey;
    if (!(key in schemas)) continue;
    const parsed = schemas[key].safeParse({ ...(DEFAULT_SETTINGS[key] as object), ...(row.value as object) });
    if (parsed.success) (out as Record<string, unknown>)[key] = parsed.data;
  }
  return out;
}

export async function updateSetting<K extends SettingsKey>(db: DB, key: K, value: unknown, userId?: string | null) {
  const parsed = schemas[key].parse(value);
  const { error } = await db.from("app_settings").upsert({ key, value: parsed, updated_by: userId ?? null });
  if (error) throw new Error(error.message);
  return parsed as AppSettings[K];
}

/** Normalise weights so the available components sum to 1. Null components are skipped. */
export function normaliseWeights(weights: ScoringWeights, available: Partial<Record<keyof ScoringWeights, boolean>>) {
  const keys = Object.keys(weights) as (keyof ScoringWeights)[];
  const active = keys.filter((k) => available[k] !== false);
  const total = active.reduce((s, k) => s + weights[k], 0) || 1;
  return Object.fromEntries(keys.map((k) => [k, active.includes(k) ? weights[k] / total : 0])) as Record<keyof ScoringWeights, number>;
}
