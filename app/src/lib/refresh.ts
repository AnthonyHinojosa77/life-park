import { eq } from "drizzle-orm";
import { db } from "./db";
import { account } from "./db/schema";
import { googleGrants, importGoogleService } from "./google/import";
import type { GoogleServiceId } from "./google/services";
import { listConnections } from "./things";

/** How old a service's last import can be before the park refreshes it. */
export const NIGHTLY_AGE_MS = 20 * 60 * 60 * 1000;
export const ON_OPEN_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Which of a person's connected Google services need bringing in again:
 * never imported, last import failed, or last import older than `maxAgeMs`.
 */
export async function servicesDue(userId: string, now: Date, maxAgeMs: number) {
  const grants = await googleGrants(userId);
  if (!grants?.length) return { fresh: [] as GoogleServiceId[], stale: [] as GoogleServiceId[] };
  const connections = await listConnections(userId);
  const fresh: GoogleServiceId[] = [];
  const stale: GoogleServiceId[] = [];
  for (const service of grants) {
    const c = connections.find((x) => x.service === service);
    if (!c || c.status !== "connected") fresh.push(service);
    else if (!c.lastImportedAt || now.getTime() - c.lastImportedAt.getTime() > maxAgeMs) stale.push(service);
  }
  return { fresh, stale };
}

/**
 * The nightly job: refreshes every connected Google service that is due,
 * oldest first, until the time budget runs out. Anything left over is picked
 * up the next night or when its owner opens the park. Safe to call repeatedly:
 * recently refreshed services are skipped.
 */
export async function runNightlyRefresh({ now = new Date(), budgetMs = 50_000, maxAgeMs = NIGHTLY_AGE_MS } = {}) {
  const started = Date.now();
  const users = await db.selectDistinct({ userId: account.userId }).from(account).where(eq(account.providerId, "google"));
  const due: { userId: string; services: GoogleServiceId[]; oldest: number }[] = [];
  for (const { userId } of users) {
    const { fresh, stale } = await servicesDue(userId, now, maxAgeMs);
    const services = [...fresh, ...stale];
    if (!services.length) continue;
    // Whoever has waited longest goes first; never-imported services count as oldest.
    const times = (await listConnections(userId)).map((c) => c.lastImportedAt?.getTime() ?? 0);
    due.push({ userId, services, oldest: times.length ? Math.min(...times) : 0 });
  }
  due.sort((a, b) => a.oldest - b.oldest);

  let refreshed = 0;
  let failed = 0;
  let people = 0;
  for (const person of due) {
    if (Date.now() - started > budgetMs) break;
    people++;
    for (const service of person.services) {
      if (Date.now() - started > budgetMs) break;
      const result = await importGoogleService(person.userId, service);
      if (result.error) failed++;
      else refreshed++;
    }
  }
  return { people, refreshed, failed, waiting: due.length - people };
}
