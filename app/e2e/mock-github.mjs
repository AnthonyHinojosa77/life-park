// A stand-in for the parts of GitHub LifePark uses, for tests: the sign-in
// round trip, the installations a person can reach, installation tokens (only
// for a correctly signed app token), and the repositories an installation reads.
// Usage: import { createMockGitHub } from "./mock-github.mjs"
import http from "node:http";
import { createVerify } from "node:crypto";

const repos = [
  { id: 1, name: "life-park", full_name: "anthony/life-park", private: true, language: "TypeScript", pushed_at: "2026-09-30T12:00:00Z", stargazers_count: 3, html_url: "https://github.com/anthony/life-park", owner: { login: "anthony" }, description: "My park" },
  { id: 2, name: "notes", full_name: "anthony/notes", private: false, language: "Python", pushed_at: "2026-08-01T12:00:00Z", stargazers_count: 0, html_url: "https://github.com/anthony/notes", owner: { login: "anthony" } },
  { id: 3, name: "old-site", full_name: "anthony/old-site", private: false, language: "HTML", archived: true, pushed_at: "2024-01-01T12:00:00Z", stargazers_count: 1, html_url: "https://github.com/anthony/old-site", owner: { login: "anthony" } },
];

/**
 * `publicKey` checks the app's signed tokens; `installed` says whether the person has installed the app yet.
 * @param {{ publicKey?: string, clientId?: string, installed?: boolean }} [options]
 */
export function createMockGitHub({ publicKey, clientId = "test-github-client", installed = true } = {}) {
  const state = { installed };
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? "/", "http://mock");
    const auth = req.headers.authorization ?? "";
    const json = (status, body) => res.writeHead(status, { "content-type": "application/json" }).end(JSON.stringify(body));
    let body = "";
    for await (const chunk of req) body += chunk;

    if (url.pathname === "/login/oauth/authorize") {
      // GitHub sends the person straight back with a code, keeping the state.
      const back = new URL(url.searchParams.get("redirect_uri"));
      back.searchParams.set("code", "mock-code");
      back.searchParams.set("state", url.searchParams.get("state") ?? "");
      return res.writeHead(302, { location: back.toString() }).end();
    }
    if (url.pathname === "/login/oauth/access_token" && req.method === "POST") {
      const sent = JSON.parse(body || "{}");
      if (sent.code !== "mock-code" || sent.client_id !== clientId) return json(200, { error: "bad_verification_code" });
      return json(200, { access_token: "mock-user-token", token_type: "bearer" });
    }
    if (url.pathname === "/apps/lifepark-test/installations/new") {
      // Installing sends the person to the app's setup address, which is /api/github/connect.
      state.installed = true;
      return res.writeHead(302, { location: `${server.appBase}/api/github/connect` }).end();
    }
    if (url.pathname === "/user/installations") {
      if (auth !== "Bearer mock-user-token") return json(401, {});
      return json(200, { total_count: state.installed ? 1 : 0, installations: state.installed ? [{ id: 42, account: { login: "anthony" } }] : [] });
    }
    const tokenFor = url.pathname.match(/^\/app\/installations\/(\d+)\/access_tokens$/);
    if (tokenFor && req.method === "POST") {
      const jwt = auth.replace(/^Bearer /, "");
      const [head, claims, sig] = jwt.split(".");
      const ok = head && claims && sig && publicKey && createVerify("RSA-SHA256").update(`${head}.${claims}`).verify(publicKey, Buffer.from(sig, "base64url"));
      const c = ok ? JSON.parse(Buffer.from(claims, "base64url").toString()) : null;
      if (!c || c.iss !== clientId || c.exp - c.iat > 600) return json(401, {});
      if (tokenFor[1] !== "42" || !state.installed) return json(404, {});
      return json(201, { token: "mock-installation-token", expires_at: new Date(Date.now() + 3600_000).toISOString() });
    }
    if (url.pathname === "/installation/repositories") {
      if (auth !== "Bearer mock-installation-token") return json(401, {});
      return json(200, { total_count: repos.length, repositories: repos });
    }
    json(404, {});
  });
  server.state = state;
  return server;
}
