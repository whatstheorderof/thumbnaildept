import { z } from "zod";
import type { DB, ClientRow, ClientStatsRow, Marketplace } from "@/lib/types/db";
import type { Actor } from "@/lib/domain/actor";
import { logActivity } from "./activity";
import { ServiceError, must } from "./errors";

const text = z.string().trim().max(5000).optional().nullable().transform((v) => (v ? v : null));
const list = z.array(z.string().trim().min(1)).max(20).default([]);

export const clientSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(200),
  marketplace: z.enum(["fiverr", "upwork", "direct", "other"]).default("fiverr"),
  marketplaceUsername: text,
  email: z.string().trim().email().optional().nullable().or(z.literal("").transform(() => null)),
  channelUrl: z.string().trim().url().optional().nullable().or(z.literal("").transform(() => null)),
  brandColours: list,
  preferredFonts: list,
  visualPreferences: text,
  thingsToAvoid: text,
  notes: text,
});
export type ClientInput = z.input<typeof clientSchema>;

const toRow = (c: z.output<typeof clientSchema>) => ({
  name: c.name, marketplace: c.marketplace, marketplace_username: c.marketplaceUsername, email: c.email, channel_url: c.channelUrl,
  brand_colours: c.brandColours, preferred_fonts: c.preferredFonts, visual_preferences: c.visualPreferences,
  things_to_avoid: c.thingsToAvoid, notes: c.notes,
});

export async function createClientRecord(db: DB, raw: ClientInput, actor: Actor) {
  const input = clientSchema.parse(raw);
  const res = await db.from("clients").insert(toRow(input)).select("*").single();
  if (res.error?.code === "23505") throw new ServiceError("A client with that marketplace username already exists", 409, "duplicate");
  const client = must(res, "Create client") as ClientRow;
  if (input.channelUrl) await ensureChannel(db, input.channelUrl, client.id);
  await logActivity(db, { orderId: null, actor, action: "client.created", message: `Client ${client.name} created`, data: { clientId: client.id } });
  return client;
}

export async function updateClientRecord(db: DB, id: string, raw: ClientInput) {
  const input = clientSchema.parse(raw);
  const client = must(await db.from("clients").update(toRow(input)).eq("id", id).select("*").single(), "Client") as ClientRow;
  if (input.channelUrl) await ensureChannel(db, input.channelUrl, client.id);
  return client;
}

async function ensureChannel(db: DB, url: string, clientId: string) {
  const { data } = await db.from("channels").select("id, client_id").ilike("url", url).maybeSingle();
  if (!data) await db.from("channels").insert({ url, client_id: clientId });
  else if (!data.client_id) await db.from("channels").update({ client_id: clientId }).eq("id", data.id);
}

/** Used by automation: match a returning client by marketplace username, then name. */
export async function findOrCreateClient(db: DB, c: { name: string; marketplace: Marketplace; marketplaceUsername?: string | null; channelUrl?: string | null }) {
  if (c.marketplaceUsername) {
    const { data } = await db.from("clients").select("*").eq("marketplace", c.marketplace).ilike("marketplace_username", c.marketplaceUsername).maybeSingle();
    if (data) return data as ClientRow;
  }
  const { data: byName } = await db.from("clients").select("*").eq("marketplace", c.marketplace).ilike("name", c.name).limit(1).maybeSingle();
  if (byName) return byName as ClientRow;
  const created = must(await db.from("clients").insert({
    name: c.name, marketplace: c.marketplace, marketplace_username: c.marketplaceUsername ?? null, channel_url: c.channelUrl ?? null,
  }).select("*").single(), "Create client") as ClientRow;
  return created;
}

export interface ClientListItem extends ClientRow { stats: ClientStatsRow | null }

export async function listClients(db: DB, q?: string) {
  let query = db.from("clients").select("*").order("name");
  if (q?.trim()) query = query.or(`name.ilike.%${q.trim()}%,marketplace_username.ilike.%${q.trim()}%`);
  const [{ data: clients }, { data: stats }] = await Promise.all([query, db.from("client_stats").select("*")]);
  const byId = new Map((stats ?? []).map((s) => [s.client_id, s as ClientStatsRow]));
  return ((clients ?? []) as ClientRow[]).map((c) => ({ ...c, stats: byId.get(c.id) ?? null })) as ClientListItem[];
}

export async function getClientRecord(db: DB, id: string) {
  const client = must(await db.from("clients").select("*").eq("id", id).single(), "Client") as ClientRow;
  const { data: stats } = await db.from("client_stats").select("*").eq("client_id", id).maybeSingle();
  return { client, stats: (stats as ClientStatsRow | null) ?? null };
}
