import type { ThingKind } from "../kinds";

/**
 * The park map is drawn in one of two coordinate boxes: tall for phones, wide
 * for laptops. Each lawn has a center in both.
 */
export const worlds = {
  tall: { width: 640, height: 990 },
  wide: { width: 1120, height: 640 },
} as const;
export type WorldShape = keyof typeof worlds;

/** A lawn's radius: small when empty, growing with what is planted on it. */
export const LAWN_MIN = 62;
export const LAWN_MAX = 110;
export function lawnRadius(count: number) {
  if (count <= 0) return LAWN_MIN;
  return Math.min(LAWN_MAX, 74 + Math.sqrt(count) * 8);
}

export type Zone = {
  kind: ThingKind;
  /** What the area is called in the park. */
  name: string;
  /** What one thing is called there, singular and plural. */
  one: string;
  many: string;
  /** The sign on an empty area, and the sentence it types into a new chat. */
  sign: string;
  starter: string;
  /** Lawn centers in the tall (phone) and wide (laptop) maps. */
  tall: { x: number; y: number };
  wide: { x: number; y: number };
};

/** Every area of the park, in the order a newcomer is nudged to fill them. */
export const zones: Zone[] = [
  {
    kind: "person",
    name: "Neighborhood",
    one: "neighbor",
    many: "neighbors",
    sign: "Who's in your life?",
    starter: "Someone important to me is ",
    tall: { x: 180, y: 140 },
    wide: { x: 150, y: 190 },
  },
  {
    kind: "event",
    name: "Festival board",
    one: "event",
    many: "events",
    sign: "What's coming up?",
    starter: "Coming up soon: ",
    tall: { x: 470, y: 170 },
    wide: { x: 430, y: 160 },
  },
  {
    kind: "habit",
    name: "Garden",
    one: "habit",
    many: "habits",
    sign: "Plant a habit",
    starter: "A habit I want to keep: ",
    tall: { x: 160, y: 865 },
    wide: { x: 710, y: 470 },
  },
  {
    kind: "recipe",
    name: "Orchard",
    one: "recipe",
    many: "recipes",
    sign: "Grow a recipe",
    starter: "Here's a recipe I love: ",
    tall: { x: 480, y: 650 },
    wide: { x: 440, y: 490 },
  },
  {
    kind: "list",
    name: "Picnic lawn",
    one: "list",
    many: "lists",
    sign: "Lay out a list",
    starter: "Make me a list for ",
    tall: { x: 190, y: 630 },
    wide: { x: 160, y: 470 },
  },
  {
    kind: "note",
    name: "Bench walk",
    one: "note",
    many: "notes",
    sign: "Leave a note",
    starter: "Remember this for me: ",
    tall: { x: 460, y: 870 },
    wide: { x: 975, y: 480 },
  },
  {
    kind: "file",
    name: "Library",
    one: "file",
    many: "files",
    sign: "Shelve a file",
    starter: "Keep track of this document: ",
    tall: { x: 150, y: 390 },
    wide: { x: 970, y: 170 },
  },
  {
    kind: "mail",
    name: "Post office",
    one: "letter",
    many: "letters",
    sign: "Mail arrives here",
    starter: "Keep an eye on this email: ",
    tall: { x: 470, y: 410 },
    wide: { x: 700, y: 190 },
  },
];

export type Stage = "empty" | "sprout" | "growing" | "bloom";

/** How grown an area looks, from its number of things. */
export function stageOf(count: number): Stage {
  if (count <= 0) return "empty";
  if (count < 5) return "sprout";
  if (count < 20) return "growing";
  return "bloom";
}

/**
 * Spots for up to `max` items in a box, sized so they fill it: few items are
 * drawn big, many are drawn small. `unit` is one item's size at scale 1.
 */
export function fit(
  box: { x: number; y: number; w: number; h: number },
  n: number,
  max: number,
  unit: { w: number; h: number },
  maxScale = 2,
) {
  const shown = Math.min(n, max);
  if (shown === 0) return { cells: [], scale: 1 };
  let best = { cols: 1, rows: shown, scale: 0 };
  for (let cols = 1; cols <= shown; cols++) {
    const rows = Math.ceil(shown / cols);
    const scale = Math.min(box.w / cols / unit.w, box.h / rows / unit.h);
    if (scale > best.scale) best = { cols, rows, scale };
  }
  const scale = Math.min(best.scale * 0.82, maxScale);
  const cellW = box.w / best.cols;
  const cellH = box.h / best.rows;
  const cells = Array.from({ length: shown }, (_, i) => {
    const row = Math.floor(i / best.cols);
    // Center a short last row.
    const inRow = row === best.rows - 1 ? shown - row * best.cols : best.cols;
    const offset = ((best.cols - inRow) * cellW) / 2;
    return {
      x: box.x + offset + (i % best.cols) * cellW + cellW / 2,
      y: box.y + row * cellH + cellH / 2,
    };
  });
  return { cells, scale };
}

/** How far along the park is: areas with at least one thing, out of all areas. */
export function progress(counts: Record<ThingKind, number>) {
  const grown = zones.filter((z) => (counts[z.kind] ?? 0) > 0).length;
  return { grown, total: zones.length };
}

/** Paths between lawns that sit next to each other in each map shape. */
export const paths: Record<WorldShape, [ThingKind, ThingKind][]> = {
  tall: [
    ["person", "event"],
    ["person", "file"],
    ["event", "mail"],
    ["file", "list"],
    ["mail", "recipe"],
    ["list", "recipe"],
    ["list", "habit"],
    ["recipe", "note"],
    ["habit", "note"],
  ],
  wide: [
    ["person", "event"],
    ["event", "mail"],
    ["mail", "file"],
    ["person", "list"],
    ["event", "recipe"],
    ["mail", "habit"],
    ["file", "note"],
    ["list", "recipe"],
    ["habit", "note"],
  ],
};

/** Where the pond and compass sit in each map shape. */
export const landmarks: Record<WorldShape, { pond: { x: number; y: number }; compass: { x: number; y: number } }> = {
  tall: { pond: { x: 330, y: 280 }, compass: { x: 604, y: 40 } },
  wide: { pond: { x: 570, y: 335 }, compass: { x: 1080, y: 40 } },
};

/**
 * A lawn's organic outline: a closed, smooth blob around a center, slightly
 * different for every lawn so the park never looks stamped out.
 */
export function blobPath(cx: number, cy: number, r: number, seed: number, points = 9) {
  const pts = Array.from({ length: points }, (_, i) => {
    const a = (i / points) * Math.PI * 2;
    const wobble = 0.9 + (((seed >>> (i * 3)) & 7) / 7) * 0.1;
    return { x: cx + Math.cos(a) * r * wobble * 1.08, y: cy + Math.sin(a) * r * wobble * 0.94 };
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

/** The first empty area worth filling next, or null when every area is growing. */
export function nextZone(counts: Record<ThingKind, number>) {
  // Mail and files only arrive from connected accounts, so chat never nudges toward them.
  return zones.find((z) => z.kind !== "mail" && z.kind !== "file" && (counts[z.kind] ?? 0) === 0) ?? null;
}

/** A small stable number from a string, for picking colors and slight variations. */
export function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function countLabel(zone: Zone, n: number) {
  return `${n} ${n === 1 ? zone.one : zone.many}`;
}
