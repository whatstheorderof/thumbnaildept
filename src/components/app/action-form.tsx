"use client";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { ActionResult } from "@/lib/actions";
import { cn } from "@/lib/utils";

/**
 * Small wrapper around a server action form: shows the error/success
 * message inline and refreshes the page data on success.
 */
export function ActionForm({ action, children, className, resetOnSuccess, onSuccessHref }: {
  action: (prev: ActionResult<unknown> | null, fd: FormData) => Promise<ActionResult<unknown>>;
  children: React.ReactNode; className?: string; resetOnSuccess?: boolean; onSuccessHref?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();
  useEffect(() => {
    if (state?.ok) {
      if (resetOnSuccess) ref.current?.reset();
      if (onSuccessHref) router.push(onSuccessHref); else router.refresh();
    }
  }, [state, resetOnSuccess, onSuccessHref, router]);
  return (
    <form ref={ref} action={formAction} className={cn(className)}>
      {children}
      {state && !state.ok && <p className="mt-2 text-xs text-danger">{state.error}</p>}
      {state?.ok && state.message && <p className="mt-2 text-xs text-muted">{state.message}</p>}
    </form>
  );
}
