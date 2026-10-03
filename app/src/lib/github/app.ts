import { createPrivateKey, createSign, randomBytes } from "node:crypto";

/**
 * LifePark's GitHub App. People install it on their GitHub account and choose
 * which repositories it may read; it asks GitHub only for read-only access.
 * Everything here runs on the server.
 */

type Json = Record<string, unknown>;

export class GitHubAccessError extends Error {}

/** The app's settings, or null when GitHub isn't set up on this site. */
export function githubConfig() {
  const slug = process.env.GITHUB_APP_SLUG;
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  const privateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!slug || !clientId || !clientSecret || !privateKey) return null;
  // Hosting dashboards often store the key's line breaks as "\n".
  return { slug, clientId, clientSecret, privateKey: privateKey.replace(/\\n/g, "\n") };
}

export const githubAvailable = () => githubConfig() !== null;

/** The cookie holding the random value for a GitHub round trip in progress. */
export const STATE_COOKIE = "lifepark-github-state";

/** GitHub's addresses. Browser tests point these at a local stand-in. */
const apiBase = () => process.env.GITHUB_API_BASE || "https://api.github.com";
const webBase = () => process.env.GITHUB_WEB_BASE || "https://github.com";

const headers = (token: string) => ({
  accept: "application/vnd.github+json",
  authorization: `Bearer ${token}`,
  "x-github-api-version": "2022-11-28",
  "user-agent": "LifePark",
});

async function getJson(url: string, token: string, init?: RequestInit): Promise<Json> {
  const res = await fetch(url, { ...init, headers: { ...headers(token), ...(init?.headers ?? {}) } });
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    throw new GitHubAccessError("GitHub didn't allow access. Try connecting again.");
  }
  if (!res.ok) throw new Error(`GitHub answered ${res.status}.`);
  return (await res.json()) as Json;
}

const b64url = (s: string | Buffer) => Buffer.from(s).toString("base64url");

/** A short-lived token that proves a request comes from the app itself (RS256, up to 10 minutes). */
export function appJwt(now = Date.now()) {
  const config = githubConfig();
  if (!config) throw new GitHubAccessError("GitHub isn't set up on this site.");
  const iat = Math.floor(now / 1000) - 60; // a minute back, for clock drift
  const body = `${b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }))}.${b64url(JSON.stringify({ iat, exp: iat + 9 * 60, iss: config.clientId }))}`;
  const signature = createSign("RSA-SHA256").update(body).sign(createPrivateKey(config.privateKey));
  return `${body}.${b64url(signature)}`;
}

/** A random value tying a GitHub round trip to the browser that started it. */
export const newState = () => randomBytes(24).toString("base64url");

/** Where to send someone to allow LifePark to see which installations are theirs. */
export function authorizeUrl(state: string, redirectUri: string) {
  const config = githubConfig()!;
  const params = new URLSearchParams({ client_id: config.clientId, redirect_uri: redirectUri, state });
  return `${webBase()}/login/oauth/authorize?${params}`;
}

/** Where to send someone to install the app and pick repositories. */
export const installUrl = () => `${webBase()}/apps/${githubConfig()!.slug}/installations/new`;

/** Trades the code from GitHub's redirect for a token acting as that person. */
export async function exchangeCode(code: string, redirectUri: string) {
  const config = githubConfig()!;
  const res = await fetch(`${webBase()}/login/oauth/access_token`, {
    method: "POST",
    headers: { accept: "application/json", "content-type": "application/json", "user-agent": "LifePark" },
    body: JSON.stringify({ client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: redirectUri }),
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  if (!res.ok || typeof data.access_token !== "string") throw new GitHubAccessError("GitHub didn't confirm the sign-in. Try again.");
  return data.access_token;
}

/**
 * The installations of LifePark's app that this person can reach. This is how
 * an installation is confirmed to be theirs: an installation id in a URL alone
 * could be made up.
 */
export async function userInstallations(userToken: string) {
  const out: { id: string; login: string }[] = [];
  for (let page = 1; page <= 10; page++) {
    const data = await getJson(`${apiBase()}/user/installations?per_page=100&page=${page}`, userToken);
    const list = Array.isArray(data.installations) ? (data.installations as Json[]) : [];
    for (const i of list) {
      const account = (i.account ?? {}) as Json;
      if (i.id !== undefined) out.push({ id: String(i.id), login: typeof account.login === "string" ? account.login : "GitHub" });
    }
    if (list.length < 100) break;
  }
  return out;
}

/** A token for reading one installation's repositories. */
export async function installationToken(installationId: string) {
  const data = await getJson(`${apiBase()}/app/installations/${encodeURIComponent(installationId)}/access_tokens`, appJwt(), { method: "POST" });
  if (typeof data.token !== "string") throw new Error("GitHub sent no installation token.");
  return data.token;
}

/** Every repository one installation may read. */
export async function installationRepos(installationId: string) {
  const token = await installationToken(installationId);
  const repos: Json[] = [];
  for (let page = 1; page <= 20; page++) {
    const data = await getJson(`${apiBase()}/installation/repositories?per_page=100&page=${page}`, token);
    const list = Array.isArray(data.repositories) ? (data.repositories as Json[]) : [];
    repos.push(...list);
    if (list.length < 100) break;
  }
  return repos;
}
