import Anthropic from "@anthropic-ai/sdk";
import { createUIMessageStream, createUIMessageStreamResponse, type UIMessage } from "ai";
import { z } from "zod";
import { runAgent, toClaudeHistory } from "@/lib/chat/agent";
import { runRoutedAgent } from "@/lib/chat/router";
import { buildInstructions } from "@/lib/chat/instructions";
import { parkTools } from "@/lib/chat/park-tools";
import { anthropicClient, assistantModelId, isModelChoice, ModelsUnavailableError, SMART_ROUTING } from "@/lib/chat/model";
import { saveMessage, textOf, titleFromText, touchConversation } from "@/lib/chat/store";
import { getRules } from "@/lib/rules";
import { isOwner } from "@/lib/owner";
import { getSession } from "@/lib/session";
import { getSettings } from "@/lib/settings";

const bodySchema = z.object({
  conversationId: z.string().min(8).max(64),
  messages: z.array(z.custom<UIMessage>((m) => typeof m === "object" && m !== null)).min(1),
});

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Sign in first." }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Bad request." }, { status: 400 });
  const { conversationId, messages } = parsed.data;
  // Everyone gets the one assistant model. The owner can switch their own
  // account for the model trial; the override is ignored for anyone else.
  const settings = isOwner(session.user.email) ? await getSettings(session.user.id) : null;
  const modelId = isModelChoice(settings?.assistantModel) ? settings.assistantModel : assistantModelId();

  let client;
  try {
    client = anthropicClient();
  } catch (error) {
    if (error instanceof ModelsUnavailableError) {
      return Response.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }

  const last = messages[messages.length - 1];
  if (last.role !== "user") return Response.json({ error: "Bad request." }, { status: 400 });

  await touchConversation({
    id: conversationId,
    userId: session.user.id,
    modelId,
    title: titleFromText(textOf(last)),
  });
  await saveMessage({ id: last.id, conversationId, role: "user", parts: last.parts });

  const assistantId = crypto.randomUUID();
  const { content: rulesText } = await getRules(session.user.id);
  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId: assistantId, messageMetadata: { modelId } });
      const shared = {
        client,
        system: buildInstructions(session.user.name, rulesText),
        history: toClaudeHistory(messages),
        tools: parkTools(session.user.id),
        writer,
      };
      const reply =
        modelId === SMART_ROUTING
          ? await runRoutedAgent(shared)
          : { ...(await runAgent({ ...shared, model: modelId })), model: modelId };
      await saveMessage({
        id: assistantId,
        conversationId,
        role: "assistant",
        parts: [{ type: "text", text: reply.text }],
        // The model that wrote the reply, so the owner dashboard shows where routed replies landed.
        modelId: reply.model,
        inputTokens: reply.inputTokens,
        outputTokens: reply.outputTokens,
        costMicros: Math.round(reply.costMicros),
      });
      writer.write({ type: "finish", messageMetadata: { modelId: reply.model } });
    },
    onError: plainError,
  });
  return createUIMessageStreamResponse({ stream });
}

/** What the person sees when Claude can't be reached. The details go to the server log. */
function plainError(error: unknown) {
  console.error("[chat]", error);
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return new ModelsUnavailableError().message;
  }
  if (error instanceof Anthropic.RateLimitError) return "Your assistant is busy right now. Try again in a minute.";
  if (error instanceof Anthropic.InternalServerError || error instanceof Anthropic.APIConnectionError) {
    return "Your assistant couldn't be reached. Try again in a moment.";
  }
  return "Something went wrong with that reply. Try again.";
}
