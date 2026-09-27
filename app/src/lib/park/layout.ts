import type { ThingKind } from "../kinds";

/** The park is drawn in this coordinate box and scales to fit the screen. */
export const PARK_WIDTH = 400;
export const PARK_HEIGHT = 820;

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
  x: number;
  y: number;
  w: number;
  h: number;
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
    x: 16,
    y: 20,
    w: 228,
    h: 200,
  },
  {
    kind: "event",
    name: "Festival board",
    one: "event",
    many: "events",
    sign: "What's coming up?",
    starter: "Coming up soon: ",
    x: 256,
    y: 20,
    w: 128,
    h: 200,
  },
  {
    kind: "habit",
    name: "Garden",
    one: "habit",
    many: "habits",
    sign: "Plant a habit",
    starter: "A habit I want to keep: ",
    x: 16,
    y: 568,
    w: 176,
    h: 162,
  },
  {
    kind: "recipe",
    name: "Orchard",
    one: "recipe",
    many: "recipes",
    sign: "Grow a recipe",
    starter: "Here's a recipe I love: ",
    x: 208,
    y: 568,
    w: 176,
    h: 162,
  },
  {
    kind: "list",
    name: "Picnic lawn",
    one: "list",
    many: "lists",
    sign: "Lay out a list",
    starter: "Make me a list for ",
    x: 16,
    y: 424,
    w: 368,
    h: 128,
  },
  {
    kind: "note",
    name: "Bench walk",
    one: "note",
    many: "notes",
    sign: "Leave a note",
    starter: "Remember this for me: ",
    x: 16,
    y: 746,
    w: 368,
    h: 62,
  },
  {
    kind: "file",
    name: "Library",
    one: "file",
    many: "files",
    sign: "Shelve a file",
    starter: "Keep track of this document: ",
    x: 16,
    y: 236,
    w: 176,
    h: 172,
  },
  {
    kind: "mail",
    name: "Post office",
    one: "letter",
    many: "letters",
    sign: "Mail arrives here",
    starter: "Keep an eye on this email: ",
    x: 208,
    y: 236,
    w: 176,
    h: 172,
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

/** Positions for up to `max` items laid out in rows inside a box, left to right. */
export function grid(box: { x: number; y: number; w: number; h: number }, n: number, cols: number, max: number) {
  const shown = Math.min(n, max);
  const rows = Math.ceil(max / cols);
  const cellW = box.w / cols;
  const cellH = box.h / rows;
  return Array.from({ length: shown }, (_, i) => ({
    x: box.x + (i % cols) * cellW + cellW / 2,
    y: box.y + Math.floor(i / cols) * cellH + cellH / 2,
    w: cellW,
    h: cellH,
  }));
}

/** How far along the park is: areas with at least one thing, out of all areas. */
export function progress(counts: Record<ThingKind, number>) {
  const grown = zones.filter((z) => (counts[z.kind] ?? 0) > 0).length;
  return { grown, total: zones.length };
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
