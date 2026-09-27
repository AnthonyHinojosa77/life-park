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
  /** The lawn's accent color, for its sign and its quick-jump chip. */
  accent: string;
};

/** Every lawn of the park, in the order a newcomer is nudged to fill them. */
export const zones: Zone[] = [
  { kind: "person", name: "Neighborhood", one: "neighbor", many: "neighbors", sign: "Who's in your life?", starter: "Someone important to me is ", accent: "#e8594a" },
  { kind: "event", name: "Festival board", one: "event", many: "events", sign: "What's coming up?", starter: "Coming up soon: ", accent: "#f2a93b" },
  { kind: "habit", name: "Garden", one: "habit", many: "habits", sign: "Plant a habit", starter: "A habit I want to keep: ", accent: "#8a5a2b" },
  { kind: "recipe", name: "Orchard", one: "recipe", many: "recipes", sign: "Grow a recipe", starter: "Here's a recipe I love: ", accent: "#3e9e50" },
  { kind: "list", name: "Picnic lawn", one: "list", many: "lists", sign: "Lay out a list", starter: "Make me a list for ", accent: "#b36bd4" },
  { kind: "note", name: "Bench walk", one: "note", many: "notes", sign: "Leave a note", starter: "Remember this for me: ", accent: "#7a7362" },
  { kind: "file", name: "Library", one: "file", many: "files", sign: "Shelve a file", starter: "Keep track of this document: ", accent: "#4a82de" },
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

/** Distance between neighboring things on a lawn, in map units. */
export const ITEM_SPACING = 150;
/** Room at the top of every lawn for its wooden sign. */
const SIGN_ROOM = 70;

/** A lawn's radius: roomy when empty, growing with what is planted on it, with no upper limit. */
export function lawnRadius(count: number) {
  if (count <= 0) return 190;
  return Math.max(200, ITEM_SPACING * 0.62 * Math.sqrt(count) + 125);
}

/**
 * Where the i-th thing sits on its lawn, relative to the lawn's center: a
 * sunflower spiral, which spreads any number of things evenly and organically.
 */
export function itemSpot(i: number) {
  const golden = Math.PI * (3 - Math.sqrt(5));
  const d = ITEM_SPACING * 0.62 * Math.sqrt(i + 0.5);
  const a = i * golden - Math.PI / 2;
  return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.92 + SIGN_ROOM / 2 };
}

/** Lawns sit in two columns, rows in this order, like blocks on a town map. */
const rows: [ThingKind, ThingKind][] = [
  ["person", "event"],
  ["file", "mail"],
  ["list", "recipe"],
  ["habit", "note"],
];

export type Lawn = { kind: ThingKind; x: number; y: number; r: number };
export type Decor = { kind: "tree" | "bush" | "flowers"; x: number; y: number; s: number };
export type World = {
  width: number;
  height: number;
  lawns: Record<ThingKind, Lawn>;
  paths: [ThingKind, ThingKind][];
  ponds: { x: number; y: number; rx: number; ry: number }[];
  decor: Decor[];
};

/** A small stable number from a string, for picking colors and slight variations. */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Lays out the whole park from how many things each lawn holds. Lawns are
 * spaced so none ever overlap, however big they grow, with meadow, paths,
 * ponds, and trees between them.
 */
export function buildWorld(counts: Record<ThingKind, number>): World {
  const radius = (k: ThingKind) => lawnRadius(counts[k] ?? 0);
  const margin = 170;
  const colWidth = [0, 1].map((c) => Math.max(...rows.map((row) => radius(row[c]))) * 2 + margin);
  const rowHeight = rows.map(([a, b]) => Math.max(radius(a), radius(b)) * 2 + margin);
  const lawns = {} as Record<ThingKind, Lawn>;
  let y = margin;
  rows.forEach((row, ri) => {
    let x = margin;
    row.forEach((kind, ci) => {
      // A slight, stable offset keeps the blocks from looking ruled.
      const h = hash(kind);
      const jx = ((h % 100) / 100 - 0.5) * margin * 0.5;
      const jy = (((h >>> 8) % 100) / 100 - 0.5) * margin * 0.5;
      lawns[kind] = { kind, x: x + colWidth[ci] / 2 + jx, y: y + rowHeight[ri] / 2 + jy + (ci === 1 ? margin * 0.35 : 0), r: radius(kind) };
      x += colWidth[ci];
    });
    y += rowHeight[ri];
  });
  const width = colWidth[0] + colWidth[1] + margin * 2;
  const height = y + margin * 1.4;

  const paths: [ThingKind, ThingKind][] = [];
  rows.forEach(([a, b], ri) => {
    paths.push([a, b]);
    if (ri > 0) {
      paths.push([rows[ri - 1][0], a]);
      paths.push([rows[ri - 1][1], b]);
    }
  });

  // Ponds sit between rows, in the middle of the park.
  const midX = margin + colWidth[0];
  const ponds = rows.slice(0, -1).flatMap((row, ri) => {
    if (ri % 2 === 1) return [];
    const below = rows[ri + 1];
    const py = (Math.max(lawns[row[0]].y + lawns[row[0]].r, lawns[row[1]].y + lawns[row[1]].r) + Math.min(lawns[below[0]].y - lawns[below[0]].r, lawns[below[1]].y - lawns[below[1]].r)) / 2;
    return [{ x: midX, y: py, rx: 78, ry: 40 }];
  });

  // Trees and bushes scattered on open meadow, never on a lawn, a path end, or a pond.
  const decor: Decor[] = [];
  const clear = (x: number, y: number, pad: number) =>
    Object.values(lawns).every((l) => Math.hypot(x - l.x, y - l.y) > l.r + pad) &&
    ponds.every((p) => Math.hypot((x - p.x) / (p.rx + pad), (y - p.y) / (p.ry + pad)) > 1);
  const step = 150;
  for (let gx = step / 2; gx < width; gx += step) {
    for (let gy = step / 2; gy < height; gy += step) {
      const h = hash(`${gx},${gy}`);
      if (h % 3 === 0) continue;
      const x = gx + ((h % 97) / 97 - 0.5) * step * 0.8;
      const yy = gy + (((h >>> 7) % 89) / 89 - 0.5) * step * 0.8;
      if (!clear(x, yy, 50)) continue;
      const pick = (h >>> 13) % 10;
      decor.push({ kind: pick < 4 ? "tree" : pick < 7 ? "bush" : "flowers", x, y: yy, s: 0.85 + ((h >>> 17) % 30) / 100 });
    }
  }
  return { width, height, lawns, paths, ponds, decor };
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
 * A lawn's organic outline: a closed, smooth blob around a center, slightly
 * different for every lawn so the park never looks stamped out.
 */
export function blobPath(cx: number, cy: number, r: number, seed: number, points = 11) {
  const pts = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const wobble = 0.93 + (((seed >>> ((i * 3) % 29)) & 7) / 7) * 0.07;
    return { x: cx + Math.cos(a) * r * wobble * 1.04, y: cy + Math.sin(a) * r * wobble * 0.97 };
  });
  // Catmull-Rom through the points, written as cubic curves.
  let d = `M${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 0; i < points; i++) {
    const p0 = pts[(i - 1 + points) % points];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % points];
    const p3 = pts[(i + 2) % points];
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
  }
  return `${d} Z`;
}

export function countLabel(zone: Zone, n: number) {
  return `${n} ${n === 1 ? zone.one : zone.many}`;
}
