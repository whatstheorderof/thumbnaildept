import { normaliseWeights, type ScoringWeights } from "@/lib/services/settings";

/**
 * Reference scoring. Pure functions — no I/O — so the same model runs in the
 * pipeline, in tests and in scripts. Every component is 0–100 and stored
 * individually; null means "not available yet" and its weight is
 * redistributed across the components that are.
 *
 * Lifetime views are deliberately not a component: a 5-year-old 20M-view
 * video scores low on velocity and recency, while a 3-week-old breakout
 * from a small channel scores high.
 */
export interface Candidate {
  videoId: string;
  title: string;
  publishedAt: string;
  viewCount: number;
  channelSubscribers: number | null;
  channelMedianViews?: number | null;
  matchedQueries: string[];
  noveltyScore?: number | null;
}

export interface ScoredCandidate extends Candidate {
  ageDays: number;
  viewsPerDay: number;
  velocityScore: number;
  recencyScore: number;
  outperformanceScore: number | null;
  relevanceScore: number;
  noveltyScore: number | null;
  referenceScore: number;
  performanceType: "breakout" | "small-channel-winner" | "steady" | "evergreen";
  rank: number;
}

const clamp = (n: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n * 100) / 100;

/** 100 views/day → 0, 1k → 25, 10k → 50, 100k → 75, 1M → 100 */
export const absoluteVelocity = (vpd: number) => clamp((Math.log10(vpd + 1) - 2) * 25);

/** Exponential decay; ~37 at 45 days, ~14 at 90 days. */
export const recencyScore = (ageDays: number, decayDays = 45) => clamp(100 * Math.exp(-ageDays / decayDays));

/**
 * How far a video beat its channel's normal. Uses the channel's median
 * views when known, otherwise expects ~15% of subscribers.
 * 1× → 50, 10× → 75, 100× → 100.
 */
export function outperformanceScore(views: number, subs: number | null, medianViews?: number | null) {
  const expected = medianViews && medianViews > 0 ? medianViews : subs && subs > 0 ? subs * 0.15 : null;
  if (!expected) return null;
  return clamp(50 + 25 * Math.log10(Math.max(views / expected, 0.01)));
}

const STOP = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "for", "on", "with", "i", "my", "is", "it", "this", "that", "as", "at", "by", "be", "how", "what", "why", "you", "your"]);
export const tokens = (s: string) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}£$\s]/gu, " ").split(/\s+/).filter((t) => t.length > 1 && !STOP.has(t)));

/** Token overlap with the job title/topic, plus a bonus for matching several queries. */
export function relevanceScore(title: string, context: string, matchedQueries: number, totalQueries: number) {
  const a = tokens(title), b = tokens(context);
  if (!a.size || !b.size) return 30;
  let hit = 0;
  a.forEach((t) => { if (b.has(t)) hit++; });
  const overlap = hit / Math.min(a.size, b.size);
  const breadth = totalQueries > 0 ? matchedQueries / totalQueries : 0;
  return clamp(25 + overlap * 60 + breadth * 40);
}

function percentileRanks(values: number[]) {
  const sorted = [...values].sort((x, y) => x - y);
  return values.map((v) => (sorted.length <= 1 ? 50 : (sorted.indexOf(v) / (sorted.length - 1)) * 100));
}

export function scoreCandidates(candidates: Candidate[], opts: { weights: ScoringWeights; context: string; totalQueries: number; now?: Date }): ScoredCandidate[] {
  const now = (opts.now ?? new Date()).getTime();
  const base = candidates.map((c) => {
    const ageDays = Math.max((now - new Date(c.publishedAt).getTime()) / 86_400_000, 0.5);
    return { c, ageDays, vpd: c.viewCount / ageDays };
  });
  const pct = percentileRanks(base.map((b) => Math.log10(b.vpd + 1)));

  const scored = base.map(({ c, ageDays, vpd }, i) => {
    const velocity = 0.5 * absoluteVelocity(vpd) + 0.5 * pct[i];
    const recency = recencyScore(ageDays);
    const outperf = outperformanceScore(c.viewCount, c.channelSubscribers, c.channelMedianViews);
    const relevance = relevanceScore(c.title, opts.context, c.matchedQueries.length, opts.totalQueries);
    const novelty = c.noveltyScore ?? null;

    const w = normaliseWeights(opts.weights, { outperformance: outperf !== null, novelty: novelty !== null });
    const total = w.velocity * velocity + w.recency * recency + w.relevance * relevance + w.outperformance * (outperf ?? 0) + w.novelty * (novelty ?? 0);

    const performanceType: ScoredCandidate["performanceType"] =
      c.channelSubscribers !== null && c.channelSubscribers < 100_000 && (outperf ?? 0) >= 80 ? "small-channel-winner"
      : ageDays <= 30 && vpd >= 30_000 ? "breakout"
      : ageDays > 120 ? "evergreen"
      : "steady";

    return {
      ...c, ageDays: round(ageDays), viewsPerDay: round(vpd), velocityScore: round(velocity), recencyScore: round(recency),
      outperformanceScore: outperf === null ? null : round(outperf), relevanceScore: round(relevance), noveltyScore: novelty,
      referenceScore: round(total), performanceType, rank: 0,
    };
  });

  return scored.sort((a, b) => b.referenceScore - a.referenceScore).map((s, i) => ({ ...s, rank: i + 1 }));
}
