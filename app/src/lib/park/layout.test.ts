import { describe, expect, it } from "vitest";
import { thingKinds } from "../kinds";
import { PARK_HEIGHT, PARK_WIDTH, countLabel, fit, grid, hash, nextZone, progress, stageOf, zones } from "./layout";

const none = Object.fromEntries(thingKinds.map((k) => [k, 0])) as Record<(typeof thingKinds)[number], number>;

describe("park layout", () => {
  it("has exactly one area per kind, inside the park, without overlaps", () => {
    expect(zones.map((z) => z.kind).sort()).toEqual([...thingKinds].sort());
    for (const z of zones) {
      expect(z.x).toBeGreaterThanOrEqual(0);
      expect(z.y).toBeGreaterThanOrEqual(0);
      expect(z.x + z.w).toBeLessThanOrEqual(PARK_WIDTH);
      expect(z.y + z.h).toBeLessThanOrEqual(PARK_HEIGHT);
    }
    for (const a of zones) {
      for (const b of zones) {
        if (a === b) continue;
        const apart = a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y;
        expect(apart, `${a.name} overlaps ${b.name}`).toBe(true);
      }
    }
  });

  it("grows in stages", () => {
    expect([0, 1, 4, 5, 19, 20, 500].map(stageOf)).toEqual([
      "empty",
      "sprout",
      "sprout",
      "growing",
      "growing",
      "bloom",
      "bloom",
    ]);
  });

  it("lays items out in a capped grid inside the box", () => {
    const box = { x: 10, y: 20, w: 100, h: 50 };
    const cells = grid(box, 30, 5, 10);
    expect(cells).toHaveLength(10);
    expect(cells[0]).toMatchObject({ x: 20, y: 32.5 });
    for (const c of cells) {
      expect(c.x).toBeLessThan(box.x + box.w);
      expect(c.y).toBeLessThan(box.y + box.h);
    }
  });

  it("draws few items big and many items small, always inside the box", () => {
    const box = { x: 0, y: 0, w: 200, h: 100 };
    const unit = { w: 20, h: 20 };
    const few = fit(box, 2, 30, unit, 3);
    const many = fit(box, 30, 30, unit, 3);
    expect(few.cells).toHaveLength(2);
    expect(few.scale).toBeGreaterThan(many.scale);
    expect(few.scale).toBeLessThanOrEqual(3);
    for (const { cells, scale } of [few, many, fit(box, 99, 30, unit, 3)]) {
      expect(cells.length).toBeLessThanOrEqual(30);
      for (const c of cells) {
        expect(c.x - (unit.w * scale) / 2).toBeGreaterThanOrEqual(box.x - 0.001);
        expect(c.x + (unit.w * scale) / 2).toBeLessThanOrEqual(box.x + box.w + 0.001);
        expect(c.y - (unit.h * scale) / 2).toBeGreaterThanOrEqual(box.y - 0.001);
        expect(c.y + (unit.h * scale) / 2).toBeLessThanOrEqual(box.y + box.h + 0.001);
      }
    }
    expect(fit(box, 0, 30, unit).cells).toEqual([]);
  });

  it("tracks progress and nudges toward the next empty area chat can fill", () => {
    expect(progress(none)).toEqual({ grown: 0, total: 8 });
    expect(nextZone(none)?.kind).toBe("person");
    const some = { ...none, person: 3, event: 1, mail: 4 };
    expect(progress(some).grown).toBe(3);
    expect(nextZone(some)?.kind).toBe("habit");
    const allButConnected = { ...none, person: 1, event: 1, habit: 1, recipe: 1, list: 1, note: 1 };
    expect(nextZone(allButConnected)).toBeNull();
  });

  it("labels counts and hashes stably", () => {
    expect(countLabel(zones[0], 1)).toBe("1 neighbor");
    expect(countLabel(zones[0], 2)).toBe("2 neighbors");
    expect(hash("abc")).toBe(hash("abc"));
    expect(hash("abc")).not.toBe(hash("abd"));
  });
});
