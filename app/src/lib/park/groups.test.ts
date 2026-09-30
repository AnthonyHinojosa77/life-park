import { describe, expect, it } from "vitest";
import type { ParkThing } from "../things";
import { groupThings } from "./groups";

const now = Date.parse("2026-09-30T12:00:00Z");
const day = 86400000;
let n = 0;
const thing = (kind: ParkThing["kind"], title: string, extra: Partial<ParkThing> = {}): ParkThing => ({
  id: `t${n++}`,
  kind,
  title,
  source: "chat",
  date: null,
  createdAt: new Date(now - day).toISOString(),
  detail: {},
  ...extra,
});

describe("park categories", () => {
  it("sorts neighbors into family, birthdays soon, and streets, leaving out empty ones", () => {
    const few = groupThings("person", [thing("person", "Mom"), thing("person", "Sam Rivera", { detail: { birthday: { month: 10, day: 5 } } }), thing("person", "Priya Shah")], now);
    expect(few.map((g) => [g.name, g.things.length])).toEqual([["Family", 1], ["Birthdays soon", 1], ["Everyone else", 1]]);
    const many = groupThings("person", Array.from({ length: 30 }, (_, i) => thing("person", `${String.fromCharCode(65 + (i % 26))}ora`)), now);
    expect(many.map((g) => g.name)).toEqual(["A–D Street", "E–H Street", "I–L Street", "M–P Street", "Q–T Street", "U–Z Street"]);
    expect(many.flatMap((g) => g.things)).toHaveLength(30);
  });

  it("puts events on the board by when they happen", () => {
    const at = (d: number) => new Date(now + d * day).toISOString();
    const g = groupThings("event", [thing("event", "Past", { date: at(-2) }), thing("event", "Now", { date: at(0) }), thing("event", "Soon", { date: at(3) }), thing("event", "Later", { date: at(60) }), thing("event", "Someday")], now);
    expect(g.map((x) => [x.name, x.things[0].title])).toEqual([["Today", "Now"], ["This week", "Soon"], ["Later", "Later"], ["Someday", "Someday"], ["Past", "Past"]]);
  });

  it("sorts letters by sender, files by type, and recipes by course", () => {
    const mail = groupThings("mail", [thing("mail", "a", { detail: { from: "Sam" } }), thing("mail", "b", { detail: { from: "Sam" } }), thing("mail", "c", { detail: { from: "Airline" } })], now);
    expect(mail.map((g) => [g.name, g.things.length])).toEqual([["Sam", 2], ["Other senders", 1]]);
    const files = groupThings("file", [thing("file", "Plan", { detail: { type: "doc" } }), thing("file", "Beach.jpg", { detail: { type: "file", mime: "image/jpeg" } }), thing("file", "Lease.pdf", { detail: { type: "file" } })], now);
    expect(files.map((g) => g.name)).toEqual(["Docs", "PDFs", "Photos"]);
    const recipes = groupThings("recipe", [thing("recipe", "Pancakes"), thing("recipe", "Grandma's chili"), thing("recipe", "Apple pie")], now);
    expect(recipes.map((g) => [g.name, g.things[0].title])).toEqual([["Breakfast", "Pancakes"], ["Mains", "Grandma's chili"], ["Desserts & baking", "Apple pie"]]);
  });
});
