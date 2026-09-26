// @vitest-environment node
import { beforeAll, describe, expect, it, vi } from "vitest";
import { MockLanguageModelV4, convertArrayToReadableStream } from "ai/test";

process.env.PGLITE_DIR = "memory";

let sessionCookie = "";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: sessionCookie }),
}));

vi.mock("@/lib/chat/model", () => ({
  ModelsUnavailableError: class extends Error {},
  defaultAssistantModel: "test/assistant",
  assistantModelId: () => "test/assistant",
  getLanguageModel: () =>
    new MockLanguageModelV4({
      doStream: async () => ({
        stream: convertArrayToReadableStream([
          { type: "text-start", id: "t1" },
          { type: "text-delta", id: "t1", delta: "Hello " },
          { type: "text-delta", id: "t1", delta: "Anthony." },
          { type: "text-end", id: "t1" },
          {
            type: "finish",
            finishReason: { unified: "stop", raw: "stop" },
            usage: {
              inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
              outputTokens: { total: 4, text: 4, reasoning: 0 },
            },
            providerMetadata: { openrouter: { usage: { cost: 0.00042 } } },
          },
        ]),
      }),
    }),
}));

const { db } = await import("@/lib/db");
const { runMigrations } = await import("@/lib/db/migrate");
const { auth } = await import("@/lib/auth");
const { saveSettings, defaultSettings, setAssistantModel } = await import("@/lib/settings");
const { getMessages, listConversations } = await import("@/lib/chat/store");
const { POST } = await import("./route");
const { defaultAssistantModel } = await import("@/lib/chat/model");

const conversationId = "11111111-1111-1111-1111-111111111111";

function request(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  let userId = "";

  beforeAll(async () => {
    await runMigrations(db);
    const res = await auth.api.signUpEmail({
      body: { name: "Anthony", email: "chat@example.com", password: "a-long-enough-password" },
      asResponse: true,
    });
    sessionCookie = res.headers.get("set-cookie") ?? "";
    const session = await auth.api.getSession({ headers: new Headers({ cookie: sessionCookie }) });
    userId = session!.user.id;
    await saveSettings(userId, defaultSettings);
  });

  it("rejects a request without messages", async () => {
    const res = await POST(request({ conversationId, messages: [] }));
    expect(res.status).toBe(400);
  });

  it("streams a reply and stores both messages with cost", async () => {
    const res = await POST(
      request({
        conversationId,
        messages: [{ id: "m1", role: "user", parts: [{ type: "text", text: "Say hello" }] }],
      }),
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("Hello ");
    expect(body).toContain("Anthony.");

    const threads = await listConversations(userId);
    expect(threads).toHaveLength(1);
    expect(threads[0].title).toBe("Say hello");

    const stored = await getMessages(conversationId);
    expect(stored.map((m) => m.role)).toEqual(["user", "assistant"]);
    const reply = stored[1];
    expect((reply.parts[0] as { text: string }).text).toBe("Hello Anthony.");
    expect(reply.metadata).toMatchObject({ modelId: defaultAssistantModel, costMicros: 420 });
  });

  it("uses the owner's trial model for the owner only", async () => {
    await setAssistantModel(userId, "qwen/qwen3.8-flash");
    const send = async (id: string) => {
      const res = await POST(
        request({ conversationId, messages: [{ id, role: "user", parts: [{ type: "text", text: "hi" }] }] }),
      );
      await res.text();
      const stored = await getMessages(conversationId);
      return stored[stored.length - 1].metadata as { modelId: string };
    };

    process.env.OWNER_EMAILS = "chat@example.com";
    expect((await send("m-owner")).modelId).toBe("qwen/qwen3.8-flash");

    // The same stored override does nothing for someone who is not an owner.
    process.env.OWNER_EMAILS = "";
    expect((await send("m-guest")).modelId).toBe(defaultAssistantModel);
    await setAssistantModel(userId, null);
  });

  it("requires a session", async () => {
    sessionCookie = "";
    const res = await POST(
      request({
        conversationId,
        messages: [{ id: "m2", role: "user", parts: [{ type: "text", text: "hi" }] }],
      }),
    );
    expect(res.status).toBe(401);
  });
});
