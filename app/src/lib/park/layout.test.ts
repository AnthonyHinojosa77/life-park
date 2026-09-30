import { describe, expect, it } from "vitest";
import { countByKind, thingKinds, type ThingKind } from "../kinds";
import { blobPath, buildWorld, countLabel, hash, lawnPath, nextZone, onLawn, placeItems, progress, stageOf, zones } from "./layout";

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
        expect(l.x - l.w / 2).toBeGreaterThan(0);
        expect(l.y - l.h / 2).toBeGreaterThan(0);
        expect(l.x + l.w / 2).toBeLessThan(world.width);
        expect(l.y + l.h / 2).toBeLessThan(world.height);
      }
      for (const a of lawns) {
        for (const b of lawns) {
          if (a === b) continue;
          const apart = Math.abs(a.x - b.x) > (a.w + b.w) / 2 + 60 || Math.abs(a.y - b.y) > (a.h + b.h) / 2 + 60;
          expect(apart, `${a.kind} touches ${b.kind}`).toBe(true);
        }
      }
      for (const p of world.ponds) {
        for (const l of lawns) expect(onLawn(l, p.x, p.y, p.rx * 0.5)).toBe(false);
      }
      for (const d of world.decor) {
        for (const l of lawns) expect(onLawn(l, d.x, d.y)).toBe(false);
      }
      expect(world.gate.y).toBeLessThan(world.height);
      expect(world.lamps).toHaveLength(world.paths.length);
    }
  });

  it("grows lawns with what is planted, without a cap", () => {
    const area = (n: number) => placeItems("person", n).w * placeItems("person", n).h;
    expect(area(1)).toBeGreaterThanOrEqual(area(0));
    expect(area(40)).toBeGreaterThan(area(4));
    expect(area(1000)).toBeGreaterThan(area(100));
  });

  it("places every thing on its lawn without crowding, below the sign and the landmark", () => {
    for (const kind of zones.map((z) => z.kind)) {
      for (const n of [1, 3, 12, 80, 500]) {
        const p = placeItems(kind, n);
        expect(p.spots).toHaveLength(n);
        const lawn = { kind, x: 0, y: 0, w: p.w, h: p.h, r: 0 };
        for (const s of p.spots) {
          expect(onLawn(lawn, s.x, s.y), `${kind} ${n}: a thing spilled off the lawn`).toBe(true);
          expect(s.y, `${kind} ${n}: a thing sits on the landmark`).toBeGreaterThan(p.landmarkY + 30);
        }
        for (let i = 0; i < p.spots.length; i++) {
          for (let j = i + 1; j < Math.min(p.spots.length, i + 30); j++) {
            expect(Math.hypot(p.spots[i].x - p.spots[j].x, p.spots[i].y - p.spots[j].y), `${kind} ${n}: things ${i} and ${j} overlap`).toBeGreaterThan(38);
          }
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
    const a = lawnPath(100, 100, 300, 200, hash("person"));
    expect(a.startsWith("M") && a.endsWith("Z")).toBe(true);
    expect(a).not.toBe(lawnPath(100, 100, 300, 200, hash("event")));
    expect(blobPath(0, 0, 50, 1).endsWith("Z")).toBe(true);
    expect(countLabel(zones[0], 1)).toBe("1 neighbor");
    expect(countLabel(zones[0], 2)).toBe("2 neighbors");
  });
});
