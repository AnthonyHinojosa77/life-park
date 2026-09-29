"use server";

import { revalidatePath } from "next/cache";
import { deleteAccount, findUserByEmail } from "@/lib/account";
import { isTrialModel, requireOwner } from "@/lib/owner";
import { parseSettings, saveSettings, setAssistantModel } from "@/lib/settings";

/** Switches the model for the owner's own account only. Null goes back to the default. */
export async function setMyModel(modelId: string | null) {
  const { session } = await requireOwner();
  if (modelId !== null && !isTrialModel(modelId)) return { error: "That model is not in the trial." };
  await setAssistantModel(session.user.id, modelId);
  revalidatePath("/owner");
  return { ok: true };
}

/** The app-wide monthly spend at which the dashboard warns. */
export async function setBudget(cents: number) {
  const { session, settings } = await requireOwner();
  try {
    await saveSettings(
      session.user.id,
      parseSettings({
        favoriteModels: settings.favoriteModels,
        navigation: settings.navigation,
        voice: settings.voice,
        monthlyLimitCents: cents,
      }),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Could not save." };
  }
  revalidatePath("/owner");
  return { ok: true };
}

/** Removes another person's account and everything in it. Owners delete their own account from Settings. */
export async function removePerson(email: string) {
  const { session } = await requireOwner();
  const person = await findUserByEmail(email);
  if (!person) return { error: "No account with that email." };
  if (person.id === session.user.id) return { error: "Delete your own account from Settings." };
  await deleteAccount(person.id);
  revalidatePath("/owner");
  return { ok: true, deleted: person.email };
}
