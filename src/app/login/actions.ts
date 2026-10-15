"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function signIn(_: { error?: string } | null, fd: FormData) {
  const email = String(fd.get("email") ?? "").trim();
  const password = String(fd.get("password") ?? "");
  const next = String(fd.get("next") ?? "/dashboard");
  if (!email || !password) return { error: "Enter your email and password" };
  const db = await createSupabaseServerClient();
  const { error } = await db.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function signOut() {
  const db = await createSupabaseServerClient();
  await db.auth.signOut();
  redirect("/login");
}
