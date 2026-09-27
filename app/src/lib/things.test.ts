// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory";

const { db } = await import("./db");
const { runMigrations } = await import("./db/migrate");
const { auth } = await import("./auth");
const { countByKind, listConnections, listParkThings, recordConnection, saveChatThing, upsertThings } =
  await import("./things");

describe("things", () => {
  let userId = "";

  beforeAll(async () => {
    await runMigrations(db);
    const res = await auth.api.signUpEmail({
      body: { name: "Sam", email: "things@example.com", password: "a-long-enough-password" },
    });
    userId = res.user.id;
  });

  it("saves imported items and updates them on the next import", async () => {
    await upsertThings(userId, "calendar", [
      { sourceId: "e1", kind: "event", title: "Dentist", date: new Date("2026-10-01T15:00:00Z") },
      { sourceId: "e2", kind: "event", title: "Trivia night" },
    ]);
    await upsertThings(userId, "calendar", [{ sourceId: "e1", kind: "event", title: "Dentist (moved)" }]);
    const list = await listParkThings(userId);
    expect(list.map((t) => t.title).sort()).toEqual(["Dentist (moved)", "Trivia night"]);
  });

  it("keeps the same id from different sources apart", async () => {
    await upsertThings(userId, "tasks", [{ sourceId: "e1", kind: "list", title: "Groceries" }]);
    const list = await listParkThings(userId);
    expect(list.filter((t) => t.title === "Groceries")).toHaveLength(1);
    expect(list.filter((t) => t.title.startsWith("Dentist"))).toHaveLength(1);
  });

  it("tolerates repeats inside one batch and blank titles", async () => {
    const n = await upsertThings(userId, "drive", [
      { sourceId: "f1", kind: "file", title: "  " },
      { sourceId: "f1", kind: "file", title: "Budget" },
    ]);
    expect(n).toBe(1);
    const titles = (await listParkThings(userId)).map((t) => t.title);
    expect(titles).toContain("Budget");
  });

  it("files things from chat", async () => {
    await saveChatThing(userId, { kind: "recipe", title: "Grandma's chili", detail: { ingredients: ["beans"] } });
    const counts = countByKind(await listParkThings(userId));
    expect(counts.recipe).toBe(1);
    expect(counts.event).toBe(2);
    expect(counts.habit).toBe(0);
  });

  it("records how each connection went", async () => {
    await recordConnection(userId, "calendar", { status: "connected", itemCount: 2 });
    await recordConnection(userId, "calendar", { status: "error", lastError: "Token expired" });
    const [c] = await listConnections(userId);
    expect(c.status).toBe("error");
    expect(c.lastError).toBe("Token expired");
  });
});
