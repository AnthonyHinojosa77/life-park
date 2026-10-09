import Anthropic from "@anthropic-ai/sdk";
import type { BetaRunnableTool } from "@anthropic-ai/sdk/lib/tools/BetaRunnableTool";
import type { UIMessage, UIMessageStreamWriter } from "ai";
import type { AssistantModelId } from "./model";
import { costMicros } from "./pricing";

type MessageParam = Anthropic.Beta.BetaMessageParam;
type ContentBlock = Anthropic.Beta.BetaContentBlock;

/** Room to save something, then reply about it. */
const MAX_STEPS = 4;

export const REFUSAL_TEXT = "I can't help with that one.";

/** A message's words, one text part per paragraph. */
export function plainText(message: Pick<UIMessage, "parts">) {
  return message.parts
    .filter((p): p is Extract<UIMessage["parts"][number], { type: "text" }> => p.type === "text")
    .map((p) => p.text.trim())
    .filter(Boolean)
    .join("\n\n");
}

/**
 * Earlier turns go back to Claude as plain words. Their tool calls and
 * thinking are left out on purpose: Claude only accepts earlier thinking that
 * comes back byte-for-byte unchanged, and a thread reopened from the database
 * keeps just the words. Sending the same words either way also keeps the
 * prompt cache warm from one message to the next.
 */
export function toClaudeHistory(messages: UIMessage[]): MessageParam[] {
  const out: MessageParam[] = [];
  for (const m of messages) {
    if (m.role !== "user" && m.role !== "assistant") continue;
    const text = plainText(m);
    if (!text || (out.length === 0 && m.role !== "user")) continue;
    out.push({ role: m.role, content: text });
  }
  return out;
}

/**
 * After a refusal fallback partway through a reply, the declined model's
 * thinking and tool calls before the switch are not sent back; its words are.
 */
function echoable(content: ContentBlock[]) {
  const boundary = content.map((b) => b.type).lastIndexOf("fallback");
  if (boundary < 0) return content;
  const dropped = new Set(["thinking", "redacted_thinking", "tool_use", "server_tool_use"]);
  return content.filter((b, i) => i > boundary || !dropped.has(b.type));
}

/** Anthropic re-runs a declined request on its recommended model. Not offered for Claude Haiku 5.5. */
function fallbackOptions(model: AssistantModelId) {
  return model === "claude-haiku-5-5"
    ? {}
    : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
}

function stepCost(message: Anthropic.Beta.BetaMessage, requested: AssistantModelId) {
  // Each attempt (the declined one and the fallback) is billed at its own model's prices.
  const attempts = message.usage.iterations ?? [];
  if (attempts.length === 0) return costMicros(message.usage, message.model, requested);
  return attempts.reduce((sum, a) => sum + costMicros(a, ("model" in a && a.model) || message.model, requested), 0);
}

export type AgentResult = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  costMicros: number;
};

/**
 * Runs one reply: streams Claude's words into the chat as they arrive, runs
 * the park tools it asks for, and goes around again until it is done.
 */
export async function runAgent(opts: {
  client: Anthropic;
  model: AssistantModelId;
  system: string;
  history: MessageParam[];
  tools: BetaRunnableTool[];
  writer: UIMessageStreamWriter;
}): Promise<AgentResult> {
  const { client, model, system, tools, writer } = opts;
  const turn: MessageParam[] = [];
  const said: string[] = [];
  const result: AgentResult = { text: "", inputTokens: 0, outputTokens: 0, costMicros: 0 };
  // Only the definitions go to Claude; the tools run here. Inputs stream as they are written.
  const definitions = tools.flatMap((t) =>
    "input_schema" in t
      ? [{ type: "custom" as const, name: t.name, description: t.description, input_schema: t.input_schema, eager_input_streaming: true }]
      : [],
  );

  for (let step = 0; step < MAX_STEPS; step++) {
    writer.write({ type: "start-step" });
    const stream = client.beta.messages.stream({
      model,
      max_tokens: 64000,
      system: [{ type: "text", text: system }],
      messages: [...opts.history, ...turn],
      tools: definitions,
      output_config: { effort: "medium" },
      cache_control: { type: "ephemeral" },
      ...fallbackOptions(model),
    });

    const open = new Set<number>();
    for await (const event of stream) {
      if (event.type === "content_block_start" && event.content_block.type === "text") {
        open.add(event.index);
        writer.write({ type: "text-start", id: `${step}-${event.index}` });
      } else if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        writer.write({ type: "tool-input-start", toolCallId: event.content_block.id, toolName: event.content_block.name });
      } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        writer.write({ type: "text-delta", id: `${step}-${event.index}`, delta: event.delta.text });
      } else if (event.type === "content_block_stop" && open.delete(event.index)) {
        writer.write({ type: "text-end", id: `${step}-${event.index}` });
      }
    }
    const message = await stream.finalMessage();
    result.inputTokens += message.usage.input_tokens + (message.usage.cache_read_input_tokens ?? 0) + (message.usage.cache_creation_input_tokens ?? 0);
    result.outputTokens += message.usage.output_tokens;
    result.costMicros += stepCost(message, model);

    if (message.stop_reason === "refusal") {
      // Even the fallback declined. Take back the partial reply and say so plainly.
      writer.write({ type: "reset-step" });
      writer.write({ type: "text-start", id: `${step}-refusal` });
      writer.write({ type: "text-delta", id: `${step}-refusal`, delta: REFUSAL_TEXT });
      writer.write({ type: "text-end", id: `${step}-refusal` });
      said.push(REFUSAL_TEXT);
      break;
    }

    for (const block of message.content) if (block.type === "text" && block.text.trim()) said.push(block.text.trim());
    // Only the calls that go back to Claude are run; a declined model's calls before a fallback are not.
    const content = echoable(message.content);
    const calls = content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    // A tool call cut off by max_tokens may look complete; never run it.
    if (message.stop_reason !== "tool_use" || calls.length === 0) {
      writer.write({ type: "finish-step" });
      break;
    }

    const results: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const call of calls) {
      const tool = tools.find((t) => t.name === call.name);
      let input: unknown;
      try {
        if (!tool) throw new Error(`There is no tool named ${call.name}.`);
        input = tool.parse(call.input);
      } catch (error) {
        const errorText = error instanceof Error ? error.message : "The tool input was not valid.";
        writer.write({ type: "tool-input-error", toolCallId: call.id, toolName: call.name, input: call.input, errorText });
        results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: errorText });
        continue;
      }
      writer.write({ type: "tool-input-available", toolCallId: call.id, toolName: call.name, input });
      try {
        const output = await tool.run(input, { toolUse: call, toolUseBlock: call });
        writer.write({ type: "tool-output-available", toolCallId: call.id, output });
        results.push({ type: "tool_result", tool_use_id: call.id, content: output });
      } catch (error) {
        console.error(`[chat] ${call.name} failed`, error);
        writer.write({ type: "tool-output-error", toolCallId: call.id, errorText: "That didn't work." });
        results.push({ type: "tool_result", tool_use_id: call.id, is_error: true, content: "The tool failed. Tell the user it didn't work." });
      }
    }
    writer.write({ type: "finish-step" });
    turn.push({ role: "assistant", content }, { role: "user", content: results });
  }

  result.text = said.join("\n\n");
  return result;
}
