import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export class ModelsUnavailableError extends Error {
  constructor() {
    // Shown to people in the chat, so it stays plain. The missing setting is OPENROUTER_API_KEY.
    super("Your assistant isn't switched on yet. Please try again a little later.");
    this.name = "ModelsUnavailableError";
  }
}

/**
 * The one AI behind LifePark. Users never see or choose it.
 * Provisional default until candidates are tested on filing, reminders, and
 * recaps; LIFEPARK_MODEL overrides it without a code change.
 */
export const defaultAssistantModel = "google/gemini-3.8-flash";

export function assistantModelId(env: Record<string, string | undefined> = process.env) {
  return env.LIFEPARK_MODEL?.trim() || defaultAssistantModel;
}

/** The language model for an OpenRouter slug. Defaults to the assistant model. */
export function getLanguageModel(modelId: string = assistantModelId()) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new ModelsUnavailableError();
  const openrouter = createOpenRouter({
    apiKey,
    // Only set in tests, to point at a local stand-in for OpenRouter.
    baseURL: process.env.OPENROUTER_BASE_URL || undefined,
    headers: {
      "HTTP-Referer": process.env.BETTER_AUTH_URL ?? "https://lifepark.app",
      "X-Title": "LifePark",
    },
  });
  return openrouter.chat(modelId);
}
