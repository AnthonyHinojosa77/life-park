// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory";

const { db } = await import("@/lib/db");
const { runMigrations } = await import("@/lib/db/migrate");
const { auth } = await import("@/lib/auth");
const { defaultRules, getRules, resetRules, saveRules } = await import("./index");
const { buildInstructions } = await import("@/lib/chat/instructions");

describe("rules", () => {
  let userId = "";

  beforeAll(async () => {
    await runMigrations(db);
    const res = await auth.api.signUpEmail({
      body: { name: "Anthony", email: "rules@example.com", password: "a-long-enough-password" },
    });
    userId = res.user.id;
  });

  it("falls back to the repository's AGENTS.md", async () => {
    const r = await getRules(userId);
    expect(r.edited).toBe(false);
    expect(r.content).toBe(defaultRules);
    expect(defaultRules).toContain("Anthony's Global Agent Instructions");
  });

  it("saves an edit, then resets to the default", async () => {
    await saveRules(userId, "Always answer in one sentence.\n");
    const edited = await getRules(userId);
    expect(edited.edited).toBe(true);
    expect(edited.content).toBe("Always answer in one sentence.");
    await resetRules(userId);
    expect((await getRules(userId)).edited).toBe(false);
  });

  it("refuses empty rules", async () => {
    await expect(saveRules(userId, "   ")).rejects.toThrow();
  });

  it("puts the rules verbatim into the instructions", () => {
    const text = buildInstructions("Anthony", "Be brief.");
    expect(text).toContain("personal database and life assistant");
    expect(text.endsWith("Be brief.")).toBe(true);
  });
});
