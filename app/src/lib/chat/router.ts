import type Anthropic from "@anthropic-ai/sdk";
import { HAND_OFF, runAgent, type AgentResult } from "./agent";
import { assistantModelName, type AssistantModelId } from "./model";

/** Cheapest first. Each model but the last can pass a message up to the next. */
export const routingTiers: AssistantModelId[] = ["claude-haiku-5-5", "claude-sonnet-5-5", "claude-opus-5-5"];

const handOffDefinition = (next: AssistantModelId): Anthropic.Beta.BetaTool => ({
  type: "custom",
  name: HAND_OFF,
  description: `Pass this message to ${assistantModelName(next)}, a more capable model, which then answers it instead of you. Call it first, before writing anything or using another tool.`,
  input_schema: {
    type: "object",
    properties: { reason: { type: "string", description: "A few words on why this needs a more capable model" } },
    required: ["reason"],
    additionalProperties: false,
  },
});

/** When each model should answer, and when it should pass the message up. */
const notes: Partial<Record<AssistantModelId, string>> = {
  "claude-haiku-5-5": [
    "Routing: you answer first, and two more capable models, Claude Sonnet 5.5 and then Claude Opus 5.5, stand behind you.",
    "Answer it yourself when the message is everyday: saving or finding things in the park, short factual answers, quick plans, and friendly conversation.",
    "Call hand_off instead, before writing anything or using any other tool, when a good answer needs careful multi-step reasoning, long or carefully written text, medical, legal, or financial advice, or when you are not confident you would answer it well.",
    "Comparing, weighing, or planning around things saved in the park counts too: hand it off before looking anything up, because the next model looks things up itself.",
    "The person never sees the hand-off, so never mention it.",
  ].join(" "),
  "claude-sonnet-5-5": [
    "Routing: a lighter model passed this message to you because it needs more care. Answer it yourself.",
    "Call hand_off to Claude Opus 5.5 instead, before writing anything or using any other tool, only for the hardest requests: long chains of reasoning, complex analysis or planning with many constraints, or work where a mistake would be costly.",
    "The person never sees the hand-off, so never mention it.",
  ].join(" "),
};

/**
 * Smart routing: Claude Haiku 5.5 takes each message first and either answers
 * or passes it to Claude Sonnet 5.5, which either answers or passes it to
 * Claude Opus 5.5. The reply's cost includes every model that looked at it.
 */
export async function runRoutedAgent(
  opts: Omit<Parameters<typeof runAgent>[0], "model" | "handOff">,
): Promise<AgentResult & { model: AssistantModelId }> {
  const spent = { inputTokens: 0, outputTokens: 0, costMicros: 0 };
  for (const [i, model] of routingTiers.entries()) {
    const next = routingTiers[i + 1];
    const reply = await runAgent({
      ...opts,
      model,
      handOff: next ? { definition: handOffDefinition(next), note: notes[model]! } : undefined,
    });
    spent.inputTokens += reply.inputTokens;
    spent.outputTokens += reply.outputTokens;
    spent.costMicros += reply.costMicros;
    if (!reply.handedOff) return { ...reply, ...spent, model };
  }
  throw new Error("The last model in the routing chain can't pass a message on.");
}
