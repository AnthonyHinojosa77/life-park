import { eq } from "drizzle-orm";
import { db } from "./db";
import { githubInstallations } from "./db/app-schema";
import { account } from "./db/schema";
import { githubInstallationsOf, importGitHub } from "./github/import";
import { googleGrants, importGoogleService } from "./google/import";
import type { ImportService } from "./import-services";
import { listConnections } from "./things";

export { isImportService, type ImportService } from "./import-services";

/** Brings one connected service into someone's park. Never throws. */
export function importService(userId: string, service: ImportService) {
  return service === "github" ? importGitHub(userId) : importGoogleService(userId, service);
}

/** Which services someone has connected: the Google services they allowed, and GitHub if installed. */
export async function connectedServices(userId: string): Promise<ImportService[]> {
  const [grants, installs] = await Promise.all([googleGrants(userId), githubInstallationsOf(userId)]);
  return [...(grants ?? []), ...(installs.length ? (["github"] as const) : [])];
}

/** How old a service's last import can be before the park refreshes it. */
export const NIGHTLY_AGE_MS = 20 * 60 * 60 * 1000;
export const ON_OPEN_AGE_MS = 12 * 60 * 60 * 1000;

/**
 * Which of a person's connected services need bringing in again:
 * never imported, last import failed, or last import older than `maxAgeMs`.
 */
export async function servicesDue(userId: string, now: Date, maxAgeMs: number) {
  const grants = await connectedServices(userId);
  if (!grants.length) return { fresh: [] as ImportService[], stale: [] as ImportService[] };
  const connections = await listConnections(userId);
  const fresh: ImportService[] = [];
  const stale: ImportService[] = [];
  for (const service of grants) {
    const c = connections.find((x) => x.service === service);
    if (!c || c.status !== "connected") fresh.push(service);
    else if (!c.lastImportedAt || now.getTime() - c.lastImportedAt.getTime() > maxAgeMs) stale.push(service);
  }
  return { fresh, stale };
}

/**
 * The nightly job: refreshes every connected service (Google and GitHub) that is due,
 * oldest first, until the time budget runs out. Anything left over is picked
 * up the next night or when its owner opens the park. Safe to call repeatedly:
 * recently refreshed services are skipped.
 */
export async function runNightlyRefresh({ now = new Date(), budgetMs = 50_000, maxAgeMs = NIGHTLY_AGE_MS } = {}) {
  const started = Date.now();
  const google = await db.selectDistinct({ userId: account.userId }).from(account).where(eq(account.providerId, "google"));
  const github = await db.selectDistinct({ userId: githubInstallations.userId }).from(githubInstallations);
  const users = [...new Set([...google, ...github].map((u) => u.userId))].map((userId) => ({ userId }));
  const due: { userId: string; services: ImportService[]; oldest: number }[] = [];
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
      const result = await importService(person.userId, service);
      if (result.error) failed++;
      else refreshed++;
    }
  }
  return { people, refreshed, failed, waiting: due.length - people };
}
