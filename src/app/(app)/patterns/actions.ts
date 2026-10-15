"use server";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/session";
import { runAction } from "@/lib/actions";
import { createPattern } from "@/lib/services/patterns";

const list = (v: FormDataEntryValue | null) => String(v ?? "").split(",").map((s) => s.trim()).filter(Boolean);

export async function createPatternAction(_: unknown, fd: FormData) {
  const { db, user } = await requireUser();
  const s = (k: string) => String(fd.get(k) ?? "");
  return runAction(async () => {
    await createPattern(db, {
      name: s("name"), description: s("description"), subjectPosition: s("subjectPosition"), primaryObject: s("primaryObject"),
      objectTreatment: s("objectTreatment"), background: s("background"), textTreatment: s("textTreatment"),
      curiosityMechanism: s("curiosityMechanism"), emotionalMechanism: s("emotionalMechanism"),
      categories: list(fd.get("categories")), tags: list(fd.get("tags")),
    }, user.id);
    revalidatePath("/patterns");
  }, "Pattern saved");
}
