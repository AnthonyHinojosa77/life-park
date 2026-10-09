// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory";

const { db } = await import("../db");
const { runMigrations } = await import("../db/migrate");
const { auth } = await import("../auth");
const { listParkThings } = await import("../things");
const { parkTools } = await import("./park-tools");

type Tools = ReturnType<typeof parkTools>;
/** Runs a tool the way the chat does: check the input, run it, read its JSON result. */
const run = async (tools: Tools, name: string, input: unknown) => {
  const tool = tools.find((t) => t.name === name)!;
  const runTool = tool.run as (input: unknown) => Promise<string>;
  return JSON.parse(await runTool(tool.parse(input)));
};

describe("park tools", () => {
  let userId = "";
  beforeAll(async () => {
    await runMigrations(db);
    const res = await auth.api.signUpEmail({
      body: { name: "Sam", email: "tools@example.com", password: "a-long-enough-password" },
    });
    userId = res.user.id;
  });

  it("files what the user says into the park", async () => {
    const tools = parkTools(userId);
    expect(await run(tools, "save_to_park", { kind: "person", title: "Sam Rivera", birthday: "11-03" })).toEqual({
      saved: true,
      kind: "person",
      title: "Sam Rivera",
    });
    await run(tools, "save_to_park", { kind: "recipe", title: "Chili", items: ["beans", "cumin"], date: "not a date" });
    const park = await listParkThings(userId);
    expect(park.find((t) => t.title === "Sam Rivera")?.detail.birthday).toEqual({ month: 11, day: 3, year: null });
    const chili = park.find((t) => t.title === "Chili")!;
    expect(chili.date).toBeNull();
    expect(chili.detail.items).toEqual([{ title: "beans" }, { title: "cumin" }]);
  });

  it("finds things by words and kind", async () => {
    const tools = parkTools(userId);
    const found = (await run(tools, "find_in_park", { query: "cumin" })) as { title: string }[];
    expect(found.map((f) => f.title)).toEqual(["Chili"]);
    const people = (await run(tools, "find_in_park", { kind: "person" })) as { title: string }[];
    expect(people.map((f) => f.title)).toEqual(["Sam Rivera"]);
  });

  it("refuses input that doesn't fit the schema", () => {
    const save = parkTools(userId).find((t) => t.name === "save_to_park")!;
    expect(() => save.parse({ kind: "spaceship", title: "x" })).toThrow();
    expect(() => save.parse({ kind: "person", title: "Sam", birthday: "March 3" })).toThrow();
  });

  it("describes both tools to Claude as JSON Schema objects", () => {
    for (const tool of parkTools(userId)) {
      expect("input_schema" in tool && tool.input_schema.type).toBe("object");
    }
  });
});
