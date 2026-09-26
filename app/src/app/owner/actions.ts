"use server";

import { revalidatePath } from "next/cache";
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
