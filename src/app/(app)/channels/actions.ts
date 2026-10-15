"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { runAction } from "@/lib/actions";
import { createChannel, setLockedCharacteristics } from "@/lib/services/channels";

export async function createChannelAction(_: unknown, fd: FormData) {
  const { db } = await requireUser();
  return runAction(async () => {
    await createChannel(db, { url: String(fd.get("url") ?? ""), clientId: String(fd.get("clientId") ?? ""), title: String(fd.get("title") ?? "") });
    revalidatePath("/channels");
  }, "Channel added");
}

export async function lockedAction(channelId: string, _: unknown, fd: FormData) {
  const { db } = await requireUser();
  return runAction(async () => {
    const items = String(fd.get("locked") ?? "").split("\n").map((l) => l.trim()).filter(Boolean).map((label) => ({ label, locked: true }));
    await setLockedCharacteristics(db, channelId, items);
    revalidatePath("/channels");
  }, "Saved");
}
