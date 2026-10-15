/**
 * Thumbnail Department command line — drives the same services as the web UI.
 *
 *   npm run td -- status JOB-000124
 *   npm run td -- thumbnail JOB-000124      # advance the job to its next automated stage
 *   npm run td -- research JOB-000124
 *   npm run td -- reference-hunt "true crime documentary" --category "True Crime" --days 90 --count 40
 *   npm run td -- review JOB-000124
 *   npm run td -- generate JOB-000124
 *   npm run td -- list [STATUS]
 *
 * Uses SUPABASE_SERVICE_ROLE_KEY from .env.local. Actions are logged as
 * automation ("claude-code"), so they can never approve an order.
 */
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { automationActor } from "@/lib/domain/actor";
import { STATUS_META, allowedTransitions } from "@/lib/domain/status";
import { getOrder, listOrders } from "@/lib/services/orders";
import { runOrderResearch } from "@/lib/services/research/pipeline";
import { runReferenceHunt } from "@/lib/services/research/hunt";
import { getOrderEconomics } from "@/lib/services/costs";
import { integrationModes } from "@/lib/env";
import type { CompositionRow } from "@/lib/types/db";

const db = createSupabaseAdminClient();
const actor = automationActor("claude-code");
const [cmd, ...rest] = process.argv.slice(2);
const flag = (name: string) => { const i = rest.indexOf(`--${name}`); return i >= 0 ? rest[i + 1] : undefined; };
const positional = rest.filter((a, i) => !a.startsWith("--") && !(i > 0 && rest[i - 1].startsWith("--")));

const out = (o: unknown) => console.log(typeof o === "string" ? o : JSON.stringify(o, null, 2));

async function status(id: string) {
  const o = await getOrder(db, id);
  const econ = await getOrderEconomics(db, o);
  out({
    jobId: o.job_id, title: o.video_title, status: o.status, stage: STATUS_META[o.status].description, category: o.category,
    deadline: o.deadline, next: allowedTransitions(o.status, "automation"),
    economics: { sale: econ.salePrice, fee: econ.marketplaceFee, cost: Number(econ.productionCost.toFixed(3)), margin: Number(econ.margin.toFixed(2)) },
    integrations: integrationModes(),
  });
}

async function research(id: string) {
  const run = await runOrderResearch(db, id, actor);
  const { data: top } = await db.from("youtube_references").select("rank, reference_score, views_per_day, title, channel_title").eq("research_run_id", run.id).eq("included", true).order("rank").limit(10);
  out({ runId: run.id, source: run.source, videos: run.video_count, queries: run.queries, top });
}

async function review(id: string) {
  const o = await getOrder(db, id);
  const { data } = await db.from("compositions").select("id, critic_total, critic_verdict, critic_summary, concept:concepts(slot, name)").eq("order_id", o.id).order("critic_total", { ascending: false, nullsFirst: false });
  const comps = (data ?? []) as unknown as (Pick<CompositionRow, "id" | "critic_total" | "critic_verdict" | "critic_summary"> & { concept: { slot: string; name: string } | null })[];
  out({
    jobId: o.job_id, status: o.status,
    candidates: comps.filter((c) => c.critic_verdict !== "reject").slice(0, 3).map((c) => ({ concept: c.concept ? `${c.concept.slot} · ${c.concept.name}` : null, score: c.critic_total, verdict: c.critic_verdict, summary: c.critic_summary })),
    rejected: comps.filter((c) => c.critic_verdict === "reject").length,
    note: "Approval requires a signed-in reviewer in the web UI.",
  });
}

async function thumbnail(id: string) {
  const o = await getOrder(db, id);
  if (o.status === "NEW") return research(id);
  out(`${o.job_id} is ${STATUS_META[o.status].label}. The next automated stage (${nextStageFor(o.status)}) is not built yet — see docs/ROADMAP.md.`);
}

const nextStageFor = (s: string) => ({ RESEARCH_COMPLETE: "concepts, Phase 3", CONCEPTS_READY: "generation, Phase 4", GENERATIONS_READY: "compositing + critic, Phases 5–6" } as Record<string, string>)[s] ?? "manual step";

async function main() {
  switch (cmd) {
    case "status": return status(need(positional[0]));
    case "research": return research(need(positional[0]));
    case "thumbnail": return thumbnail(need(positional[0]));
    case "review": return review(need(positional[0]));
    case "reference-hunt": {
      const run = await runReferenceHunt(db, { topic: need(positional[0], "topic"), category: flag("category"), withinDays: num(flag("days")), count: num(flag("count")) }, actor);
      return out({ runId: run.id, slug: run.slug, videos: run.video_count, storage: run.storage_prefix, note: "Contact sheet + Trend DNA attach in Phases 2–3." });
    }
    case "generate":
      console.error("generate: Leonardo generation is Phase 4 and not implemented yet. The adapter lives in src/lib/adapters/leonardo.");
      process.exit(2);
    case "list": {
      const orders = await listOrders(db, { status: positional[0]?.toUpperCase() });
      return out(orders.map((o) => `${o.job_id}  ${o.status.padEnd(18)} ${o.video_title}`).join("\n") || "No orders");
    }
    default:
      out("Commands: status | thumbnail | research | reference-hunt | review | generate | list");
      process.exit(cmd ? 1 : 0);
  }
}

function need(v: string | undefined, what = "job id") { if (!v) { console.error(`Missing ${what}`); process.exit(1); } return v; }
function num(v?: string) { return v ? Number(v) : undefined; }

main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); });
