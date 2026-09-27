// @vitest-environment node
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockGoogle } from "../../../e2e/mock-google.mjs";

process.env.PGLITE_DIR = "memory";
// Stand-in credentials so the Google provider exists; no real Google call is made.
process.env.GOOGLE_CLIENT_ID = "test-client";
process.env.GOOGLE_CLIENT_SECRET = "test-secret";

const { db } = await import("../db");
const { account } = await import("../db/schema");
const { runMigrations } = await import("../db/migrate");
const { auth } = await import("../auth");
const { countByKind, listConnections, listParkThings } = await import("../things");
const { googleGrants, importGoogleService } = await import("./import");
const { googleServices, scopesFor } = await import("./services");

const server = createMockGoogle();

async function userWithGoogle(email: string, token: string, services: string[]) {
  const res = await auth.api.signUpEmail({ body: { name: "Sam", email, password: "a-long-enough-password" } });
  await db.insert(account).values({
    id: crypto.randomUUID(),
    issuer: "https://accounts.google.com",
    accountId: `g-${email}`,
    providerId: "google",
    userId: res.user.id,
    accessToken: token,
    accessTokenExpiresAt: new Date(Date.now() + 3600_000),
    scope: ["openid", ...scopesFor(services)].join(","),
    updatedAt: new Date(),
  });
  return res.user.id;
}

describe("google import", () => {
  beforeAll(async () => {
    await runMigrations(db);
    await new Promise<void>((r) => server.listen(0, r));
    process.env.GOOGLE_API_BASE = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => {
    server.close();
    delete process.env.GOOGLE_API_BASE;
  });

  it("fills the park from every service", async () => {
    const all = googleServices.map((s) => s.id);
    const userId = await userWithGoogle("import@example.com", "mock-google-token", all);
    expect(await googleGrants(userId)).toEqual(all);

    const results = await Promise.all(all.map((s) => importGoogleService(userId, s)));
    expect(results.filter((r) => r.error)).toEqual([]);

    const park = await listParkThings(userId);
    const counts = countByKind(park);
    expect(counts.event).toBe(2); // the cancelled one is skipped
    expect(counts.person).toBe(3); // the nameless contact is skipped
    expect(counts.list).toBe(2);
    expect(counts.mail).toBe(2);
    expect(counts.file).toBe(4);

    const sam = park.find((t) => t.title === "Sam Rivera");
    expect(sam?.detail.birthday).toEqual({ month: 11, day: 3, year: null });
    const groceries = park.find((t) => t.title === "Groceries");
    expect((groceries?.detail.items as unknown[]).length).toBe(2);
    const mail = park.find((t) => t.title === "Dinner Friday?");
    expect(mail?.detail.from).toBe("Sam Rivera");
    const doc = park.find((t) => t.title === "Trip ideas");
    expect(doc?.detail.type).toBe("doc");
  });

  it("imports again without duplicating", async () => {
    const userId = await userWithGoogle("again@example.com", "mock-google-token", ["calendar"]);
    await importGoogleService(userId, "calendar");
    await importGoogleService(userId, "calendar");
    expect(countByKind(await listParkThings(userId)).event).toBe(2);
  });

  it("reports a refused token plainly and records it", async () => {
    const userId = await userWithGoogle("revoked@example.com", "revoked-token", ["tasks"]);
    const result = await importGoogleService(userId, "tasks");
    expect(result.error).toMatch(/didn't allow access/);
    const [c] = await listConnections(userId);
    expect(c.status).toBe("error");
  });

  it("asks Google for exactly the chosen services, read-only, with a long-lived key", async () => {
    const signUp = await auth.api.signUpEmail({
      body: { name: "Linker", email: "linker@example.com", password: "a-long-enough-password" },
      asResponse: true,
    });
    const cookie = signUp.headers.get("set-cookie")!;
    const res = await auth.api.linkSocialAccount({
      headers: new Headers({ cookie }),
      body: {
        provider: "google",
        scopes: scopesFor(["calendar", "gmail"]),
        callbackURL: "/park",
        additionalParams: { prompt: "consent", access_type: "offline" },
        disableRedirect: true,
      },
    });
    const url = new URL(res.url);
    expect(url.origin).toBe("https://accounts.google.com");
    const scope = url.searchParams.get("scope")!.split(" ");
    expect(scope).toContain("https://www.googleapis.com/auth/calendar.readonly");
    expect(scope).toContain("https://www.googleapis.com/auth/gmail.metadata");
    expect(scope).not.toContain("https://www.googleapis.com/auth/drive.metadata.readonly");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("include_granted_scopes")).toBe("true");
  });

  it("knows when no Google account is linked", async () => {
    const res = await auth.api.signUpEmail({
      body: { name: "Apple person", email: "nogoogle@example.com", password: "a-long-enough-password" },
    });
    expect(await googleGrants(res.user.id)).toBeNull();
    const result = await importGoogleService(res.user.id, "calendar");
    expect(result.error).toBe("Google isn't connected.");
  });
});
