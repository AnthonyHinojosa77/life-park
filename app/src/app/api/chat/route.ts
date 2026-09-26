import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  streamText,
  toUIMessageStream,
  type UIMessage,
} from "ai";
import { z } from "zod";
import { buildInstructions } from "@/lib/chat/instructions";
import { assistantModelId, getLanguageModel, ModelsUnavailableError } from "@/lib/chat/model";
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
  const modelId = settings?.assistantModel || assistantModelId();

  let model;
  try {
    model = getLanguageModel(modelId);
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
  const result = streamText({
    model,
    instructions: buildInstructions(session.user.name, rulesText),
    messages: await convertToModelMessages(messages),
    onEnd: async ({ text, usage, finalStep }) => {
      const openrouter = finalStep?.providerMetadata?.openrouter as
        | { usage?: { cost?: number } }
        | undefined;
      const cost = openrouter?.usage?.cost;
      await saveMessage({
        id: assistantId,
        conversationId,
        role: "assistant",
        parts: [{ type: "text", text }],
        modelId,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costMicros: typeof cost === "number" ? Math.round(cost * 1_000_000) : undefined,
      });
    },
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({
      stream: result.stream,
      generateMessageId: () => assistantId,
      messageMetadata: () => ({ modelId }),
    }),
  });
}
