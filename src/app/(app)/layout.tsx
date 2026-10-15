import { requireUser } from "@/lib/auth/session";
import { Sidebar } from "@/components/app/sidebar";
import { signOut } from "@/app/login/actions";
import { integrationModes } from "@/lib/env";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { db, user } = await requireUser();
  const { count } = await db.from("orders").select("id", { count: "exact", head: true }).eq("status", "REVIEW");
  const modes = integrationModes();
  const mocked = Object.entries(modes).filter(([, m]) => m === "mock").map(([k]) => k);
  return (
    <div className="flex min-h-dvh">
      <Sidebar reviewCount={count ?? 0} userEmail={user.email} signOut={signOut} />
      <main className="min-w-0 flex-1">
        {mocked.length > 0 && (
          <div className="border-b border-dashed border-border bg-surface px-6 py-1.5 text-[11px] text-muted max-md:px-4">
            <span className="label-caps !text-[10px] mr-2">Dev mocks</span>
            {mocked.join(", ")} running on development mocks — add API keys in <code>.env.local</code> to go live.
          </div>
        )}
        {children}
      </main>
    </div>
  );
}
