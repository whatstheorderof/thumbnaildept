"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth/session";
import { runAction } from "@/lib/actions";
import { createClientRecord, updateClientRecord, type ClientInput } from "@/lib/services/clients";

const split = (v: FormDataEntryValue | null) => String(v ?? "").split(/[,\n]/).map((s) => s.trim()).filter(Boolean);

function fromForm(fd: FormData): ClientInput {
  return {
    name: String(fd.get("name") ?? ""),
    marketplace: String(fd.get("marketplace") ?? "fiverr") as ClientInput["marketplace"],
    marketplaceUsername: String(fd.get("marketplaceUsername") ?? ""),
    email: String(fd.get("email") ?? ""),
    channelUrl: String(fd.get("channelUrl") ?? ""),
    brandColours: split(fd.get("brandColours")),
    preferredFonts: split(fd.get("preferredFonts")),
    visualPreferences: String(fd.get("visualPreferences") ?? ""),
    thingsToAvoid: String(fd.get("thingsToAvoid") ?? ""),
    notes: String(fd.get("notes") ?? ""),
  };
}

export async function createClientAction(_: unknown, fd: FormData) {
  const { db, actor } = await requireUser();
  const res = await runAction(() => createClientRecord(db, fromForm(fd), actor));
  if (res.ok) { revalidatePath("/clients"); redirect(`/clients/${res.data.id}`); }
  return res;
}

export async function updateClientAction(id: string, _: unknown, fd: FormData) {
  const { db } = await requireUser();
  return runAction(async () => {
    await updateClientRecord(db, id, fromForm(fd));
    revalidatePath(`/clients/${id}`);
    revalidatePath("/clients");
  }, "Saved");
}
