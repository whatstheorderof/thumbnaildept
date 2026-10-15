import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Actor } from "@/lib/domain/actor";
import type { UserRow } from "@/lib/types/db";

/** Signed-in user context for pages and server actions. Redirects to /login otherwise. */
export const requireUser = cache(async () => {
  const db = await createSupabaseServerClient();
  const { data } = await db.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) redirect("/login");
  const { data: profile } = await db.from("users").select("*").eq("id", claims.sub).maybeSingle();
  const user: UserRow = (profile as UserRow | null) ?? {
    id: claims.sub, email: String(claims.email ?? ""), full_name: null, role: "designer", created_at: "", updated_at: "",
  };
  const actor: Actor = { type: "user", userId: user.id, label: user.email };
  return { db, user, actor };
});
