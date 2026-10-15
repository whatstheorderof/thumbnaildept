import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { env, integrationModes } from "@/lib/env";
import { DEFAULT_CATEGORIES } from "@/lib/domain/categories";
import type { StructuredRevision } from "@/lib/types/db";

/**
 * Claude adapter. Every method returns `{ result, usage, mode }` so callers
 * can record cost and label mock output. The mock is deterministic and
 * clearly marked "mock" wherever it is stored.
 */
export interface ClaudeUsage { model: string; inputTokens: number; outputTokens: number }
export interface ClaudeResult<T> { result: T; usage: ClaudeUsage; mode: "live" | "mock" }

export interface VideoContext {
  title: string;
  description?: string | null;
  category?: string | null;
  channelContext?: string | null;
  requestedText?: string | null;
}

export interface ClaudeAdapter {
  detectCategory(input: VideoContext): Promise<ClaudeResult<{ category: string; confidence: number }>>;
  generateSearchQueries(input: VideoContext & { count: number }): Promise<ClaudeResult<{ queries: string[]; topic: string }>>;
  structureRevision(input: { feedback: string; orderTitle: string; currentDesign?: string | null }): Promise<ClaudeResult<StructuredRevision>>;
}

// ── Live implementation ───────────────────────────────────────────────

const categorySchema = z.object({ category: z.string(), confidence: z.number().min(0).max(1) });
const queriesSchema = z.object({ topic: z.string(), queries: z.array(z.string().min(2)).min(3).max(12) });
const revisionSchema = z.object({ preserve: z.array(z.string()), change: z.array(z.string()), remove: z.array(z.string()), add: z.array(z.string()) });

function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  return JSON.parse(raw);
}

class LiveClaude implements ClaudeAdapter {
  private client = new Anthropic({ apiKey: env.anthropicApiKey });

  private async json<T>(schema: z.ZodType<T>, system: string, user: string, maxTokens = 1024): Promise<ClaudeResult<T>> {
    const model = env.anthropicModel;
    const msg = await this.client.messages.create({
      model,
      max_tokens: maxTokens,
      system: system + "\nRespond with a single JSON object only, no prose.",
      messages: [{ role: "user", content: user }],
    });
    const text = msg.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    const result = schema.parse(extractJson(text));
    return { result, usage: { model, inputTokens: msg.usage.input_tokens, outputTokens: msg.usage.output_tokens }, mode: "live" };
  }

  detectCategory(input: VideoContext) {
    return this.json(
      categorySchema,
      `You classify YouTube videos into one thumbnail-design category. Choose from: ${DEFAULT_CATEGORIES.join(", ")}. Use another short category name only if none fit. Return {"category": string, "confidence": number 0-1}.`,
      JSON.stringify({ title: input.title, description: input.description, channel: input.channelContext }),
      200,
    );
  }

  generateSearchQueries(input: VideoContext & { count: number }) {
    return this.json(
      queriesSchema,
      `You are a YouTube packaging researcher. Given a video that needs a thumbnail, write ${input.count} distinct YouTube search queries a viewer would type that would surface recent, successful videos competing for the same click. Mix: the literal topic, the format (e.g. "100 days", "I tried"), adjacent angles and the category's common phrasing. Keep each query 2–7 words, no quotes or operators. Return {"topic": short topic summary, "queries": string[]}.`,
      JSON.stringify(input),
      600,
    );
  }

  structureRevision(input: { feedback: string; orderTitle: string; currentDesign?: string | null }) {
    return this.json(
      revisionSchema,
      `You convert marketplace customer feedback on a YouTube thumbnail into precise production instructions for a designer. Split it into PRESERVE (things the client implicitly or explicitly wants kept), CHANGE, REMOVE and ADD. Each item is one short imperative instruction. Do not invent requests the client did not make; anything unmentioned should be preserved. Return {"preserve":[],"change":[],"remove":[],"add":[]}.`,
      JSON.stringify(input),
      800,
    );
  }
}

// ── Development mock ──────────────────────────────────────────────────

const KEYWORDS: [string, RegExp][] = [
  ["Gaming", /minecraft|fortnite|roblox|gta|game|gaming|speedrun|boss|level/i],
  ["Finance", /money|£|\$|spend|budget|invest|saving|salary|debt|stock|pound/i],
  ["Fitness", /workout|gym|fitness|muscle|calisthenics|run|marathon|abs/i],
  ["Food", /recipe|cook|food|eat|restaurant|bake|chef/i],
  ["Travel", /travel|trip|country|city|flight|hotel|visit/i],
  ["Technology", /iphone|tech|laptop|ai|app|gadget|review|android/i],
  ["True Crime", /murder|crime|case|killer|detective|missing/i],
  ["Documentary", /documentary|abandoned|vanished|history|story of|mystery/i],
  ["Football", /football|premier league|goal|fifa|striker|messi|ronaldo/i],
  ["Beauty", /makeup|skincare|beauty|hair/i],
  ["Business", /business|startup|founder|company|ceo|side hustle/i],
  ["Education", /learn|explained|how to|science|maths|lesson/i],
];

const mockUsage = (): ClaudeUsage => ({ model: "mock", inputTokens: 0, outputTokens: 0 });

class MockClaude implements ClaudeAdapter {
  async detectCategory(input: VideoContext) {
    const text = `${input.title} ${input.description ?? ""}`;
    const hit = KEYWORDS.find(([, re]) => re.test(text));
    return { result: { category: hit?.[0] ?? "Lifestyle", confidence: hit ? 0.72 : 0.35 }, usage: mockUsage(), mode: "mock" as const };
  }

  async generateSearchQueries(input: VideoContext & { count: number }) {
    const words = input.title.toLowerCase().replace(/[^\w\s£$]/g, " ").split(/\s+/).filter((w) => w.length > 2 && !STOP.has(w));
    const core = words.slice(0, 4).join(" ") || input.title.toLowerCase();
    const cat = (input.category ?? "").toLowerCase();
    const templates = [core, `${core} ${cat}`.trim(), `i tried ${words.slice(0, 3).join(" ")}`, `${words.slice(0, 2).join(" ")} challenge`,
      `${cat} ${words[0] ?? ""}`.trim(), `${words.slice(-3).join(" ")}`, `best ${cat} videos ${new Date().getFullYear()}`.trim(), `${words.slice(1, 4).join(" ")} explained`,
      `${core} reaction`, `${words[0] ?? ""} vs ${words[1] ?? ""}`, `why ${words.slice(0, 3).join(" ")}`, `${core} ${new Date().getFullYear()}`];
    const queries = [...new Set(templates.map((q) => q.replace(/\s+/g, " ").trim()).filter((q) => q.length > 3))].slice(0, input.count);
    return { result: { topic: core, queries }, usage: mockUsage(), mode: "mock" as const };
  }

  async structureRevision(input: { feedback: string }) {
    const sentences = input.feedback.split(/(?<=[.!?\n])\s+/).map((s) => s.trim()).filter(Boolean);
    const out: StructuredRevision = { preserve: [], change: [], remove: [], add: [] };
    for (const s of sentences) {
      if (/\b(keep|love|like|good|perfect|fine)\b/i.test(s)) out.preserve.push(s);
      else if (/\b(remove|delete|get rid|no more|without|drop)\b/i.test(s)) out.remove.push(s);
      else if (/\b(add|include|put|insert|more)\b/i.test(s)) out.add.push(s);
      else out.change.push(s);
    }
    if (!out.preserve.length) out.preserve.push("Everything not mentioned in the feedback");
    return { result: out, usage: mockUsage(), mode: "mock" as const };
  }
}

const STOP = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "was", "are", "but", "you", "your", "how", "what", "who", "why", "every", "year", "days"]);

let instance: ClaudeAdapter | null = null;
export function getClaude(): ClaudeAdapter {
  if (!instance) instance = integrationModes().claude === "live" ? new LiveClaude() : new MockClaude();
  return instance;
}
