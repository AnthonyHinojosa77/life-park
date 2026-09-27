"use server";

import { requireSession } from "@/lib/session";
import { defaultSettings, getSettings, saveSettings } from "@/lib/settings";

/**
 * Marks onboarding done, keeping any earlier choices. The park is where
 * everyone lands afterwards, so it becomes the default way around.
 */
export async function finishOnboarding() {
  const session = await requireSession();
  const existing = await getSettings(session.user.id);
  await saveSettings(session.user.id, {
    favoriteModels: existing?.favoriteModels ?? defaultSettings.favoriteModels,
    navigation: existing?.navigation ?? "park",
    voice: existing?.voice ?? defaultSettings.voice,
    monthlyLimitCents: existing?.monthlyLimitCents ?? defaultSettings.monthlyLimitCents,
  });
  return { ok: true };
}
