// @vitest-environment node
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockGoogle } from "../../e2e/mock-google.mjs";

process.env.PGLITE_DIR = "memory";
// Stand-in credentials so the Google provider exists; no real Google call is made.
process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";

const { eq, and } = await import("drizzle-orm");
const { db } = await import("./db");
const { account } = await import("./db/schema");
const { connections } = await import("./db/app-schema");
const { runMigrations } = await import("./db/migrate");
const { auth } = await import("./auth");
const { listConnections, listParkThings, recordConnection } = await import("./things");
const { scopesFor } = await import("./google/services");
const { runNightlyRefresh, servicesDue, NIGHTLY_AGE_MS } = await import("./refresh");
const { GET } = await import("../app/api/cron/refresh/route");

const server = createMockGoogle();
const HOUR = 60 * 60 * 1000;

async function userWithGoogle(email: string, services: string[]) {
  const res = await auth.api.signUpEmail({ body: { name: "Sam", email, password: "a-long-enough-password" } });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    issuer: "https://accounts.google.com",
    accountId: `g-${email}`,
    providerId: "google",
    userId: res.user.id,
    accessToken: "mock-google-token",
    accessTokenExpiresAt: new Date(Date.now() + HOUR),
    scope: ["openid", ...scopesFor(services)].join(","),
    updatedAt: new Date(),
  });
  return res.user.id;
}

async function ageImport(userId: string, service: string, hours: number) {
  await db
    .update(connections)
    .set({ lastImportedAt: new Date(Date.now() - hours * HOUR) })
    .where(and(eq(connections.userId, userId), eq(connections.service, service)));
}

describe("nightly refresh", () => {
  beforeAll(async () => {
    await runMigrations(db);
    await new Promise<void>((r) => server.listen(0, r));
    process.env.GOOGLE_API_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.close();
    delete process.env.GOOGLE_API_BASE;
  });

  it("sorts services into never imported, overdue, and up to date", async () => {
    const userId = await userWithGoogle("due@example.com", ["calendar", "tasks", "gmail"]);
    await recordConnection(userId, "calendar", { status: "connected", itemCount: 2 });
    await recordConnection(userId, "tasks", { status: "connected", itemCount: 2 });
    await ageImport(userId, "tasks", 30);
    const due = await servicesDue(userId, new Date(), NIGHTLY_AGE_MS);
    expect(due.fresh).toEqual(["gmail"]);
    expect(due.stale).toEqual(["tasks"]);
  });

  it("refreshes what is overdue, skips what is fresh, and is safe to run twice", async () => {
    const overdue = await userWithGoogle("overdue@example.com", ["calendar"]);
    await recordConnection(overdue, "calendar", { status: "connected", itemCount: 0 });
    await ageImport(overdue, "calendar", 25);
    const fresh = await userWithGoogle("fresh@example.com", ["contacts"]);
    await recordConnection(fresh, "contacts", { status: "connected", itemCount: 0 });

    const first = await runNightlyRefresh();
    expect(first.failed).toBe(0);
    expect((await listParkThings(overdue)).filter((t) => t.kind === "event")).toHaveLength(2);
    expect(await listParkThings(fresh)).toEqual([]);
    const [c] = await listConnections(overdue);
    expect(Date.now() - c.lastImportedAt!.getTime()).toBeLessThan(60_000);

    const second = await runNightlyRefresh();
    expect(second.refreshed).toBe(0);
  });

  it("stops when its time budget runs out and leaves the rest for later", async () => {
    await userWithGoogle("later1@example.com", ["calendar"]);
    await userWithGoogle("later2@example.com", ["calendar"]);
    const result = await runNightlyRefresh({ budgetMs: -1 });
    expect(result.people).toBe(0);
    expect(result.waiting).toBeGreaterThanOrEqual(2);
  });

  it("requires the cron secret when one is set", async () => {
    process.env.CRON_SECRET = "night-secret";
    try {
      expect((await GET(new Request("http://x/api/cron/refresh"))).status).toBe(401);
      const ok = await GET(new Request("http://x/api/cron/refresh", { headers: { authorization: "Bearer night-secret" } }));
      expect(ok.status).toBe(200);
      expect(Object.keys(await ok.json()).sort()).toEqual(["failed", "people", "refreshed", "waiting"]);
    } finally {
      delete process.env.CRON_SECRET;
    }
  });
});
