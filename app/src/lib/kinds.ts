/**
 * The kinds of things LifePark keeps. Each has its own place in the park.
 * Kept free of database code so screens in the browser can use it too.
 */
export const thingKinds = ["person", "event", "habit", "recipe", "note", "list", "file", "mail", "repo"] as const;
export type ThingKind = (typeof thingKinds)[number];

/** How many of each kind there are. Kinds with none are included as 0. */
export function countByKind(list: { kind: ThingKind }[]) {
  const counts = Object.fromEntries(thingKinds.map((k) => [k, 0])) as Record<ThingKind, number>;
  for (const t of list) counts[t.kind] = (counts[t.kind] ?? 0) + 1;
  return counts;
}
