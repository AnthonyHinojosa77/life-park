import { tool } from "ai";
import { z } from "zod";
import { listParkThings, saveChatThing } from "../things";

/** The kinds the assistant may file from chat. Mail and files only arrive from connected accounts. */
const chatKinds = ["person", "event", "habit", "recipe", "note", "list"] as const;

/** Tools that let the assistant file things into, and look things up in, one person's park. */
export function parkTools(userId: string) {
  return {
    save_to_park: tool({
      description:
        "Save something the user told you about their life so it appears in their park: a person, an event, a habit, a recipe, a note, or a list.",
      inputSchema: z.object({
        kind: z.enum(chatKinds),
        title: z.string().min(1).max(200).describe("Short name, like 'Sam Rivera' or 'Leg day' or 'Grandma's chili'"),
        date: z.string().max(40).optional().describe("When it happens, as an ISO 8601 date or date-time"),
        birthday: z.string().regex(/^\d{2}-\d{2}$/).optional().describe("For a person: birthday as MM-DD"),
        details: z.string().max(2000).optional().describe("Anything else worth keeping, in plain words"),
        items: z.array(z.string().min(1).max(200)).max(50).optional().describe("For a list or recipe: its items or ingredients"),
      }),
      execute: async ({ kind, title, date, birthday, details, items }) => {
        const when = date && !Number.isNaN(Date.parse(date)) ? new Date(date) : null;
        const [month, day] = birthday ? birthday.split("-").map(Number) : [];
        await saveChatThing(userId, {
          kind,
          title,
          date: when,
          detail: {
            ...(details ? { notes: details } : {}),
            ...(items?.length ? { items: items.map((t) => ({ title: t })) } : {}),
            ...(month && day ? { birthday: { month, day, year: null } } : {}),
          },
        });
        return { saved: true, kind, title };
      },
    }),
    find_in_park: tool({
      description:
        "Look up things saved in the user's park, to answer questions about their life (birthdays, plans, recipes, lists, mail, files).",
      inputSchema: z.object({
        query: z.string().max(100).optional().describe("Words to look for in titles and details"),
        kind: z.enum([...chatKinds, "file", "mail"]).optional(),
      }),
      execute: async ({ query, kind }) => {
        const words = (query ?? "").toLowerCase().split(/\s+/).filter(Boolean);
        const matches = (await listParkThings(userId))
          .filter((t) => !kind || t.kind === kind)
          .filter((t) => {
            if (words.length === 0) return true;
            const hay = `${t.title} ${JSON.stringify(t.detail)}`.toLowerCase();
            return words.some((w) => hay.includes(w));
          })
          .reverse()
          .slice(0, 30);
        return matches.map((t) => ({ kind: t.kind, title: t.title, date: t.date, detail: t.detail }));
      },
    }),
  };
}
