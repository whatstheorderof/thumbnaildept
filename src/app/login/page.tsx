import { env } from "@/lib/env";
import { LoginForm } from "./login-form";

export const metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const configured = !!env.supabaseUrl && !!env.supabaseAnonKey;
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-[340px]">
        <div className="mb-8 flex items-center gap-2">
          <div className="grid size-6 place-items-center rounded-[5px] bg-accent text-[11px] font-black text-accent-foreground">T</div>
          <span className="text-sm font-semibold tracking-tight">Thumbnail Department</span>
        </div>
        <h1 className="text-lg font-semibold tracking-tight">Sign in</h1>
        <p className="mb-6 mt-1 text-[13px] text-muted">Internal thumbnail production.</p>
        {configured ? <LoginForm next={next ?? "/dashboard"} /> : (
          <div className="rounded-md border border-border bg-surface p-4 text-xs leading-relaxed text-muted">
            Supabase isn&apos;t configured. Copy <code className="text-foreground">.env.example</code> to <code className="text-foreground">.env.local</code>, run <code className="text-foreground">npx supabase start</code> and paste the URL and anon key it prints.
          </div>
        )}
      </div>
    </main>
  );
}
