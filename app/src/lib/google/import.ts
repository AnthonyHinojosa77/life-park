import { and, eq } from "drizzle-orm";
import { auth } from "../auth";
import { db } from "../db";
import { account } from "../db/schema";
import { recordConnection, upsertThings, type IncomingThing } from "../things";
import { grantedServices, type GoogleServiceId } from "./services";

export class GoogleAccessError extends Error {}

type Json = Record<string, unknown>;

/** Google's API address. Browser tests point GOOGLE_API_BASE at a local stand-in. */
function api(host: string, path: string) {
  const base = process.env.GOOGLE_API_BASE;
  return base ? `${base}${path}` : `https://${host}${path}`;
}

async function getJson(token: string, url: string): Promise<Json> {
  const res = await fetch(url, { headers: { authorization: `Bearer ${token}` } });
  if (res.status === 401 || res.status === 403) {
    throw new GoogleAccessError("Google didn't allow access. Try connecting again.");
  }
  if (!res.ok) throw new Error(`Google answered ${res.status}.`);
  return (await res.json()) as Json;
}

const list = (v: unknown) => (Array.isArray(v) ? (v as Json[]) : []);
const str = (v: unknown) => (typeof v === "string" ? v : undefined);
const DAY = 24 * 60 * 60 * 1000;

async function calendar(token: string): Promise<IncomingThing[]> {
  const now = Date.now();
  const params = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
    timeMin: new Date(now - 30 * DAY).toISOString(),
    timeMax: new Date(now + 365 * DAY).toISOString(),
  });
  const data = await getJson(token, api("www.googleapis.com", `/calendar/v3/calendars/primary/events?${params}`));
  return list(data.items)
    .filter((e) => e.status !== "cancelled" && str(e.id))
    .map((e) => {
      const start = (e.start ?? {}) as Json;
      const when = str(start.dateTime) ?? str(start.date);
      return {
        sourceId: str(e.id)!,
        kind: "event" as const,
        title: str(e.summary) ?? "Busy",
        date: when ? new Date(when) : null,
        detail: { allDay: !start.dateTime, location: str(e.location) ?? null },
      };
    });
}

async function contacts(token: string): Promise<IncomingThing[]> {
  const out: IncomingThing[] = [];
  let pageToken: string | undefined;
  for (let page = 0; page < 4; page++) {
    const params = new URLSearchParams({ personFields: "names,birthdays", pageSize: "500" });
    if (pageToken) params.set("pageToken", pageToken);
    const data = await getJson(token, api("people.googleapis.com", `/v1/people/me/connections?${params}`));
    for (const p of list(data.connections)) {
      const name = str(list(p.names)[0]?.displayName);
      const id = str(p.resourceName);
      if (!name || !id) continue;
      const b = list(p.birthdays)[0]?.date as Json | undefined;
      const birthday =
        b && typeof b.month === "number" && typeof b.day === "number"
          ? { month: b.month, day: b.day, year: typeof b.year === "number" ? b.year : null }
          : null;
      out.push({ sourceId: id, kind: "person", title: name, detail: { birthday } });
    }
    pageToken = str(data.nextPageToken);
    if (!pageToken) break;
  }
  return out;
}

async function tasks(token: string): Promise<IncomingThing[]> {
  const data = await getJson(token, api("www.googleapis.com", "/tasks/v1/users/@me/lists?maxResults=100"));
  const lists = list(data.items).filter((l) => str(l.id));
  return Promise.all(
    lists.map(async (l) => {
      const id = str(l.id)!;
      const items = await getJson(
        token,
        api("www.googleapis.com", `/tasks/v1/lists/${encodeURIComponent(id)}/tasks?showCompleted=false&maxResults=100`),
      );
      return {
        sourceId: id,
        kind: "list" as const,
        title: str(l.title) ?? "To-do",
        detail: {
          items: list(items.items)
            .map((t) => ({ title: str(t.title) ?? "", due: str(t.due) ?? null }))
            .filter((t) => t.title),
        },
      };
    }),
  );
}

async function gmail(token: string): Promise<IncomingThing[]> {
  const data = await getJson(
    token,
    api("www.googleapis.com", "/gmail/v1/users/me/messages?maxResults=25&labelIds=INBOX"),
  );
  const ids = list(data.messages).map((m) => str(m.id)).filter((id): id is string => !!id);
  const out: IncomingThing[] = [];
  // A few at a time, to stay well inside Google's rate limits.
  for (let i = 0; i < ids.length; i += 5) {
    const batch = await Promise.all(
      ids.slice(i, i + 5).map((id) =>
        getJson(
          token,
          api(
            "www.googleapis.com",
            `/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
          ),
        ),
      ),
    );
    for (const m of batch) {
      const headers = list((m.payload as Json | undefined)?.headers);
      const header = (name: string) => str(headers.find((h) => str(h.name)?.toLowerCase() === name)?.value);
      const date = header("date");
      out.push({
        sourceId: str(m.id)!,
        kind: "mail",
        title: header("subject") || "(no subject)",
        date: date && !Number.isNaN(Date.parse(date)) ? new Date(date) : null,
        detail: { from: header("from")?.replace(/\s*<.*>$/, "") ?? null },
      });
    }
  }
  return out;
}

const DOC = "application/vnd.google-apps.document";
const SHEET = "application/vnd.google-apps.spreadsheet";
const FOLDER = "application/vnd.google-apps.folder";

function driveFiles(query: string, type: "file" | "doc" | "sheet") {
  return async (token: string): Promise<IncomingThing[]> => {
    const params = new URLSearchParams({
      q: `trashed = false and ${query}`,
      pageSize: "100",
      orderBy: "modifiedTime desc",
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    });
    const data = await getJson(token, api("www.googleapis.com", `/drive/v3/files?${params}`));
    return list(data.files)
      .filter((f) => str(f.id))
      .map((f) => ({
        sourceId: str(f.id)!,
        kind: "file" as const,
        title: str(f.name) ?? "Untitled",
        date: str(f.modifiedTime) ? new Date(str(f.modifiedTime)!) : null,
        detail: { type, link: str(f.webViewLink) ?? null },
      }));
  };
}

const importers: Record<GoogleServiceId, (token: string) => Promise<IncomingThing[]>> = {
  calendar,
  contacts,
  tasks,
  gmail,
  drive: driveFiles(`mimeType != '${FOLDER}' and mimeType != '${DOC}' and mimeType != '${SHEET}'`, "file"),
  docs: driveFiles(`mimeType = '${DOC}'`, "doc"),
  sheets: driveFiles(`mimeType = '${SHEET}'`, "sheet"),
};

async function googleAccount(userId: string) {
  const rows = await db
    .select({ id: account.id, scope: account.scope })
    .from(account)
    .where(and(eq(account.userId, userId), eq(account.providerId, "google")))
    .limit(1);
  return rows[0] ?? null;
}

/** Which Google services the person allowed, or null when no Google account is linked. */
export async function googleGrants(userId: string) {
  const linked = await googleAccount(userId);
  return linked ? grantedServices(linked.scope) : null;
}

/** Pulls one service into the park and records how it went. Never throws. */
export async function importGoogleService(userId: string, service: GoogleServiceId) {
  try {
    const linked = await googleAccount(userId);
    if (!linked) throw new GoogleAccessError("Google isn't connected.");
    const { accessToken } = await auth.api.getAccessToken({ body: { accountId: linked.id, userId } });
    if (!accessToken) throw new GoogleAccessError("Google isn't connected.");
    const items = await importers[service](accessToken);
    const count = await upsertThings(userId, service, items);
    await recordConnection(userId, service, { status: "connected", itemCount: count });
    return { service, count };
  } catch (error) {
    const message =
      error instanceof GoogleAccessError ? error.message : "Something went wrong reaching Google. Try again later.";
    if (!(error instanceof GoogleAccessError)) console.error(`[import] ${service}`, error);
    await recordConnection(userId, service, { status: "error", lastError: message });
    return { service, count: 0, error: message };
  }
}
