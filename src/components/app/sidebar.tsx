"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutGrid, Inbox, Telescope, Sparkles, CheckSquare, Users, Tv, Library, Shapes, BarChart3, Settings, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutGrid },
  { href: "/orders", label: "Orders", icon: Inbox },
  { href: "/research", label: "Research", icon: Telescope },
  { href: "/generate", label: "Generate", icon: Sparkles },
  { href: "/review", label: "Review", icon: CheckSquare },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/channels", label: "Channels", icon: Tv },
  { href: "/library", label: "Reference Library", icon: Library },
  { href: "/patterns", label: "Patterns", icon: Shapes },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/settings", label: "Settings", icon: Settings },
] as const;

export function Sidebar({ reviewCount, userEmail, signOut }: { reviewCount: number; userEmail: string; signOut: () => Promise<void> }) {
  const path = usePathname();
  return (
    <aside className="sticky top-0 flex h-dvh w-[220px] shrink-0 flex-col border-r border-border bg-background max-lg:w-[60px]">
      <div className="flex h-12 items-center gap-2 px-4 max-lg:justify-center max-lg:px-0">
        <div className="grid size-5 place-items-center rounded-[4px] bg-accent text-[10px] font-black text-accent-foreground">T</div>
        <span className="text-[13px] font-semibold tracking-tight max-lg:hidden">Thumbnail Department</span>
      </div>
      <div className="px-3 pb-3 max-lg:px-2">
        <Link href="/orders/new" className="flex h-8 items-center justify-center gap-1.5 rounded-md bg-accent text-[12px] font-semibold tracking-wide text-accent-foreground hover:bg-white/85">
          <Plus className="size-3.5" /><span className="max-lg:hidden">NEW THUMBNAIL JOB</span>
        </Link>
      </div>
      <nav className="flex-1 space-y-px overflow-y-auto px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = path === href || path.startsWith(href + "/");
          return (
            <Link key={href} href={href} title={label}
              className={cn("flex h-8 items-center gap-2.5 rounded-md px-2.5 text-[13px] transition-colors max-lg:justify-center",
                active ? "bg-surface-3 text-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground")}>
              <Icon className="size-[15px] shrink-0" strokeWidth={1.75} />
              <span className="truncate max-lg:hidden">{label}</span>
              {href === "/review" && reviewCount > 0 && (
                <span className="ml-auto rounded bg-surface-3 px-1.5 text-[10px] tabular text-foreground max-lg:hidden">{reviewCount}</span>
              )}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-border p-3 max-lg:hidden">
        <div className="truncate text-xs text-muted">{userEmail}</div>
        <form action={signOut}><button className="mt-1 text-xs text-subtle hover:text-foreground">Sign out</button></form>
      </div>
    </aside>
  );
}
