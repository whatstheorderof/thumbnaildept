/**
 * Server-side environment access. Only NEXT_PUBLIC_* values are ever
 * bundled for the browser; everything else here stays on the server.
 */
const read = (k: string) => {
  const v = process.env[k];
  return v && v.trim() !== "" ? v.trim() : undefined;
};

export const env = {
  appUrl: read("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3000",
  supabaseUrl: read("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceRoleKey: read("SUPABASE_SERVICE_ROLE_KEY"),
  forceMocks: read("MOCK_EXTERNAL_APIS") === "true",
  youtubeApiKey: read("YOUTUBE_API_KEY"),
  anthropicApiKey: read("ANTHROPIC_API_KEY"),
  anthropicModel: read("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
  anthropicVisionModel: read("ANTHROPIC_VISION_MODEL") ?? read("ANTHROPIC_MODEL") ?? "claude-sonnet-5-5",
  leonardoApiKey: read("LEONARDO_API_KEY"),
  leonardoModelId: read("LEONARDO_MODEL_ID"),
  leonardoWebhookSecret: read("LEONARDO_WEBHOOK_SECRET"),
  automationApiKey: read("AUTOMATION_API_KEY"),
  outgoingWebhookUrl: read("OUTGOING_WEBHOOK_URL"),
  outgoingWebhookSecret: read("OUTGOING_WEBHOOK_SECRET"),
  cronSecret: read("CRON_SECRET"),
};

export function requireEnv<K extends keyof typeof env>(key: K): NonNullable<(typeof env)[K]> {
  const v = env[key];
  if (v === undefined || v === null) throw new Error(`Missing environment variable for ${String(key)}. See .env.example.`);
  return v as NonNullable<(typeof env)[K]>;
}

/** Which integrations are live vs. running on development mocks. */
export function integrationModes() {
  const live = (key?: string) => (!env.forceMocks && !!key ? "live" : "mock") as "live" | "mock";
  return {
    youtube: live(env.youtubeApiKey),
    claude: live(env.anthropicApiKey),
    leonardo: live(env.leonardoApiKey),
  };
}
