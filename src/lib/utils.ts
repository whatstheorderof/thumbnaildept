import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const compact = new Intl.NumberFormat("en-GB", { notation: "compact", maximumFractionDigits: 1 });
export const formatCompact = (n: number | null | undefined) => (n == null ? "—" : compact.format(n));

export function formatMoney(n: number | null | undefined, currency = "GBP", digits = 2) {
  if (n == null) return "—";
  return new Intl.NumberFormat("en-GB", { style: "currency", currency, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
}

export function formatDate(d: string | Date | null | undefined, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("en-GB", opts).format(new Date(d));
}

export function formatDateTime(d: string | Date | null | undefined) {
  return formatDate(d, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function relativeTime(d: string | Date | null | undefined) {
  if (!d) return "—";
  const diff = new Date(d).getTime() - Date.now();
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("en-GB", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400_000], ["hour", 3_600_000], ["minute", 60_000],
  ];
  for (const [unit, ms] of units) if (abs >= ms || unit === "minute") return rtf.format(Math.round(diff / ms), unit);
  return "now";
}

export function slugify(s: string) {
  return s.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 60);
}

/** Deterministic 32-bit hash, used for placeholder tiles and mock data. */
export function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

export const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export const isJobId = (s: string) => /^JOB-\d{6}$/i.test(s);
