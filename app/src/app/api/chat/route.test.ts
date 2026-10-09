// @vitest-environment node
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createMockAnthropic } from "../../../../e2e/mock-anthropic.mjs";

process.env.PGLITE_DIR = "memory";

let sessionCookie = "";

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ cookie: sessionCookie }),
}));

// A stand-in for Anthropic that enforces the Claude 5.5 request rules.
const anthropic = createMockAnthropic();
await new Promise<void>((r) => anthropic.listen(0, "127.0.0.1", r));
process.env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${(anthropic.address() as AddressInfo).port}`;
process.env.ANTHROPIC_API_KEY = "test-key";

const { db } = await import("@/lib/db");
const { runMigrations } = await import("@/lib/db/migrate");
const { auth } = await import("@/lib/auth");
const { saveSettings, defaultSettings, setAssistantModel } = await import("@/lib/settings");
const { getMessages, listConversations } = await import("@/lib/chat/store");
const { listParkThings } = await import("@/lib/things");
const { REFUSAL_TEXT } = await import("@/lib/chat/agent");
const { POST } = await import("./route");

const conversationId = "11111111-1111-1111-1111-111111111111";
type Sent = { body: Record<string, unknown> & { messages: { role: string; content: unknown }[] }; headers: Record<string, string> };
const lastSent = () => anthropic.requests.at(-1) as Sent;

function request(body: unknown) {
  return new Request("http://localhost/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const say = (id: string, text: string) => ({ id, role: "user", parts: [{ type: "text", text }] });

async function send(id: string, text: string, earlier: unknown[] = []) {
  const res = await POST(request({ conversationId, messages: [...earlier, say(id, text)] }));
  return { res, body: await res.text() };
}

async function lastStored() {
  const stored = await getMessages(conversationId);
  return stored[stored.length - 1] as { parts: { text: string }[]; metadata: { modelId: string; costMicros: number } };
}

afterAll(() => {
  anthropic.closeAllConnections();
  anthropic.close();
});

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

  it("streams Claude Opus 5.5's reply and stores both messages with cost", async () => {
    const { res, body } = await send("m1", "Say hello");
    expect(res.status).toBe(200);
    // Words stream to the chat one at a time.
    expect(body).toContain('"type":"text-delta","id":"0-1","delta":"Hello"');

    const threads = await listConversations(userId);
    expect(threads[0].title).toBe("Say hello");
    const stored = await getMessages(conversationId);
    expect(stored.map((m) => m.role)).toEqual(["user", "assistant"]);
    const reply = await lastStored();
    expect(reply.parts[0].text).toBe("Hello from the mock. You asked: Say hello");
    // 20 input tokens at $4 and 8 output tokens at $20 per million.
    expect(reply.metadata).toMatchObject({ modelId: "claude-opus-5-5", costMicros: 240 });
  });

  it("asks the way the Claude 5.5 models require", async () => {
    await send("m-shape", "Shape check");
    const { body, headers } = lastSent();
    expect(anthropic.problems).toEqual([]);
    expect(body.model).toBe("claude-opus-5-5");
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("tool_choice");
    expect(body.output_config).toEqual({ effort: "medium" });
    expect(body.cache_control).toEqual({ type: "ephemeral" });
    expect(body.fallbacks).toBe("default");
    expect(headers["anthropic-beta"]).toContain("server-side-fallback-2026-07-01");
    const tools = body.tools as { name: string; eager_input_streaming: boolean; input_schema: { type: string } }[];
    expect(tools.map((t) => t.name)).toEqual(["save_to_park", "find_in_park"]);
    expect(tools.every((t) => t.eager_input_streaming && t.input_schema.type === "object")).toBe(true);
    expect(JSON.stringify(body.system)).toContain("LifePark");
  });

  it("files something into the park with a tool, then confirms", async () => {
    const before = anthropic.requests.length;
    const { body } = await send("m-remember", "Remember: Grandma's chili");
    expect(body).toContain('"type":"tool-input-available"');
    expect(body).toContain('"toolName":"save_to_park"');
    expect(body).toContain('"type":"tool-output-available"');
    expect((await lastStored()).parts[0].text).toBe("Saved it to your park.");
    expect((await listParkThings(userId)).some((t) => t.title === "Grandma's chili")).toBe(true);

    // The second call carried the first call's thinking block back unchanged.
    expect(anthropic.requests.length - before).toBe(2);
    expect(anthropic.problems).toEqual([]);
    const echoed = lastSent().body.messages.at(-2)!.content as { type: string }[];
    expect(echoed.map((b) => b.type)).toEqual(["thinking", "tool_use"]);
    // Two calls, each 20 input tokens at $4 and 5 output tokens at $20 per million.
    expect((await lastStored()).metadata.costMicros).toBe(360);
  });

  it("sends earlier turns back as plain words only", async () => {
    await send("m-history", "And now?", [
      say("h1", "First question"),
      {
        id: "h2",
        role: "assistant",
        parts: [
          { type: "reasoning", text: "" },
          { type: "text", text: "Let me save that." },
          { type: "tool-save_to_park", toolCallId: "t1", state: "output-available", input: { kind: "note", title: "x" }, output: "{}" },
          { type: "text", text: "Saved." },
        ],
      },
    ]);
    expect(lastSent().body.messages).toEqual([
      { role: "user", content: "First question" },
      { role: "assistant", content: "Let me save that.\n\nSaved." },
      { role: "user", content: "And now?" },
    ]);
  });

  it("uses the owner's trial model for the owner only", async () => {
    process.env.OWNER_EMAILS = "chat@example.com";
    await setAssistantModel(userId, "claude-haiku-5-5");
    await send("m-owner", "hi");
    expect((await lastStored()).metadata.modelId).toBe("claude-haiku-5-5");
    // Claude Haiku 5.5 has no server-side fallback, so none is asked for.
    expect(lastSent().body).not.toHaveProperty("fallbacks");
    expect(anthropic.problems).toEqual([]);

    // A trial model left over from OpenRouter falls back to the default.
    await setAssistantModel(userId, "qwen/qwen3.8-flash");
    await send("m-old", "hi");
    expect((await lastStored()).metadata.modelId).toBe("claude-opus-5-5");

    // The same stored override does nothing for someone who is not an owner.
    await setAssistantModel(userId, "claude-haiku-5-5");
    process.env.OWNER_EMAILS = "";
    await send("m-guest", "hi");
    expect((await lastStored()).metadata.modelId).toBe("claude-opus-5-5");
    await setAssistantModel(userId, null);
  });

  it("takes back a declined reply and says so plainly", async () => {
    const { body } = await send("m-refuse", "Refuse this");
    expect(body).toContain('"type":"reset-step"');
    expect(body).toContain(`"delta":"${REFUSAL_TEXT}"`);
    expect((await lastStored()).parts[0].text).toBe(REFUSAL_TEXT);
  });

  it("explains a rejected API key without leaking details", async () => {
    process.env.ANTHROPIC_API_KEY = "bad-key";
    const { body } = await send("m-badkey", "hi");
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(body).toContain("isn't switched on yet");
    expect(body).not.toContain("x-api-key");
  });

  it("says the assistant is off when no API key is set", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const { res } = await send("m-nokey", "hi");
    process.env.ANTHROPIC_API_KEY = "test-key";
    expect(res.status).toBe(503);
  });

  it("requires a session", async () => {
    sessionCookie = "";
    const { res } = await send("m2", "hi");
    expect(res.status).toBe(401);
  });
});
