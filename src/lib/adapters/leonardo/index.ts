import { timingSafeEqual } from "node:crypto";
import { env, integrationModes } from "@/lib/env";

/**
 * Leonardo AI Production API adapter. Models are swappable via
 * LEONARDO_MODEL_ID or per-request `modelId`; nothing else in the app
 * talks to Leonardo directly. The API key never leaves the server.
 *
 * Generation is used for backgrounds, environments, objects, lighting and
 * effects — never final typography (the compositor handles text).
 */
export interface GenerationRequest {
  prompt: string;
  negativePrompt?: string | null;
  numImages: number;
  width: number;
  height: number;
  modelId?: string;
  extra?: Record<string, unknown>;
}

export interface GenerationAccepted { providerGenerationId: string; model: string; cost: number | null; settings: Record<string, unknown> }

export interface CompletedImage { providerImageId: string; url: string; nsfw: boolean; width?: number; height?: number }
export interface CompletedGeneration { providerGenerationId: string; status: "complete" | "failed"; images: CompletedImage[]; error?: string }

export interface LeonardoAdapter {
  mode: "live" | "mock";
  createGeneration(req: GenerationRequest): Promise<GenerationAccepted>;
  getGeneration(id: string): Promise<CompletedGeneration | null>;
}

const API = "https://cloud.leonardo.ai/api/rest/v1";

class LiveLeonardo implements LeonardoAdapter {
  mode = "live" as const;

  private async call<T>(path: string, init: RequestInit = {}): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      ...init,
      headers: { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${env.leonardoApiKey}`, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`Leonardo ${path} ${res.status}: ${(await res.text()).slice(0, 300)}`);
    return res.json() as Promise<T>;
  }

  async createGeneration(req: GenerationRequest) {
    const modelId = req.modelId ?? env.leonardoModelId;
    if (!modelId) throw new Error("LEONARDO_MODEL_ID is not set");
    const settings = {
      modelId, prompt: req.prompt, negative_prompt: req.negativePrompt ?? undefined,
      num_images: req.numImages, width: req.width, height: req.height, ...(req.extra ?? {}),
    };
    type R = { sdGenerationJob: { generationId: string; apiCreditCost?: number } };
    const data = await this.call<R>("/generations", { method: "POST", body: JSON.stringify(settings) });
    return {
      providerGenerationId: data.sdGenerationJob.generationId, model: modelId,
      // apiCreditCost is in Leonardo API credits; convert in cost tracking once a rate is configured.
      cost: data.sdGenerationJob.apiCreditCost ?? null, settings,
    };
  }

  async getGeneration(id: string) {
    type R = { generations_by_pk: { id: string; status: string; generated_images: { id: string; url: string; nsfw: boolean }[] } | null };
    const data = await this.call<R>(`/generations/${id}`);
    const g = data.generations_by_pk;
    if (!g) return null;
    if (g.status !== "COMPLETE" && g.status !== "FAILED") return null;
    return {
      providerGenerationId: g.id, status: g.status === "COMPLETE" ? ("complete" as const) : ("failed" as const),
      images: g.generated_images.map((i) => ({ providerImageId: i.id, url: i.url, nsfw: i.nsfw })),
    };
  }
}

class MockLeonardo implements LeonardoAdapter {
  mode = "mock" as const;
  async createGeneration(req: GenerationRequest) {
    return { providerGenerationId: `mock-${crypto.randomUUID()}`, model: "mock", cost: 0, settings: { ...req } as Record<string, unknown> };
  }
  async getGeneration() { return null; }
}

export function getLeonardo(): LeonardoAdapter {
  return integrationModes().leonardo === "live" ? new LiveLeonardo() : new MockLeonardo();
}

/** Parse Leonardo's webhook body into a CompletedGeneration. Tolerant of payload shape variations. */
export function parseLeonardoWebhook(body: unknown): CompletedGeneration | null {
  const b = body as { type?: string; data?: { object?: Record<string, unknown> } } | null;
  const obj = (b?.data?.object ?? (body as Record<string, unknown>)) as Record<string, unknown> | undefined;
  if (!obj) return null;
  const id = (obj.id ?? obj.generationId) as string | undefined;
  if (!id) return null;
  const imgs = (obj.images ?? obj.generated_images ?? []) as { id: string; url: string; nsfw?: boolean }[];
  const status = String(obj.status ?? b?.type ?? "").toUpperCase();
  return {
    providerGenerationId: id,
    status: status.includes("FAIL") ? "failed" : "complete",
    images: imgs.map((i) => ({ providerImageId: i.id, url: i.url, nsfw: !!i.nsfw })),
  };
}

/** Constant-time check of the Bearer token Leonardo sends with webhooks. */
export function verifyLeonardoWebhook(authorization: string | null): boolean {
  const secret = env.leonardoWebhookSecret;
  if (!secret || !authorization) return false;
  const token = authorization.replace(/^Bearer\s+/i, "");
  const a = Buffer.from(token), b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}
