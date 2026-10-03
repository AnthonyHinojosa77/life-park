import type { ThingKind } from "../kinds";
import type { ParkThing } from "../things";

/** One category inside a lawn: a street of the Neighborhood, a shelf of the Library, and so on. */
export type Group = { id: string; name: string; things: ParkThing[] };

const DAY = 86400000;

const familyWords = /^(mom|mum|mother|dad|father|grandma|grandpa|granny|nana|papa|nonna|abuela|abuelo|sis|bro|auntie|aunt|uncle|cousin)\b/i;

/** The streets of the Neighborhood, by first letter. */
const streets: [string, RegExp][] = [
  ["A–D Street", /^[a-d]/i],
  ["E–H Street", /^[e-h]/i],
  ["I–L Street", /^[i-l]/i],
  ["M–P Street", /^[m-p]/i],
  ["Q–T Street", /^[q-t]/i],
  ["U–Z Street", /^[u-z]/i],
];

const recipeWords: [string, RegExp][] = [
  ["Breakfast", /\b(breakfast|pancake|waffle|oat|granola|omelet|egg|toast|smoothie|brunch)/i],
  ["Soups & salads", /\b(soup|stew|chowder|broth|salad|slaw)/i],
  ["Desserts & baking", /\b(cake|cookie|pie|tart|brownie|dessert|pudding|ice cream|muffin|bread|bake|baking|sweet)/i],
  ["Drinks", /\b(drink|cocktail|lemonade|tea|coffee|latte|juice|punch|margarita)/i],
];

function pick(list: ParkThing[], test: (t: ParkThing) => boolean) {
  const yes: ParkThing[] = [];
  const no: ParkThing[] = [];
  for (const t of list) (test(t) ? yes : no).push(t);
  return [yes, no] as const;
}

const daysUntilBirthday = (t: ParkThing, now: number) => {
  const b = t.detail.birthday as { month: number; day: number } | null | undefined;
  if (!b) return Infinity;
  const year = new Date(now).getFullYear();
  const next = new Date(year, b.month - 1, b.day);
  if (next.getTime() < now - DAY) next.setFullYear(year + 1);
  return (next.getTime() - now) / DAY;
};

const when = (t: ParkThing) => (t.date ? Date.parse(t.date) : Date.parse(t.createdAt));

function byAge(list: ParkThing[], now: number, names: [string, string, string]) {
  const week = now - 7 * DAY;
  const month = now - 30 * DAY;
  const [recent, rest] = pick(list, (t) => when(t) >= week);
  const [thisMonth, older] = pick(rest, (t) => when(t) >= month);
  return [
    { id: "week", name: names[0], things: recent },
    { id: "month", name: names[1], things: thisMonth },
    { id: "older", name: names[2], things: older },
  ];
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "x";

/**
 * Sorts a lawn's things into its categories, in the order they are shown.
 * Empty categories are left out, so a lawn shows only what it has.
 */
export function groupThings(kind: ThingKind, things: ParkThing[], now: number): Group[] {
  const groups = rules[kind](things, now);
  return groups.filter((g) => g.things.length > 0);
}

const rules: Record<ThingKind, (things: ParkThing[], now: number) => Group[]> = {
  person(list, now) {
    const [family, rest] = pick(list, (t) => familyWords.test(t.title));
    const [soon, others] = pick(rest, (t) => daysUntilBirthday(t, now) <= 30);
    const out: Group[] = [
      { id: "family", name: "Family", things: family },
      { id: "birthdays", name: "Birthdays soon", things: soon },
    ];
    if (others.length <= 12) out.push({ id: "everyone", name: "Everyone else", things: others });
    else {
      const left = [...others];
      for (const [name, re] of streets) {
        const [here, rest] = pick(left, (t) => re.test(t.title));
        out.push({ id: slug(name), name, things: here });
        left.length = 0;
        left.push(...rest);
      }
      out.push({ id: "other-street", name: "Other Street", things: left });
    }
    return out;
  },
  event(list, now) {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const today = start.getTime();
    const tomorrow = today + DAY;
    const week = today + 7 * DAY;
    const month = today + 31 * DAY;
    const time = (t: ParkThing) => (t.date ? Date.parse(t.date) : NaN);
    const [dated, undated] = pick(list, (t) => !Number.isNaN(time(t)));
    const [past, coming] = pick(dated, (t) => time(t) < today);
    const [todays, later1] = pick(coming, (t) => time(t) < tomorrow);
    const [thisWeek, later2] = pick(later1, (t) => time(t) < week);
    const [thisMonth, later] = pick(later2, (t) => time(t) < month);
    return [
      { id: "today", name: "Today", things: todays },
      { id: "week", name: "This week", things: thisWeek },
      { id: "month", name: "This month", things: thisMonth },
      { id: "later", name: "Later", things: later },
      { id: "undated", name: "Someday", things: undated },
      { id: "past", name: "Past", things: past.sort((a, b) => time(b) - time(a)) },
    ];
  },
  mail(list) {
    const bySender = new Map<string, ParkThing[]>();
    for (const t of list) {
      const from = typeof t.detail.from === "string" && t.detail.from ? t.detail.from : "Unknown sender";
      bySender.set(from, [...(bySender.get(from) ?? []), t]);
    }
    const senders = [...bySender.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    const own = senders.filter(([, l]) => l.length > 1).slice(0, 8);
    const rest = senders.filter((s) => !own.includes(s)).flatMap(([, l]) => l);
    return [...own.map(([from, l]) => ({ id: `from-${slug(from)}`, name: from, things: l })), { id: "others", name: own.length ? "Other senders" : "Everyone", things: rest }];
  },
  file(list) {
    const mime = (t: ParkThing) => (typeof t.detail.mime === "string" ? t.detail.mime : "");
    const [docs, r1] = pick(list, (t) => t.detail.type === "doc");
    const [sheets, r2] = pick(r1, (t) => t.detail.type === "sheet");
    const [slides, r3] = pick(r2, (t) => mime(t).includes("presentation"));
    const [pdfs, r4] = pick(r3, (t) => mime(t) === "application/pdf" || /\.pdf$/i.test(t.title));
    const [photos, r5] = pick(r4, (t) => mime(t).startsWith("image/") || /\.(jpe?g|png|heic|gif|webp)$/i.test(t.title));
    const [videos, other] = pick(r5, (t) => mime(t).startsWith("video/") || /\.(mp4|mov|m4v)$/i.test(t.title));
    return [
      { id: "docs", name: "Docs", things: docs },
      { id: "sheets", name: "Sheets", things: sheets },
      { id: "slides", name: "Slides", things: slides },
      { id: "pdfs", name: "PDFs", things: pdfs },
      { id: "photos", name: "Photos", things: photos },
      { id: "videos", name: "Videos", things: videos },
      { id: "other", name: "Other files", things: other },
    ];
  },
  list(list) {
    const [tasks, rest] = pick(list, (t) => t.source === "tasks");
    const [chat, other] = pick(rest, (t) => t.source === "chat");
    if (tasks.length === 0 || chat.length + other.length === 0) return [{ id: "all", name: "All lists", things: list }];
    return [
      { id: "tasks", name: "Google Tasks", things: tasks },
      { id: "chat", name: "Made in chat", things: [...chat, ...other] },
    ];
  },
  habit(list, now) {
    const [fresh, kept] = pick(list, (t) => Date.parse(t.createdAt) >= now - 30 * DAY);
    return [
      { id: "new", name: "Just planted", things: fresh },
      { id: "kept", name: "Growing", things: kept },
    ];
  },
  recipe(list) {
    const text = (t: ParkThing) => `${t.title} ${typeof t.detail.notes === "string" ? t.detail.notes : ""}`;
    let left = [...list];
    const out: Group[] = [];
    for (const [name, re] of recipeWords) {
      const [here, rest] = pick(left, (t) => re.test(text(t)));
      out.push({ id: slug(name), name, things: here });
      left = rest;
    }
    out.splice(2, 0, { id: "mains", name: "Mains", things: left });
    return out;
  },
  note(list, now) {
    return byAge(list, now, ["This week", "This month", "Older"]);
  },
  repo(list) {
    const [archived, live] = pick(list, (t) => t.detail.archived === true);
    const byLanguage = new Map<string, ParkThing[]>();
    for (const t of live) {
      const lang = typeof t.detail.language === "string" && t.detail.language ? t.detail.language : "Other";
      byLanguage.set(lang, [...(byLanguage.get(lang) ?? []), t]);
    }
    const langs = [...byLanguage.entries()].filter(([l]) => l !== "Other").sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
    const own = langs.slice(0, 6);
    const rest = [...langs.slice(6).flatMap(([, l]) => l), ...(byLanguage.get("Other") ?? [])];
    // Most recently worked on first, within each.
    const recent = (l: ParkThing[]) => [...l].sort((a, b) => (b.date ? Date.parse(b.date) : 0) - (a.date ? Date.parse(a.date) : 0));
    return [
      ...own.map(([lang, l]) => ({ id: `lang-${slug(lang)}`, name: lang, things: recent(l) })),
      { id: "other", name: own.length ? "Other languages" : "Projects", things: recent(rest) },
      { id: "archived", name: "Archived", things: recent(archived) },
    ];
  },
};
