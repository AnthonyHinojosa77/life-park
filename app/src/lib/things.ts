import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "./db";
import { connections, things } from "./db/app-schema";
import type { ThingKind } from "./kinds";

export { countByKind } from "./kinds";

export type Thing = typeof things.$inferSelect;

/** One item coming in from a source, before it is saved. */
export type IncomingThing = {
  sourceId: string;
  kind: ThingKind;
  title: string;
  date?: Date | null;
  detail?: Record<string, unknown>;
};

/** What the park needs to draw one thing. */
export type ParkThing = Pick<Thing, "id" | "kind" | "title" | "source"> & {
  date: string | null;
  createdAt: string;
  detail: Record<string, unknown>;
};

const MAX_TITLE = 200;

/** Saves items from one source. Items already saved from that source are updated, not duplicated. */
export async function upsertThings(userId: string, source: string, items: IncomingThing[]) {
  if (items.length === 0) return 0;
  const rows = items.map((item) => ({
    id: crypto.randomUUID(),
    userId,
    source,
    sourceId: item.sourceId,
    kind: item.kind,
    title: item.title.trim().slice(0, MAX_TITLE) || "Untitled",
    date: item.date ?? null,
    detail: item.detail ?? {},
  }));
  // Postgres rejects one statement that updates the same row twice.
  const unique = [...new Map(rows.map((r) => [r.sourceId, r])).values()];
  for (let i = 0; i < unique.length; i += 200) {
    await db
      .insert(things)
      .values(unique.slice(i, i + 200))
      .onConflictDoUpdate({
        target: [things.userId, things.source, things.sourceId],
        set: {
          kind: sql`excluded.kind`,
          title: sql`excluded.title`,
          date: sql`excluded.date`,
          detail: sql`excluded.detail`,
          updatedAt: new Date(),
        },
      });
  }
  return unique.length;
}

/** Saves one thing the assistant filed from chat. */
export async function saveChatThing(userId: string, item: Omit<IncomingThing, "sourceId">) {
  const sourceId = crypto.randomUUID();
  await upsertThings(userId, "chat", [{ ...item, sourceId }]);
  return sourceId;
}

/** Everything in someone's park, oldest first so new arrivals land last. */
export async function listParkThings(userId: string): Promise<ParkThing[]> {
  const rows = await db
    .select({
      id: things.id,
      kind: things.kind,
      title: things.title,
      source: things.source,
      date: things.date,
      detail: things.detail,
      createdAt: things.createdAt,
    })
    .from(things)
    .where(eq(things.userId, userId))
    .orderBy(asc(things.createdAt), asc(things.id))
    .limit(3000);
  return rows.map((r) => ({
    ...r,
    date: r.date ? r.date.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
  }));
}

export async function recordConnection(
  userId: string,
  service: string,
  result: { status: "connected" | "error"; itemCount?: number; lastError?: string | null },
) {
  const values = {
    userId,
    service,
    status: result.status,
    itemCount: result.itemCount ?? 0,
    lastError: result.lastError ?? null,
    lastImportedAt: new Date(),
  };
  await db
    .insert(connections)
    .values(values)
    .onConflictDoUpdate({
      target: [connections.userId, connections.service],
      set: {
        status: values.status,
        itemCount: values.itemCount,
        lastError: values.lastError,
        lastImportedAt: values.lastImportedAt,
      },
    });
}

export async function listConnections(userId: string) {
  return db.select().from(connections).where(eq(connections.userId, userId));
}

export async function deleteThingsFrom(userId: string, source: string) {
  await db.delete(things).where(and(eq(things.userId, userId), eq(things.source, source)));
}
