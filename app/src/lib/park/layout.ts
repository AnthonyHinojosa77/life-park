import type { ThingKind } from "../kinds";

export type Zone = {
  kind: ThingKind;
  /** What the lawn is called in the park. */
  name: string;
  /** What one thing is called there, singular and plural. */
  one: string;
  many: string;
  /** The sign on an empty lawn, and the sentence it types into a new chat. */
  sign: string;
  starter: string;
  /** The lawn's accent color: its landmark's main color, used for its chip and its plot signs. */
  accent: string;
};

/** Every lawn of the park, in the order a newcomer is nudged to fill them. */
export const zones: Zone[] = [
  { kind: "person", name: "Neighborhood", one: "neighbor", many: "neighbors", sign: "Who's in your life?", starter: "Someone important to me is ", accent: "#d94f8a" },
  { kind: "event", name: "Festival board", one: "event", many: "events", sign: "What's coming up?", starter: "Coming up soon: ", accent: "#f2a93b" },
  { kind: "habit", name: "Garden", one: "habit", many: "habits", sign: "Plant a habit", starter: "A habit I want to keep: ", accent: "#3b9152" },
  { kind: "recipe", name: "Orchard", one: "recipe", many: "recipes", sign: "Grow a recipe", starter: "Here's a recipe I love: ", accent: "#c9553f" },
  { kind: "list", name: "Picnic lawn", one: "list", many: "lists", sign: "Lay out a list", starter: "Make me a list for ", accent: "#9a5fc2" },
  { kind: "note", name: "Bench walk", one: "note", many: "notes", sign: "Leave a note", starter: "Remember this for me: ", accent: "#6d7f92" },
  { kind: "file", name: "Library", one: "file", many: "files", sign: "Shelve a file", starter: "Keep track of this document: ", accent: "#1f9e9a" },
  { kind: "mail", name: "Post office", one: "letter", many: "letters", sign: "Mail arrives here", starter: "Keep an eye on this email: ", accent: "#2f6fb8" },
];

export type Stage = "empty" | "sprout" | "growing" | "bloom";

/** How grown a lawn looks, from its number of things. */
export function stageOf(count: number): Stage {
  if (count <= 0) return "empty";
  if (count < 5) return "sprout";
  if (count < 20) return "growing";
  return "bloom";
}

/**
 * How each lawn arranges its things, in map units. Houses line up along
 * streets, books stand on shelves, mailboxes along a lane; picnic blankets
 * and benches are scattered. `dx`/`dy` is the room one thing takes.
 */
type Arrangement =
  | { shape: "rows"; dx: number; dy: number; stagger: boolean; wide: number; /** How far a thing may sit off its exact spot, so rows look lived-in rather than ruled. */ loose: number }
  | { shape: "scatter"; gap: number };

export const arrangements: Record<ThingKind, Arrangement> = {
  person: { shape: "rows", dx: 98, dy: 112, stagger: true, wide: 1.7, loose: 0.1 },
  event: { shape: "rows", dx: 92, dy: 112, stagger: false, wide: 1.6, loose: 0.06 },
  habit: { shape: "rows", dx: 104, dy: 74, stagger: false, wide: 1.5, loose: 0 },
  recipe: { shape: "rows", dx: 86, dy: 96, stagger: true, wide: 1.6, loose: 0.1 },
  file: { shape: "rows", dx: 46, dy: 78, stagger: false, wide: 1.9, loose: 0 },
  mail: { shape: "rows", dx: 68, dy: 96, stagger: false, wide: 1.7, loose: 0.05 },
  list: { shape: "scatter", gap: 118 },
  note: { shape: "scatter", gap: 112 },
};

/** How far apart two things of a kind sit, for sizing what goes between and around them. */
export function spacingOf(kind: ThingKind) {
  const a = arrangements[kind];
  return a.shape === "rows" ? { dx: a.dx, dy: a.dy } : { dx: a.gap * 0.62, dy: a.gap * 0.55 };
}

/** Grass around the edge of every lawn. */
const PAD = 44;
/** Room at the top of every lawn for its wooden sign, then its landmark building. */
const SIGN_ROOM = 76;
const LANDMARK_ROOM = 176;
/** The smallest a lawn gets: its sign and its landmark with nothing open. */
const MIN_W = 420;
/**
 * A lawn's rounded outline (see `lawnPath`) cuts across the corners of what is
 * on it, so the outline is drawn this much bigger than the block inside it.
 */
const FIT = 0.84;
/** Room at the top of a category's plot for its little sign. */
const PLOT_SIGN = 52;
const PLOT_PAD = 24;
/** Space between plots. */
const PLOT_GAP = 30;
/** A closed plot shows this many of its things. */
export const SAMPLE = 6;

/** One category's plot on an open lawn, relative to the lawn's center. */
export type Plot = {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Where its sign stands, relative to the plot's center. */
  signY: number;
  /** Where its things sit, relative to the plot's center: all of them when open, a sample when closed. */
  spots: { x: number; y: number }[];
  open: boolean;
  /** The rows things sit on, for streets and shelves, relative to the plot's center. */
  rows: { y: number; x0: number; x1: number }[];
};

export type Placement = {
  /** The lawn's size. */
  w: number;
  h: number;
  /** Where the sign and the landmark stand, relative to the lawn's center. */
  signY: number;
  landmarkY: number;
  /** The category plots, when the lawn is open. */
  plots: Plot[];
};

/** Lays out `n` things in this lawn's arrangement, centered on 0,0. */
function block(kind: ThingKind, n: number) {
  const a = arrangements[kind];
  const spots: { x: number; y: number }[] = [];
  const rows: Plot["rows"] = [];
  let w = 0;
  let h = 0;
  if (n > 0 && a.shape === "rows") {
    const { dx, dy } = a;
    const cols = Math.max(1, Math.min(n, Math.ceil(Math.sqrt((n * dy * a.wide) / dx))));
    const count = Math.ceil(n / cols);
    h = count * dy;
    let left = Infinity;
    let right = -Infinity;
    for (let r = 0; r < count; r++) {
      const inRow = Math.min(cols, n - r * cols);
      const shift = a.stagger && r % 2 === 1 ? dx / 4 : a.stagger ? -dx / 4 : 0;
      const y = r * dy - h / 2 + dy / 2;
      const x0 = -(inRow * dx) / 2 + shift;
      // Each row is only as long as what is on it.
      rows.push({ y, x0, x1: x0 + inRow * dx });
      left = Math.min(left, x0);
      right = Math.max(right, x0 + inRow * dx);
      for (let c = 0; c < inRow; c++) {
        const hs = hash(`${kind}${r},${c}`);
        spots.push({ x: x0 + c * dx + dx / 2 + ((hs % 100) / 100 - 0.5) * dx * a.loose, y: y + (((hs >>> 8) % 100) / 100 - 0.5) * dy * a.loose * 0.6 });
      }
    }
    // Center the block on what is actually there.
    const mid = (left + right) / 2;
    for (const s of spots) s.x -= mid;
    for (const r of rows) {
      r.x0 -= mid;
      r.x1 -= mid;
    }
    w = right - left;
  } else if (n > 0 && a.shape === "scatter") {
    // A sunflower spiral spreads any number of things evenly and organically.
    const gap = a.gap;
    const golden = Math.PI * (3 - Math.sqrt(5));
    let far = 0;
    for (let i = 0; i < n; i++) {
      const d = gap * 0.62 * Math.sqrt(i + 0.5);
      const ang = i * golden - Math.PI / 2;
      spots.push({ x: Math.cos(ang) * d, y: Math.sin(ang) * d * 0.85 });
      far = Math.max(far, d);
    }
    w = far * 2 + gap * 0.6;
    h = far * 2 * 0.85 + gap * 0.6;
  }
  return { spots, rows, w, h };
}

/**
 * Lays out one lawn: its sign, its landmark, and, when it is open, a plot for
 * each of its categories, one of which may itself be open to show everything
 * on it. Returns how big all that makes the lawn.
 */
export function placeLawn(kind: ThingKind, groups: { id: string; count: number }[], open: boolean, openGroup: string | null): Placement {
  const plots: Plot[] = [];
  let contentW = 0;
  let contentH = 0;
  if (open && groups.length > 0) {
    // Plots flow two to a row, each its own size; an open plot takes a row to itself.
    const sized = groups.map((g) => {
      const isOpen = g.id === openGroup;
      const b = block(kind, isOpen ? g.count : Math.min(g.count, SAMPLE));
      const w = Math.max(210, b.w + PLOT_PAD * 2);
      const h = PLOT_PAD + PLOT_SIGN + b.h + PLOT_PAD;
      return { g, b, w, h, isOpen };
    });
    const rowsOfPlots: (typeof sized)[] = [];
    for (const s of sized) {
      const last = rowsOfPlots[rowsOfPlots.length - 1];
      if (!s.isOpen && last && last.length === 1 && !last[0].isOpen) last.push(s);
      else rowsOfPlots.push([s]);
    }
    let y = 0;
    rowsOfPlots.forEach((row, ri) => {
      const rowW = row.reduce((sum, s) => sum + s.w, 0) + (row.length - 1) * PLOT_GAP;
      const rowH = Math.max(...row.map((s) => s.h));
      contentW = Math.max(contentW, rowW);
      let x = -rowW / 2;
      // Alternate rows sit a little off center, so the plots read as beds, not a table.
      const drift = row.length === 1 ? 0 : ri % 2 ? 10 : -10;
      for (const s of row) {
        const cx = x + s.w / 2 + drift;
        const cy = y + s.h / 2;
        // Things sit below the plot's sign, from the top down, so side-by-side plots line up.
        const itemsY = -s.h / 2 + PLOT_PAD + PLOT_SIGN + s.b.h / 2;
        plots.push({
          id: s.g.id,
          x: cx,
          y: cy,
          w: s.w,
          h: s.h,
          signY: -s.h / 2 + PLOT_PAD + 12,
          spots: s.b.spots.map((p) => ({ x: p.x, y: p.y + itemsY })),
          rows: s.b.rows.map((r) => ({ ...r, y: r.y + itemsY })),
          open: s.isOpen,
        });
        x += s.w + PLOT_GAP;
      }
      y += rowH + PLOT_GAP;
    });
    contentH = y - PLOT_GAP;
  }
  const innerW = Math.max(MIN_W, contentW + PAD * 2);
  const innerH = PAD + SIGN_ROOM + LANDMARK_ROOM + (contentH > 0 ? contentH + PLOT_GAP : 0) + PAD * 0.6;
  const top = -innerH / 2;
  const blockY = top + PAD + SIGN_ROOM + LANDMARK_ROOM + PLOT_GAP;
  for (const p of plots) p.y += blockY;
  // Landmarks stand with their base at y = 52 in their own drawing.
  return { w: innerW / FIT, h: innerH / FIT, signY: top + PAD + SIGN_ROOM / 2, landmarkY: top + PAD + SIGN_ROOM + LANDMARK_ROOM - 52, plots };
}

/** Lawns sit in two columns, rows in this order, like blocks on a town map. */
const rowsOfLawns: [ThingKind, ThingKind][] = [
  ["person", "event"],
  ["file", "mail"],
  ["list", "recipe"],
  ["habit", "note"],
];

export type Lawn = { kind: ThingKind; x: number; y: number; w: number; h: number; /** Half the longer side, for distances. */ r: number };
export type DecorKind = "tree" | "pine" | "willow" | "blossom" | "bush" | "flowers" | "rock";
export type Decor = { kind: DecorKind; x: number; y: number; s: number; /** Mirrored, so the same tree never looks stamped. */ m: boolean; /** Which canopy colors. */ c: number };
export type FurnitureKind = "bench" | "table" | "playground" | "cart" | "flowerbed" | "dock" | "boat" | "duck" | "lily" | "reeds" | "kite";
export type Furniture = { kind: FurnitureKind; x: number; y: number; /** Faces the other way. */ m?: boolean };
export type Water = { x: number; y: number; rx: number; ry: number };
export type Point = { x: number; y: number };
/** A path between two places: a curve from `p` to `q` bending through `c`. */
export type Curve = { p: Point; c: Point; q: Point };
export type World = {
  width: number;
  height: number;
  lawns: Record<ThingKind, Lawn>;
  /** Walkways between the lawns' entrances, plus the one in from the gate. */
  paths: Curve[];
  /** The lake in the middle of the park. */
  lake: Water;
  /** The stream from the lake, as points down its middle, ending in the duck pond. */
  stream: Point[];
  ponds: Water[];
  /** Where the paths cross the stream. */
  bridges: { x: number; y: number; a: number }[];
  decor: Decor[];
  furniture: Furniture[];
  /** Lamp posts along the paths. */
  lamps: Point[];
  /** The park's entrance, on the fence line at the bottom, and how wide its arch is. */
  gate: { x: number; y: number; w: number };
  /** How far in from the edge the fence runs. */
  fence: number;
};

/** A small stable number from a string, for picking colors and slight variations. */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** True when a point is inside a lawn's rounded outline, with `pad` extra around it. */
export function onLawn(l: Lawn, x: number, y: number, pad = 0) {
  const a = l.w / 2 + pad;
  const b = l.h / 2 + pad;
  return Math.pow(Math.abs(x - l.x) / a, 4) + Math.pow(Math.abs(y - l.y) / b, 4) <= 1;
}

/** Where a path is at `t` along it, and which way it runs there, in degrees. */
export function alongCurve(c: Curve, t: number) {
  const u = 1 - t;
  return {
    x: u * u * c.p.x + 2 * u * t * c.c.x + t * t * c.q.x,
    y: u * u * c.p.y + 2 * u * t * c.c.y + t * t * c.q.y,
    a: (Math.atan2(2 * u * (c.c.y - c.p.y) + 2 * t * (c.q.y - c.c.y), 2 * u * (c.c.x - c.p.x) + 2 * t * (c.q.x - c.c.x)) * 180) / Math.PI,
  };
}

/** How far a point is from a path. */
function distanceToCurve(x: number, y: number, c: Curve) {
  let best = Infinity;
  let prev = c.p;
  for (let i = 1; i <= 8; i++) {
    const at = alongCurve(c, i / 8);
    best = Math.min(best, distanceToSegment(x, y, prev, at));
    prev = at;
  }
  return best;
}

/** Arch width of the gate, from the name on it (see the Gate drawing). */
export function gateWidth(name: string) {
  return Math.max(220, name.length * 15 + 80);
}

/**
 * Lays out the whole park from the size of each lawn when closed (see
 * `placeLawn`). The world never changes when a lawn opens: the open lawn is
 * drawn bigger over its own spot. Lawns are spaced so none overlap, with the
 * lake, the stream, paths, furniture, and trees between them.
 */
export function buildWorld(sizes: Record<ThingKind, { w: number; h: number }>, parkName = "Your park"): World {
  const margin = 190;
  const colWidth = [0, 1].map((c) => Math.max(...rowsOfLawns.map((row) => sizes[row[c]].w)) + margin);
  const rowHeight = rowsOfLawns.map(([a, b]) => Math.max(sizes[a].h, sizes[b].h) + margin);
  const lawns = {} as Record<ThingKind, Lawn>;
  let y = margin;
  rowsOfLawns.forEach((row, ri) => {
    let x = margin;
    row.forEach((kind, ci) => {
      // A slight, stable offset keeps the blocks from looking ruled.
      const h = hash(kind);
      const jx = ((h % 100) / 100 - 0.5) * margin * 0.3;
      const jy = (((h >>> 8) % 100) / 100 - 0.5) * margin * 0.3;
      const { w, h: lh } = sizes[kind];
      lawns[kind] = { kind, x: x + colWidth[ci] / 2 + jx, y: y + rowHeight[ri] / 2 + jy + (ci === 1 ? margin * 0.25 : 0), w, h: lh, r: Math.max(w, lh) / 2 };
      x += colWidth[ci];
    });
    y += rowHeight[ri];
    // The lake lies between the first two rows.
    if (ri === 0) y += LAKE_BAND;
  });
  const width = colWidth[0] + colWidth[1] + margin * 2;
  const height = y + margin * 1.5;
  const fence = 70;
  const midX = margin + colWidth[0];
  const gate = { x: midX, y: height - fence, w: gateWidth(parkName) };

  // Paths run between fixed entrances: the middle of a lawn's side facing the other lawn.
  const between = (a: ThingKind, b: ThingKind): Curve => {
    const l = lawns[a];
    const m = lawns[b];
    const sideways = Math.abs(l.y - m.y) < Math.abs(l.x - m.x);
    const p = sideways ? { x: l.x + l.w / 2 - 24, y: l.y } : { x: l.x, y: l.y + l.h / 2 - 24 };
    const q = sideways ? { x: m.x - m.w / 2 + 24, y: m.y } : { x: m.x, y: m.y - m.h / 2 + 24 };
    const bend = ((hash(a + b) % 60) - 30) / 220;
    return { p, q, c: { x: (p.x + q.x) / 2 + (q.y - p.y) * bend, y: (p.y + q.y) / 2 - (q.x - p.x) * bend } };
  };
  const paths: Curve[] = [];
  const pairs: [ThingKind, ThingKind][] = [];
  rowsOfLawns.forEach(([a, b], ri) => {
    pairs.push([a, b]);
    if (ri > 0) {
      pairs.push([rowsOfLawns[ri - 1][0], a]);
      pairs.push([rowsOfLawns[ri - 1][1], b]);
    }
  });
  for (const [a, b] of pairs) paths.push(between(a, b));
  // In from the gate, up to the bottom row's walkway.
  const bottomRow = paths[paths.length - 3];
  const gateEnd = alongCurve(bottomRow, 0.5);
  paths.push({ p: { x: gate.x, y: gate.y + 10 }, c: { x: gate.x, y: (gate.y + gateEnd.y) / 2 }, q: { x: gateEnd.x, y: gateEnd.y } });

  // The lake sits in the middle, between the first two rows, and a stream
  // winds from it down the middle of the park to a duck pond.
  const [r0, r1] = rowsOfLawns;
  const lakeTop = Math.max(lawns[r0[0]].y + lawns[r0[0]].h / 2, lawns[r0[1]].y + lawns[r0[1]].h / 2);
  const lakeBottom = Math.min(lawns[r1[0]].y - lawns[r1[0]].h / 2, lawns[r1[1]].y - lawns[r1[1]].h / 2);
  const lake: Water = { x: midX, y: (lakeTop + lakeBottom) / 2, rx: Math.min(420, Math.min(colWidth[0], colWidth[1]) * 0.42), ry: Math.min(190, (lakeBottom - lakeTop) / 2 - 30) };
  const [r2, r3] = [rowsOfLawns[2], rowsOfLawns[3]];
  const pondY = (Math.max(lawns[r2[0]].y + lawns[r2[0]].h / 2, lawns[r2[1]].y + lawns[r2[1]].h / 2) + Math.min(lawns[r3[0]].y - lawns[r3[0]].h / 2, lawns[r3[1]].y - lawns[r3[1]].h / 2)) / 2;
  const streamX = (sy: number) => midX + 40 * Math.sin((sy - lake.y) / 150);
  const stream: Point[] = [];
  for (let sy = lake.y + lake.ry - 30; sy <= pondY; sy += 40) stream.push({ x: streamX(sy), y: sy });
  const ponds: Water[] = [{ x: streamX(pondY), y: pondY, rx: 110, ry: 62 }];
  // Bridges where the middle two rows' walkways cross the stream.
  const bridges = [paths[1], paths[4]].map((c) => {
    const at = alongCurve(c, 0.5);
    return { x: streamX(at.y), y: at.y, a: at.a };
  });

  const all = Object.values(lawns);
  const inWater = (x: number, yy: number, pad: number) =>
    Math.hypot((x - lake.x) / (lake.rx + pad), (yy - lake.y) / (lake.ry + pad)) <= 1 ||
    ponds.some((p) => Math.hypot((x - p.x) / (p.rx + pad), (yy - p.y) / (p.ry + pad)) <= 1) ||
    stream.some((p) => Math.hypot(x - p.x, yy - p.y) < 34 + pad);
  const nearFence = (x: number, yy: number) => Math.abs(Math.min(x, yy, width - x, height - yy) - fence) < 44;
  const onGround = (x: number, yy: number, pad: number) =>
    all.every((l) => !onLawn(l, x, yy, pad)) && !inWater(x, yy, pad) && paths.every((c) => distanceToCurve(x, yy, c) > 28 + pad) && !nearFence(x, yy) && Math.hypot(x - gate.x, yy - gate.y) > gate.w / 2 + 60;

  // A lamp post at the middle of every path, just off it, and a bench a way
  // along, on the other side; both only where the ground beside the path is open.
  const beside = (c: Curve, t: number, side: number) => {
    const at = alongCurve(c, t);
    const rad = (at.a * Math.PI) / 180;
    const spot = { x: at.x - Math.sin(rad) * 44 * side, y: at.y + Math.cos(rad) * 44 * side };
    return all.every((l) => !onLawn(l, spot.x, spot.y, 30)) && !inWater(spot.x, spot.y, 30) && paths.every((p) => p === c || distanceToCurve(spot.x, spot.y, p) > 40) ? spot : null;
  };
  const lamps: Point[] = [];
  const furniture: Furniture[] = [];
  paths.forEach((c, i) => {
    const lamp = beside(c, 0.5, 1);
    if (lamp) lamps.push(lamp);
    const bench = [i % 2 ? 0.34 : 0.66, i % 2 ? 0.66 : 0.34].map((t) => beside(c, t, -1)).find((x) => x);
    if (bench) furniture.push({ kind: "bench", x: bench.x, y: bench.y });
  });

  // Around the lake: a dock, a boat, ducks, lily pads, and reeds in and at the
  // water; a cart, picnic tables, flower beds, and a playground on the grass,
  // each nudged until it stands clear of everything else.
  const water: Furniture[] = [
    { kind: "dock", x: lake.x - lake.rx + 10, y: lake.y + 20 },
    { kind: "boat", x: lake.x + lake.rx * 0.3, y: lake.y - lake.ry * 0.25 },
    { kind: "duck", x: lake.x - lake.rx * 0.35, y: lake.y - lake.ry * 0.4 },
    { kind: "duck", x: lake.x + lake.rx * 0.55, y: lake.y + lake.ry * 0.45, m: true },
    { kind: "duck", x: lake.x - lake.rx * 0.1, y: lake.y + lake.ry * 0.6 },
    { kind: "duck", x: ponds[0].x + 14, y: ponds[0].y + 4, m: true },
    { kind: "lily", x: lake.x + lake.rx * 0.65, y: lake.y - lake.ry * 0.55 },
    { kind: "lily", x: lake.x - lake.rx * 0.6, y: lake.y + lake.ry * 0.5 },
    { kind: "lily", x: ponds[0].x - 50, y: ponds[0].y + 10 },
    { kind: "reeds", x: lake.x + lake.rx * 0.92, y: lake.y + lake.ry * 0.35 },
    { kind: "reeds", x: lake.x - lake.rx * 0.8, y: lake.y - lake.ry * 0.7 },
    { kind: "reeds", x: ponds[0].x + 90, y: ponds[0].y - 24 },
  ];
  furniture.push(...water);
  const settle = (f: Furniture, room: number) => {
    const tries = [0, 50, -50, 100, -100, 150, -150];
    for (const dy of tries) {
      for (const dx of tries) {
        const x = f.x + dx;
        const yy = f.y + dy;
        if (onGround(x, yy, room) && furniture.every((o) => Math.hypot(o.x - x, o.y - yy) > room + 40)) {
          furniture.push({ ...f, x, y: yy });
          return;
        }
      }
    }
  };
  settle({ kind: "cart", x: lake.x + lake.rx * 0.55, y: lake.y - lake.ry - 90 }, 40);
  settle({ kind: "table", x: lake.x + lake.rx + 120, y: lake.y - 40 }, 44);
  settle({ kind: "table", x: lake.x - lake.rx - 130, y: lake.y + 120 }, 44);
  settle({ kind: "flowerbed", x: lake.x - lake.rx - 110, y: lake.y - lake.ry * 0.7 }, 50);
  settle({ kind: "flowerbed", x: lake.x + lake.rx + 80, y: lake.y + lake.ry + 50 }, 50);
  settle({ kind: "flowerbed", x: gate.x - gate.w / 2 - 90, y: gate.y - 30 }, 50);
  settle({ kind: "flowerbed", x: gate.x + gate.w / 2 + 90, y: gate.y - 30 }, 50);
  settle({ kind: "playground", x: margin + colWidth[0] * 0.24, y: lake.y + 30 }, 130);
  settle({ kind: "kite", x: margin + colWidth[0] * 0.24 + 140, y: lake.y - 170 }, 30);

  // Trees and bushes on open meadow, in groves and clearings, thicker toward
  // the fence, never on anything else. Willows lean over the water.
  const decor: Decor[] = [];
  const clearOf = (x: number, yy: number, pad: number) =>
    onGround(x, yy, pad) && lamps.every((l) => Math.hypot(x - l.x, yy - l.y) > pad + 20) && furniture.every((f) => Math.hypot(x - f.x, yy - f.y) > (f.kind === "playground" ? 150 : 60) + pad * 0.4);
  const step = 120;
  for (let gx = fence + 60; gx < width - fence - 40; gx += step) {
    for (let gy = fence + 60; gy < height - fence - 40; gy += step) {
      const h = hash(`${gx},${gy}`);
      const edge = Math.min(gx, gy, width - gx, height - gy);
      // A slow wave over the park makes groves and clearings; the edge is always wooded.
      const wave = 0.5 + 0.5 * Math.sin(gx / 340 + 0.7) * Math.cos(gy / 290 - 0.3);
      const chance = Math.min(0.92, 0.2 + wave * 0.5 + (edge < 240 ? 0.35 : 0));
      if ((h % 100) / 100 > chance) continue;
      const x = gx + ((h % 97) / 97 - 0.5) * step * 0.8;
      const yy = gy + (((h >>> 7) % 89) / 89 - 0.5) * step * 0.8;
      if (!clearOf(x, yy, 40)) continue;
      const pick = (h >>> 13) % 20;
      const nearWater = inWater(x, yy, 110);
      const kind: DecorKind = nearWater && pick < 8 ? "willow" : pick < 7 ? "tree" : pick < 11 ? "pine" : pick < 13 ? "blossom" : pick < 16 ? "bush" : pick < 19 ? "flowers" : "rock";
      decor.push({ kind, x, y: yy, s: 0.8 + ((h >>> 17) % 45) / 100, m: ((h >>> 5) & 1) === 1, c: (h >>> 21) % 3 });
    }
  }
  return { width, height, lawns, paths, lake, stream, ponds, bridges, decor, furniture, lamps, gate, fence };
}

/** Room for the lake between the first two rows of lawns. */
const LAKE_BAND = 460;

/** A pond or lake outline: a soft, uneven oval. */
export function waterPath(w: Water, seed: number, points = 14) {
  const pts = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const wobble = 0.86 + (((seed >>> ((i * 3) % 29)) & 7) / 7) * 0.14;
    return { x: w.x + Math.cos(a) * w.rx * wobble, y: w.y + Math.sin(a) * w.ry * (0.9 + wobble * 0.1) };
  });
  return smoothLoop(pts);
}

/** The stream as a smooth open curve down its points. */
export function streamPath(points: Point[]) {
  if (points.length < 2) return "";
  let d = `M${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const p = points[i - 1];
    const q = points[i];
    const cx = (p.x + q.x) / 2;
    d += ` C${p.x.toFixed(1)} ${((p.y + q.y) / 2).toFixed(1)} ${cx.toFixed(1)} ${q.y.toFixed(1)} ${q.x.toFixed(1)} ${q.y.toFixed(1)}`;
  }
  return d;
}

function distanceToSegment(x: number, y: number, p: Point, q: Point) {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const len2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - p.x) * dx + (y - p.y) * dy) / len2));
  return Math.hypot(x - (p.x + t * dx), y - (p.y + t * dy));
}

/** How far along the park is: lawns with at least one thing, out of all lawns. */
export function progress(counts: Record<ThingKind, number>) {
  const grown = zones.filter((z) => (counts[z.kind] ?? 0) > 0).length;
  return { grown, total: zones.length };
}

/** The first empty lawn worth filling next, or null when every lawn is growing. */
export function nextZone(counts: Record<ThingKind, number>) {
  // Mail and files only arrive from connected accounts, so chat never nudges toward them.
  return zones.find((z) => z.kind !== "mail" && z.kind !== "file" && (counts[z.kind] ?? 0) === 0) ?? null;
}

/**
 * A lawn's organic outline: a smooth, slightly wobbly rounded block around a
 * center, different for every lawn so the park never looks stamped out. It
 * always holds the `w` by `h` rectangle of what is on the lawn.
 */
export function lawnPath(cx: number, cy: number, w: number, h: number, seed: number, points = 20, wobbleSize = 0.05) {
  const a = w / 2;
  const b = h / 2;
  const pts = Array.from({ length: points }, (_, i) => {
    const t = (i / points) * Math.PI * 2;
    const c = Math.cos(t);
    const s = Math.sin(t);
    // A superellipse: a rectangle with soft corners (its corner sits at 0.84 of each side).
    const wobble = 1 + ((((seed >>> ((i * 3) % 29)) & 7) / 7) * wobbleSize - wobbleSize / 2);
    return { x: cx + Math.sign(c) * Math.pow(Math.abs(c), 0.5) * a * wobble, y: cy + Math.sign(s) * Math.pow(Math.abs(s), 0.5) * b * wobble };
  });
  return smoothLoop(pts);
}

/** A round blob, for ponds and the like. */
export function blobPath(cx: number, cy: number, r: number, seed: number, points = 11) {
  const pts = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const wobble = 0.93 + (((seed >>> ((i * 3) % 29)) & 7) / 7) * 0.07;
    return { x: cx + Math.cos(a) * r * wobble * 1.04, y: cy + Math.sin(a) * r * wobble * 0.97 };
  });
  return smoothLoop(pts);
}

/** Catmull-Rom through the points, written as a closed run of cubic curves. */
function smoothLoop(pts: Point[]) {
  const n = pts.length;
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
}

export function countLabel(zone: Zone, n: number) {
  return `${n} ${n === 1 ? zone.one : zone.many}`;
}
