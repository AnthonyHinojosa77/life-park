// @vitest-environment node
import { generateKeyPairSync } from "node:crypto";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createMockGitHub } from "../../../e2e/mock-github.mjs";

process.env.PGLITE_DIR = "memory";
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
process.env.GITHUB_APP_SLUG = "lifepark-test";
process.env.GITHUB_APP_CLIENT_ID = "test-github-client";
process.env.GITHUB_APP_CLIENT_SECRET = "test-github-secret";
// Stored the way hosting dashboards often keep it: line breaks as "\n".
process.env.GITHUB_APP_PRIVATE_KEY = privateKey.export({ type: "pkcs1", format: "pem" }).toString().replace(/\n/g, "\\n");

const { db } = await import("../db");
const { runMigrations } = await import("../db/migrate");
const { auth } = await import("../auth");
const { countByKind, listConnections, listParkThings } = await import("../things");
const { appJwt, exchangeCode, userInstallations } = await import("./app");
const { disconnectGitHub, importGitHub, repoThing, saveInstallations } = await import("./import");
const { connectedServices, servicesDue } = await import("../refresh");
const { groupThings } = await import("../park/groups");

const server = createMockGitHub({ publicKey: publicKey.export({ type: "spki", format: "pem" }).toString() });

async function newUser(email: string) {
  const res = await auth.api.signUpEmail({ body: { name: "Anthony", email, password: "a-long-enough-password" } });
  return res.user.id;
}

describe("github", () => {
  beforeAll(async () => {
    await runMigrations(db);
    await new Promise<void>((r) => server.listen(0, r));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    process.env.GITHUB_API_BASE = base;
    process.env.GITHUB_WEB_BASE = base;
  });
  afterAll(() => {
    server.close();
    delete process.env.GITHUB_API_BASE;
    delete process.env.GITHUB_WEB_BASE;
  });

  it("signs a short-lived app token GitHub accepts", () => {
    const [head, claims] = appJwt(Date.parse("2026-10-03T00:00:00Z")).split(".");
    expect(JSON.parse(Buffer.from(head, "base64url").toString())).toEqual({ alg: "RS256", typ: "JWT" });
    const c = JSON.parse(Buffer.from(claims, "base64url").toString());
    expect(c.iss).toBe("test-github-client");
    expect(c.iat).toBe(Date.parse("2026-10-03T00:00:00Z") / 1000 - 60);
    expect(c.exp - c.iat).toBeLessThanOrEqual(600);
  });

  it("confirms installations through the person's own sign-in", async () => {
    const token = await exchangeCode("mock-code", "http://x/api/github/callback");
    expect(await userInstallations(token)).toEqual([{ id: "42", login: "anthony" }]);
    await expect(exchangeCode("made-up", "http://x")).rejects.toThrow();
  });

  it("turns a repository into a thing for the Workshop", () => {
    const t = repoThing({ id: 9, full_name: "a/b", language: "Go", private: true, pushed_at: "2026-01-02T00:00:00Z", stargazers_count: 4, html_url: "https://github.com/a/b", owner: { login: "a" } });
    expect(t).toMatchObject({ sourceId: "9", kind: "repo", title: "a/b", detail: { language: "Go", private: true, stars: 4, archived: false, link: "https://github.com/a/b" } });
    expect(repoThing({ name: "no id" })).toBeNull();
  });

  it("fills the Workshop, keeps it current, and empties it on disconnect", async () => {
    const userId = await newUser("gh@example.com");
    expect(await connectedServices(userId)).toEqual([]);
    await saveInstallations(userId, [{ id: "42", login: "anthony" }]);
    expect(await connectedServices(userId)).toEqual(["github"]);
    expect((await servicesDue(userId, new Date(), 1000)).fresh).toEqual(["github"]);

    const first = await importGitHub(userId);
    expect(first).toEqual({ service: "github", count: 3 });
    const park = await listParkThings(userId);
    expect(countByKind(park).repo).toBe(3);
    const groups = groupThings("repo", park.filter((t) => t.kind === "repo"), Date.now());
    expect(groups.map((g) => [g.name, g.things.length])).toEqual([["Python", 1], ["TypeScript", 1], ["Archived", 1]]);

    // A second import updates in place.
    await importGitHub(userId);
    expect(countByKind(await listParkThings(userId)).repo).toBe(3);
    expect((await listConnections(userId)).find((c) => c.service === "github")).toMatchObject({ status: "connected", itemCount: 3 });

    await disconnectGitHub(userId);
    expect(countByKind(await listParkThings(userId)).repo).toBe(0);
    expect(await connectedServices(userId)).toEqual([]);
  });

  it("forgets an installation that was removed on GitHub", async () => {
    const userId = await newUser("gone@example.com");
    await saveInstallations(userId, [{ id: "999", login: "someone" }]);
    const result = await importGitHub(userId);
    expect(result.error).toMatch(/isn't installed/);
    expect(await connectedServices(userId)).toEqual([]);
  });
});
