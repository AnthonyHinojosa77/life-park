// @vitest-environment node
import { beforeAll, describe, expect, it } from "vitest";

process.env.PGLITE_DIR = "memory";

const { db } = await import("../db");
const { runMigrations } = await import("../db/migrate");
const { auth } = await import("../auth");
const { listParkThings } = await import("../things");
const { parkTools } = await import("./park-tools");

type Exec = (input: unknown, opts: unknown) => Promise<unknown>;
const run = (t: { execute?: unknown }, input: unknown) => (t.execute as Exec)(input, { toolCallId: "t", messages: [] });

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
    expect(await run(tools.save_to_park, { kind: "person", title: "Sam Rivera", birthday: "11-03" })).toEqual({
      saved: true,
      kind: "person",
      title: "Sam Rivera",
    });
    await run(tools.save_to_park, { kind: "recipe", title: "Chili", items: ["beans", "cumin"], date: "not a date" });
    const park = await listParkThings(userId);
    expect(park.find((t) => t.title === "Sam Rivera")?.detail.birthday).toEqual({ month: 11, day: 3, year: null });
    const chili = park.find((t) => t.title === "Chili")!;
    expect(chili.date).toBeNull();
    expect(chili.detail.items).toEqual([{ title: "beans" }, { title: "cumin" }]);
  });

  it("finds things by words and kind", async () => {
    const tools = parkTools(userId);
    const found = (await run(tools.find_in_park, { query: "cumin" })) as { title: string }[];
    expect(found.map((f) => f.title)).toEqual(["Chili"]);
    const people = (await run(tools.find_in_park, { kind: "person" })) as { title: string }[];
    expect(people.map((f) => f.title)).toEqual(["Sam Rivera"]);
  });
});
