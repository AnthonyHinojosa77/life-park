"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { deleteAccount } from "@/lib/account";
import { auth } from "@/lib/auth";
import { requireSession } from "@/lib/session";
import { resetRules, saveRules } from "@/lib/rules";
import { getSettings, parseSettings, saveSettings } from "@/lib/settings";
import { disconnectGitHub } from "@/lib/github/import";

export async function updateRules(content: string) {
  const session = await requireSession();
  try {
    await saveRules(session.user.id, content);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

export async function restoreDefaultRules() {
  const session = await requireSession();
  await resetRules(session.user.id);
  revalidatePath("/settings");
  return { ok: true };
}

export async function updatePreferences(patch: {
  navigation?: "list" | "park";
  voice?: "speechify" | "device";
  monthlyLimitCents?: number;
}) {
  const session = await requireSession();
  const current = await getSettings(session.user.id);
  if (!current) return { error: "Finish onboarding first." };
  try {
    const next = parseSettings({
      favoriteModels: current.favoriteModels,
      navigation: patch.navigation ?? current.navigation,
      voice: patch.voice ?? current.voice,
      monthlyLimitCents: patch.monthlyLimitCents ?? current.monthlyLimitCents,
    });
    await saveSettings(session.user.id, next);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save." };
  }
  revalidatePath("/settings");
  return { ok: true };
}

/** Deletes the signed-in person's account and everything in it, after they type "delete" to confirm. */
export async function deleteMyAccount(confirmation: string) {
  const session = await requireSession();
  if (confirmation.trim().toLowerCase() !== "delete") return { error: 'Type "delete" to confirm.' };
  const h = await headers();
  // Sign out first so the browser's sign-in cookie is cleared, then remove everything.
  await auth.api.signOut({ headers: h }).catch(() => null);
  await deleteAccount(session.user.id);
  redirect("/sign-up");
}

/** Disconnects GitHub: forgets the installations and takes the repositories out of the park. */
export async function disconnectGitHubAction() {
  const session = await requireSession();
  await disconnectGitHub(session.user.id);
  revalidatePath("/settings");
  revalidatePath("/park");
  return { ok: true };
}
