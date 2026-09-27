/**
 * The Google services someone can connect after signing in, in the order the
 * connect screen shows them. Each asks Google for read-only access and feeds
 * one part of the park.
 */
export const googleServices = [
  {
    id: "calendar",
    label: "Google Calendar",
    park: "Events hang as flags on the festival board.",
    scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
  },
  {
    id: "contacts",
    label: "Google Contacts",
    park: "The people you know move in as neighbors, birthdays and all.",
    scopes: ["https://www.googleapis.com/auth/contacts.readonly"],
  },
  {
    id: "tasks",
    label: "Google Tasks",
    park: "Your to-do lists become picnic blankets on the lawn.",
    scopes: ["https://www.googleapis.com/auth/tasks.readonly"],
  },
  {
    id: "gmail",
    label: "Gmail",
    park: "Recent mail arrives at the post office.",
    scopes: ["https://www.googleapis.com/auth/gmail.metadata"],
  },
  {
    id: "drive",
    label: "My Drive",
    park: "Your files fill the library shelves.",
    scopes: ["https://www.googleapis.com/auth/drive.metadata.readonly"],
  },
  {
    id: "docs",
    label: "Google Docs",
    park: "Your documents join the library.",
    scopes: [
      "https://www.googleapis.com/auth/documents.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
  },
  {
    id: "sheets",
    label: "Google Sheets",
    park: "Your spreadsheets join the library.",
    scopes: [
      "https://www.googleapis.com/auth/spreadsheets.readonly",
      "https://www.googleapis.com/auth/drive.metadata.readonly",
    ],
  },
] as const;

export type GoogleServiceId = (typeof googleServices)[number]["id"];

export function isGoogleService(id: string): id is GoogleServiceId {
  return googleServices.some((s) => s.id === id);
}

/** Every scope needed for the chosen services, without repeats. */
export function scopesFor(ids: readonly string[]) {
  return [...new Set(googleServices.filter((s) => ids.includes(s.id)).flatMap((s) => s.scopes))];
}

/** Services whose scopes were all granted. Google lets people untick boxes on its consent screen. */
export function grantedServices(grantedScope: string | null | undefined): GoogleServiceId[] {
  const granted = new Set((grantedScope ?? "").split(/[\s,]+/).filter(Boolean));
  return googleServices.filter((s) => s.scopes.every((scope) => granted.has(scope))).map((s) => s.id);
}
