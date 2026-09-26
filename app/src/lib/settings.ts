import { eq } from "drizzle-orm";
import { db } from "./db";
import { userSettings } from "./db/app-schema";

export type Settings = typeof userSettings.$inferSelect;
export type SettingsInput = {
  favoriteModels: string[];
  navigation: "list" | "park";
  voice: "speechify" | "device";
  monthlyLimitCents: number;
};

/** A balanced starting set: one strong model from each major lab. */
export const defaultFavoriteModels = [
  "anthropic/claude-sonnet-5",
  "openai/gpt-5.6-luna",
  "google/gemini-3.8-flash",
  "x-ai/grok-4.6",
  "deepseek/deepseek-v4-pro",
];

export const defaultSettings: SettingsInput = {
  favoriteModels: defaultFavoriteModels,
  navigation: "list",
  voice: "speechify",
  monthlyLimitCents: 2500,
};

export async function getSettings(userId: string): Promise<Settings | null> {
  const rows = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);
  return rows[0] ?? null;
}

/** Creates or replaces the user's settings and marks onboarding complete. */
export async function saveSettings(userId: string, input: SettingsInput) {
  const values = { ...input, userId, onboardedAt: new Date() };
  await db
    .insert(userSettings)
    .values(values)
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { ...input, onboardedAt: values.onboardedAt },
    });
}

/** Owner-only: which model answers this person's chats. Null means the default. */
export async function setAssistantModel(userId: string, modelId: string | null) {
  await db.update(userSettings).set({ assistantModel: modelId }).where(eq(userSettings.userId, userId));
}

/** Turns untrusted form data into a valid SettingsInput, or throws. */
export function parseSettings(raw: unknown): SettingsInput {
  const o = (raw ?? {}) as Record<string, unknown>;
  const favoriteModels = Array.isArray(o.favoriteModels)
    ? o.favoriteModels.filter((m): m is string => typeof m === "string" && m.length < 200).slice(0, 30)
    : [];
  if (favoriteModels.length === 0) {
    throw new Error("Pick at least one model.");
  }
  const navigation = o.navigation === "park" ? "park" : "list";
  const voice = o.voice === "device" ? "device" : "speechify";
  const cents = Number(o.monthlyLimitCents);
  if (!Number.isInteger(cents) || cents < 100 || cents > 1_000_000) {
    throw new Error("Monthly limit must be between $1 and $10,000.");
  }
  return { favoriteModels, navigation, voice, monthlyLimitCents: cents };
}
