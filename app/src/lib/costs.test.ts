// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory";

const { db } = await import("@/lib/db");
const { runMigrations } = await import("@/lib/db/migrate");
const { auth } = await import("@/lib/auth");
const { saveMessage, touchConversation } = await import("@/lib/chat/store");
const { formatDollars, monthlyCosts } = await import("./costs");

describe("monthlyCosts", () => {
  let userId = "";

  beforeAll(async () => {
    await runMigrations(db);
    const res = await auth.api.signUpEmail({
      body: { name: "Anthony", email: "costs@example.com", password: "a-long-enough-password" },
    });
    userId = res.user.id;
    await touchConversation({ id: "c-1", userId, modelId: "a/one", title: "One" });
    await saveMessage({ id: "u1", conversationId: "c-1", role: "user", parts: [] });
    await saveMessage({ id: "a1", conversationId: "c-1", role: "assistant", parts: [], modelId: "a/one", costMicros: 1500 });
    await saveMessage({ id: "a2", conversationId: "c-1", role: "assistant", parts: [], modelId: "a/two", costMicros: 250 });
    await saveMessage({ id: "a3", conversationId: "c-1", role: "assistant", parts: [], modelId: "a/one", costMicros: 500 });
  });

  it("totals the month and groups by model, biggest first", async () => {
    const c = await monthlyCosts(userId);
    expect(c.monthMicros).toBe(2250);
    expect(c.byModel).toEqual([
      { modelId: "a/one", micros: 2000, replies: 2 },
      { modelId: "a/two", micros: 250, replies: 1 },
    ]);
    expect(c.byDay).toHaveLength(1);
    expect(c.byDay[0].micros).toBe(2250);
  });

  it("totals everyone when no user is given", async () => {
    const other = await auth.api.signUpEmail({
      body: { name: "Sam", email: "costs-2@example.com", password: "a-long-enough-password" },
    });
    await touchConversation({ id: "c-2", userId: other.user.id, modelId: "a/two", title: "Two" });
    await saveMessage({ id: "b1", conversationId: "c-2", role: "assistant", parts: [], modelId: "a/two", costMicros: 750 });

    const everyone = await monthlyCosts(null);
    expect(everyone.monthMicros).toBe(3000);
    expect(everyone.activePeople).toBe(2);
    const mine = await monthlyCosts(userId);
    expect(mine.monthMicros).toBe(2250);
    expect(mine.activePeople).toBe(1);
  });

  it("formats dollars readably", () => {
    expect(formatDollars(0)).toBe("$0.00");
    expect(formatDollars(2300)).toBe("$0.0023");
    expect(formatDollars(12_340_000)).toBe("$12.34");
  });
});
