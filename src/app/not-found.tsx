import Link from "next/link";
export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-4 text-center">
      <div><div className="label-caps mb-2">404</div><p className="text-sm">Not found.</p><Link href="/dashboard" className="mt-3 inline-block text-xs text-muted underline">Back to dashboard</Link></div>
    </main>
  );
}
