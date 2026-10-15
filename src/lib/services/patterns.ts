import { z } from "zod";
import type { DB, StylePatternRow } from "@/lib/types/db";
import { slugify } from "@/lib/utils";
import { ServiceError } from "./errors";

const t = z.string().trim().max(500).optional().nullable().transform((v) => v || null);
export const patternSchema = z.object({
  name: z.string().trim().min(2).max(80).transform((v) => v.toUpperCase()),
  description: t, subjectPosition: t, primaryObject: t, objectTreatment: t, background: t, textTreatment: t,
  curiosityMechanism: t, emotionalMechanism: t,
  categories: z.array(z.string().trim().min(1)).default([]),
  tags: z.array(z.string().trim().min(1)).default([]),
});

/** Patterns describe composition and mechanics — never a specific creator's artwork. */
export async function createPattern(db: DB, raw: z.input<typeof patternSchema>, userId?: string | null) {
  const p = patternSchema.parse(raw);
  const res = await db.from("style_patterns").insert({
    name: p.name, slug: slugify(p.name), description: p.description, subject_position: p.subjectPosition, primary_object: p.primaryObject,
    object_treatment: p.objectTreatment, background: p.background, text_treatment: p.textTreatment, curiosity_mechanism: p.curiosityMechanism,
    emotional_mechanism: p.emotionalMechanism, categories: p.categories, tags: p.tags, created_by: userId ?? null,
  }).select("*").single();
  if (res.error?.code === "23505") throw new ServiceError("A pattern with that name exists", 409, "duplicate");
  if (res.error) throw new ServiceError(res.error.message, 500);
  return res.data as StylePatternRow;
}
