import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

/**
 * Service-role client: bypasses RLS. Only for API routes, webhooks and
 * scripts. Never import this from a client component.
 */
export function createSupabaseAdminClient() {
  if (typeof window !== "undefined") throw new Error("Admin client must not run in the browser");
  return createClient(requireEnv("supabaseUrl"), requireEnv("supabaseServiceRoleKey"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
