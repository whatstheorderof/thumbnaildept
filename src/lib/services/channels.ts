import { z } from "zod";
import type { DB, ChannelRow, LockedCharacteristic } from "@/lib/types/db";
import { ServiceError } from "./errors";

export const channelSchema = z.object({
  url: z.string().trim().url("Enter a channel URL"),
  clientId: z.string().uuid().optional().nullable().or(z.literal("").transform(() => null)),
  title: z.string().trim().max(200).optional().nullable().transform((v) => v || null),
});

export function handleFromUrl(url: string) {
  const m = url.match(/youtube\.com\/(@[\w.\-]+)/i);
  return m?.[1] ?? null;
}

export async function createChannel(db: DB, raw: z.input<typeof channelSchema>) {
  const input = channelSchema.parse(raw);
  const res = await db.from("channels").insert({ url: input.url, client_id: input.clientId, title: input.title, handle: handleFromUrl(input.url) }).select("*").single();
  if (res.error?.code === "23505") throw new ServiceError("That channel is already saved", 409, "duplicate");
  if (res.error) throw new ServiceError(res.error.message, 500);
  return res.data as ChannelRow;
}

export async function setLockedCharacteristics(db: DB, channelId: string, items: LockedCharacteristic[]) {
  const clean = items.map((i) => ({ label: i.label.trim().slice(0, 200), locked: !!i.locked })).filter((i) => i.label);
  const { error } = await db.from("channels").update({ locked_characteristics: clean }).eq("id", channelId);
  if (error) throw new ServiceError(error.message, 500);
}

export async function listChannels(db: DB) {
  const { data } = await db.from("channels").select("*, client:clients(id, name)").order("created_at", { ascending: false });
  return (data ?? []) as (ChannelRow & { client: { id: string; name: string } | null })[];
}
