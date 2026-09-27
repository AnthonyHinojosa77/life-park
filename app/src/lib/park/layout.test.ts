import { describe, expect, it } from "vitest";
import { thingKinds } from "../kinds";
import { LAWN_MAX, LAWN_MIN, blobPath, countLabel, fit, hash, lawnRadius, nextZone, paths, progress, stageOf, worlds, zones } from "./layout";

const none = Object.fromEntries(thingKinds.map((k) => [k, 0])) as Record<(typeof thingKinds)[number], number>;

describe("park layout", () => {
  it("has exactly one lawn per kind, inside both maps, never overlapping at full size", () => {
    expect(zones.map((z) => z.kind).sort()).toEqual([...thingKinds].sort());
    for (const shape of ["tall", "wide"] as const) {
      const world = worlds[shape];
      for (const z of zones) {
        const { x, y } = z[shape];
        expect(x - LAWN_MAX * 1.08).toBeGreaterThanOrEqual(0);
        expect(x + LAWN_MAX * 1.08).toBeLessThanOrEqual(world.width);
        // Room above for the lawn's name.
        expect(y - LAWN_MAX - 30).toBeGreaterThanOrEqual(0);
        expect(y + LAWN_MAX).toBeLessThanOrEqual(world.height);
      }
      for (const a of zones) {
        for (const b of zones) {
          if (a === b) continue;
          const d = Math.hypot(a[shape].x - b[shape].x, a[shape].y - b[shape].y);
          expect(d, `${shape}: ${a.name} overlaps ${b.name}`).toBeGreaterThanOrEqual(LAWN_MAX * 2);
        }
      }
      for (const [a, b] of paths[shape]) {
        expect(zones.some((z) => z.kind === a) && zones.some((z) => z.kind === b)).toBe(true);
      }
    }
  });

  it("grows lawns with what is planted, within limits", () => {
    expect(lawnRadius(0)).toBe(LAWN_MIN);
    expect(lawnRadius(1)).toBeGreaterThan(LAWN_MIN);
    expect(lawnRadius(9)).toBeGreaterThan(lawnRadius(1));
    expect(lawnRadius(10_000)).toBe(LAWN_MAX);
  });

  it("draws closed, smooth lawn outlines that differ per lawn", () => {
    const a = blobPath(100, 100, 50, hash("person"));
    expect(a.startsWith("M")).toBe(true);
    expect(a.endsWith("Z")).toBe(true);
    expect(a).not.toBe(blobPath(100, 100, 50, hash("event")));
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
