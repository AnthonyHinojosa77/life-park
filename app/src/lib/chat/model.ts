import { createOpenRouter } from "@openrouter/ai-sdk-provider";

export class ModelsUnavailableError extends Error {
  constructor() {
    super("No OpenRouter key is set. Add OPENROUTER_API_KEY to reach the models.");
    this.name = "ModelsUnavailableError";
  }
}

/** The language model for an OpenRouter slug such as "anthropic/claude-sonnet-5". */
export function getLanguageModel(modelId: string) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new ModelsUnavailableError();
  const openrouter = createOpenRouter({
    apiKey,
    // Only set in tests, to point at a local stand-in for OpenRouter.
    baseURL: process.env.OPENROUTER_BASE_URL || undefined,
    headers: {
      "HTTP-Referer": process.env.BETTER_AUTH_URL ?? "https://workpark.app",
      "X-Title": "LifePark",
    },
  });
  return openrouter.chat(modelId);
}
