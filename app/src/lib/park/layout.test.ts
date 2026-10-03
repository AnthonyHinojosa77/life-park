import { describe, expect, it } from "vitest";
import { countByKind, thingKinds, type ThingKind } from "../kinds";
import {
  alongCurve,
  blobPath,
  buildWorld,
  countLabel,
  hash,
  lawnPath,
  nextZone,
  onLawn,
  placeLawn,
  progress,
  stageOf,
  zones,
  SAMPLE,
} from "./layout";

const none = countByKind([]);
const counts = (c: Partial<Record<ThingKind, number>>) => ({ ...none, ...c });

describe("park layout", () => {
  it("has exactly one lawn per kind", () => {
    expect(zones.map((z) => z.kind).sort()).toEqual([...thingKinds].sort());
  });

  const sizes = (
    open: ThingKind | null = null,
    group: string | null = null,
    n = 40,
  ) =>
    Object.fromEntries(
      zones.map((z) => {
        const groups = [
          { id: "a", count: n },
          { id: "b", count: 3 },
          { id: "c", count: 1 },
        ];
        const p = placeLawn(
          z.kind,
          groups,
          z.kind === open,
          z.kind === open ? group : null,
        );
        return [z.kind, { w: p.w, h: p.h }];
      }),
    ) as Record<ThingKind, { w: number; h: number }>;

  it("keeps every lawn inside the park and apart from the others, whatever is open", () => {
    for (const [s, o] of [
      [sizes(), "portrait"],
      [sizes("person"), "portrait"],
      [sizes("file", "a", 900), "landscape"],
      [sizes("note", "b"), "landscape"],
      [sizes(), "landscape"],
    ] as const) {
      const world = buildWorld(s, "Anthony's park", o);
      // Wide: four across in two rows (mail beside person); tall: two across in four rows (mail below person).
      if (o === "landscape") expect(Math.abs(world.lawns.mail.y - world.lawns.person.y)).toBeLessThan(200);
      else expect(world.lawns.mail.y).toBeGreaterThan(world.lawns.person.y + 400);
      const lawns = Object.values(world.lawns);
      expect(lawns).toHaveLength(zones.length);
      for (const l of lawns) {
        expect(l.x - l.w / 2).toBeGreaterThan(0);
        expect(l.y - l.h / 2).toBeGreaterThan(0);
        expect(l.x + l.w / 2).toBeLessThan(world.width);
        expect(l.y + l.h / 2).toBeLessThan(world.height);
      }
      for (const a of lawns) {
        for (const b of lawns) {
          if (a === b) continue;
          const apart =
            Math.abs(a.x - b.x) > (a.w + b.w) / 2 + 60 ||
            Math.abs(a.y - b.y) > (a.h + b.h) / 2 + 60;
          expect(apart, `${a.kind} touches ${b.kind}`).toBe(true);
        }
      }
      for (const p of [world.lake, ...world.ponds]) {
        for (const l of lawns) {
          expect(onLawn(l, p.x, p.y, p.rx * 0.5)).toBe(false);
          expect(
            onLawn(l, p.x - p.rx, p.y, 20),
            `${l.kind} touches the water`,
          ).toBe(false);
          expect(
            onLawn(l, p.x + p.rx, p.y, 20),
            `${l.kind} touches the water`,
          ).toBe(false);
          expect(
            onLawn(l, p.x, p.y - p.ry, 20),
            `${l.kind} touches the water`,
          ).toBe(false);
          expect(
            onLawn(l, p.x, p.y + p.ry, 20),
            `${l.kind} touches the water`,
          ).toBe(false);
        }
      }
      for (const pt of world.stream)
        for (const l of lawns)
          expect(
            onLawn(l, pt.x, pt.y, 20),
            `${l.kind} sits on the stream`,
          ).toBe(false);
      for (const f of world.furniture)
        for (const l of lawns)
          expect(onLawn(l, f.x, f.y), `${l.kind} sits on a ${f.kind}`).toBe(
            false,
          );
      expect(world.bridges.length).toBeGreaterThanOrEqual(o === "portrait" ? 2 : 1);
      // Paths run from lawn to lawn, and nothing but the water's own things stands on a path or in the water.
      const inWater = (x: number, y: number) =>
        Math.hypot(
          (x - world.lake.x) / world.lake.rx,
          (y - world.lake.y) / world.lake.ry,
        ) <= 1 || world.stream.some((p) => Math.hypot(x - p.x, y - p.y) < 34);
      const onPath = (x: number, y: number) =>
        world.paths.some((c) =>
          [0, 0.25, 0.5, 0.75, 1].some(
            (t) =>
              Math.hypot(x - alongCurve(c, t).x, y - alongCurve(c, t).y) < 30,
          ),
        );
      for (const f of world.furniture) {
        if (["dock", "boat", "duck", "lily", "reeds"].includes(f.kind))
          continue;
        expect(onPath(f.x, f.y), `a ${f.kind} stands on a path`).toBe(false);
        expect(inWater(f.x, f.y), `a ${f.kind} stands in the water`).toBe(
          false,
        );
      }
      for (const d of world.decor) {
        expect(onPath(d.x, d.y), `a ${d.kind} stands on a path`).toBe(false);
        expect(inWater(d.x, d.y), `a ${d.kind} stands in the water`).toBe(
          false,
        );
        const edge = Math.min(d.x, d.y, world.width - d.x, world.height - d.y);
        expect(
          Math.abs(edge - world.fence),
          `a ${d.kind} stands on the fence`,
        ).toBeGreaterThan(40);
      }
      for (const l of world.lamps) expect(inWater(l.x, l.y)).toBe(false);
      expect(world.gate.y).toBe(world.height - world.fence);
      for (const d of world.decor) {
        for (const l of lawns) expect(onLawn(l, d.x, d.y)).toBe(false);
      }
      expect(world.gate.y).toBeLessThan(world.height);
      expect(world.lamps.length).toBeGreaterThan(0);
    }
  });

  it("lays out with lawns of very different sizes, tall or wide", () => {
    for (const o of ["portrait", "landscape"] as const) {
      const s = Object.fromEntries(zones.map((z, i) => [z.kind, { w: 400 + (i % 3) * 420, h: 380 + (i % 2) * 300 }])) as Record<ThingKind, { w: number; h: number }>;
      const world = buildWorld(s, "Anthony's park", o);
      expect(Object.values(world.lawns)).toHaveLength(zones.length);
      // The gate path ends on the last row.
      expect(world.paths[world.paths.length - 1].q.y).toBeGreaterThan(world.lawns.person.y);
    }
  });

  it("never moves the park when a lawn opens: the world comes from closed sizes only", () => {
    const closed = buildWorld(sizes());
    const again = buildWorld(sizes());
    expect(again.lawns.person).toEqual(closed.lawns.person);
    expect(again.decor.length).toBe(closed.decor.length);
    const w = placeLawn("person", [{ id: "a", count: 40 }], true, null).h;
    expect(w).toBeGreaterThan(closed.lawns.person.h);
  });

  it("shows a glimpse on a closed lawn that grows in steps with what it holds, and grows it as it opens", () => {
    const closed = (n: number) =>
      placeLawn("person", [{ id: "a", count: n }], false, null);
    expect(closed(0).glimpse).toHaveLength(0);
    expect(closed(2).glimpse).toHaveLength(2);
    expect(closed(10).glimpse).toHaveLength(6);
    expect(closed(1000).glimpse).toHaveLength(10);
    expect(closed(1000).h).toBeGreaterThan(closed(2).h);
    expect(closed(1000).h).toBe(closed(50).h);
    for (const g of closed(1000).glimpse) expect(g.y).toBeGreaterThan(closed(1000).landmarkY + 30);
    expect(closed(0).plots).toHaveLength(0);
    const open = placeLawn(
      "person",
      [
        { id: "a", count: 40 },
        { id: "b", count: 2 },
      ],
      true,
      null,
    );
    expect(open.plots).toHaveLength(2);
    expect(open.h).toBeGreaterThan(closed(2).h);
    // With one category open, only that plot shows, with everything in it.
    const deeper = placeLawn(
      "person",
      [
        { id: "a", count: 40 },
        { id: "b", count: 2 },
      ],
      true,
      "a",
    );
    expect(deeper.plots.map((p) => p.id)).toEqual(["a"]);
    expect(deeper.plots[0].spots).toHaveLength(40);
    expect(deeper.plots[0].open).toBe(true);
  });

  it("places every thing on its plot without crowding, below the plot's sign", () => {
    for (const kind of zones.map((z) => z.kind)) {
      for (const n of [1, 3, 12, 80, 500]) {
        for (const p of [
          placeLawn(
            kind,
            [
              { id: "a", count: n },
              { id: "b", count: 4 },
            ],
            true,
            "a",
          ),
          placeLawn(
            kind,
            [
              { id: "a", count: n },
              { id: "b", count: 4 },
            ],
            true,
            null,
          ),
        ]) {
          for (const plot of p.plots) {
            expect(plot.spots).toHaveLength(
              plot.open ? n : Math.min(plot.id === "a" ? n : 4, SAMPLE),
            );
            for (const s of plot.spots) {
              expect(
                Math.abs(s.x),
                `${kind} ${n}: a thing spilled off its plot`,
              ).toBeLessThan(plot.w / 2);
              expect(
                s.y,
                `${kind} ${n}: a thing sits on the plot's sign`,
              ).toBeGreaterThan(plot.signY + 20);
              expect(s.y).toBeLessThan(plot.h / 2);
            }
            for (let i = 0; i < plot.spots.length; i++) {
              for (
                let j = i + 1;
                j < Math.min(plot.spots.length, i + 30);
                j++
              ) {
                expect(
                  Math.hypot(
                    plot.spots[i].x - plot.spots[j].x,
                    plot.spots[i].y - plot.spots[j].y,
                  ),
                  `${kind} ${n}: things ${i} and ${j} overlap`,
                ).toBeGreaterThan(plot.open ? 38 : 26);
              }
            }
            // Every plot sits on the lawn.
            const lawn = { kind, x: 0, y: 0, w: p.w, h: p.h, r: 0 };
            expect(onLawn(lawn, plot.x - plot.w / 2, plot.y - plot.h / 2)).toBe(
              true,
            );
            expect(onLawn(lawn, plot.x + plot.w / 2, plot.y + plot.h / 2)).toBe(
              true,
            );
            expect(
              plot.y - plot.h / 2,
              `${kind} ${n}: a plot overlaps the landmark`,
            ).toBeGreaterThan(p.landmarkY + 40);
          }
        }
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

  it("tracks progress and nudges toward the next empty lawn chat can fill", () => {
    expect(progress(none)).toEqual({ grown: 0, total: 9 });
    expect(nextZone(none)?.kind).toBe("person");
    const some = counts({ person: 3, event: 1, mail: 4 });
    expect(progress(some).grown).toBe(3);
    expect(nextZone(some)?.kind).toBe("habit");
    expect(
      nextZone(
        counts({ person: 1, event: 1, habit: 1, recipe: 1, list: 1, note: 1 }),
      ),
    ).toBeNull();
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
