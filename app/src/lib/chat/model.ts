import Anthropic from "@anthropic-ai/sdk";

export class ModelsUnavailableError extends Error {
  constructor() {
    // Shown to people in the chat, so it stays plain. The missing setting is ANTHROPIC_API_KEY.
    super("Your assistant isn't switched on yet. Please try again a little later.");
    this.name = "ModelsUnavailableError";
  }
}

/** The Claude models LifePark runs on, billed to the owner's own Anthropic account. */
export const assistantModels = [
  { id: "claude-opus-5-5", name: "Claude Opus 5.5" },
  { id: "claude-sonnet-5-5", name: "Claude Sonnet 5.5" },
  { id: "claude-haiku-5-5", name: "Claude Haiku 5.5" },
] as const;

export type AssistantModelId = (typeof assistantModels)[number]["id"];

/** The one AI behind LifePark. Users never see or choose it; LIFEPARK_MODEL can switch it. */
export const defaultAssistantModel: AssistantModelId = "claude-opus-5-5";

export function isAssistantModel(id: string | null | undefined): id is AssistantModelId {
  return assistantModels.some((m) => m.id === id);
}

export function assistantModelName(id: string) {
  return assistantModels.find((m) => m.id === id)?.name ?? id;
}

export function assistantModelId(env: Record<string, string | undefined> = process.env): AssistantModelId {
  const chosen = env.LIFEPARK_MODEL?.trim();
  return isAssistantModel(chosen) ? chosen : defaultAssistantModel;
}

/** A client for the owner's Anthropic account. */
export function anthropicClient(env: Record<string, string | undefined> = process.env) {
  const apiKey = env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new ModelsUnavailableError();
  // ANTHROPIC_BASE_URL is only set in tests, to point at a local stand-in.
  return new Anthropic({ apiKey, baseURL: env.ANTHROPIC_BASE_URL || undefined });
}
