import { describe, expect, it } from "vitest";
import { countByKind, thingKinds, type ThingKind } from "../kinds";
import { blobPath, buildWorld, countLabel, hash, ITEM_SPACING, itemSpot, lawnRadius, nextZone, progress, stageOf, zones } from "./layout";

const none = countByKind([]);
const counts = (c: Partial<Record<ThingKind, number>>) => ({ ...none, ...c });

describe("park layout", () => {
  it("has exactly one lawn per kind", () => {
    expect(zones.map((z) => z.kind).sort()).toEqual([...thingKinds].sort());
  });

  it("keeps every lawn inside the park and apart from the others, however big they grow", () => {
    for (const c of [none, counts({ person: 3, mail: 2 }), counts({ person: 900, event: 250, file: 60, habit: 1 })]) {
      const world = buildWorld(c);
      const lawns = Object.values(world.lawns);
      expect(lawns).toHaveLength(8);
      for (const l of lawns) {
        expect(l.x - l.r).toBeGreaterThan(0);
        expect(l.y - l.r).toBeGreaterThan(0);
        expect(l.x + l.r).toBeLessThan(world.width);
        expect(l.y + l.r).toBeLessThan(world.height);
      }
      for (const a of lawns) {
        for (const b of lawns) {
          if (a === b) continue;
          expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.kind} touches ${b.kind}`).toBeGreaterThan(a.r + b.r + 60);
        }
      }
      for (const p of world.ponds) {
        for (const l of lawns) expect(Math.hypot(p.x - l.x, p.y - l.y)).toBeGreaterThan(l.r + p.rx * 0.5);
      }
      for (const d of world.decor) {
        for (const l of lawns) expect(Math.hypot(d.x - l.x, d.y - l.y)).toBeGreaterThan(l.r);
      }
    }
  });

  it("grows lawns with what is planted, without a cap", () => {
    expect(lawnRadius(1)).toBeGreaterThanOrEqual(lawnRadius(0));
    expect(lawnRadius(40)).toBeGreaterThan(lawnRadius(4));
    expect(lawnRadius(1000)).toBeGreaterThan(lawnRadius(100));
  });

  it("spreads things over their lawn without crowding or spilling off it", () => {
    for (const n of [1, 3, 12, 80, 500]) {
      const r = lawnRadius(n);
      const spots = Array.from({ length: n }, (_, i) => itemSpot(i));
      for (const s of spots) expect(Math.hypot(s.x, s.y)).toBeLessThan(r - 40);
      for (let i = 0; i < spots.length; i++) {
        for (let j = i + 1; j < Math.min(spots.length, i + 30); j++) {
          expect(Math.hypot(spots[i].x - spots[j].x, spots[i].y - spots[j].y)).toBeGreaterThan(ITEM_SPACING * 0.45);
        }
      }
    }
  });

  it("grows in stages", () => {
    expect([0, 1, 4, 5, 19, 20, 500].map(stageOf)).toEqual(["empty", "sprout", "sprout", "growing", "growing", "bloom", "bloom"]);
  });

  it("tracks progress and nudges toward the next empty lawn chat can fill", () => {
    expect(progress(none)).toEqual({ grown: 0, total: 8 });
    expect(nextZone(none)?.kind).toBe("person");
    const some = counts({ person: 3, event: 1, mail: 4 });
    expect(progress(some).grown).toBe(3);
    expect(nextZone(some)?.kind).toBe("habit");
    expect(nextZone(counts({ person: 1, event: 1, habit: 1, recipe: 1, list: 1, note: 1 }))).toBeNull();
  });

  it("draws closed lawn outlines that differ per lawn, and labels counts", () => {
    const a = blobPath(100, 100, 50, hash("person"));
    expect(a.startsWith("M") && a.endsWith("Z")).toBe(true);
    expect(a).not.toBe(blobPath(100, 100, 50, hash("event")));
    expect(countLabel(zones[0], 1)).toBe("1 neighbor");
    expect(countLabel(zones[0], 2)).toBe("2 neighbors");
  });
});
