// Sign in with ChatGPT end to end, against a stand-in OpenAI that enforces
// OpenAI's website guide: a new person signs up with ChatGPT, comes back, and
// forged or tampered sign-ins are refused. Someone who already has an account
// with that email is sent to add ChatGPT from Settings instead. Then the same
// with a confidential client, and an OpenAI that never answers, which must not
// stop anyone signing in with a password.
// Starts its own server (from an existing `next build`).
// Usage: node e2e/chatgpt-flow.mjs <screenshotDir>
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { chromium } from "playwright";
import { createMockOpenAI } from "./mock-openai.mjs";
import { submitAndWaitFor } from "./helpers.mjs";

const [dir = "."] = process.argv.slice(2);
const port = 3133;
const base = `http://localhost:${port}`;
const issuer = "http://127.0.0.1:3132";
const clientId = "oaiapp_lifepark_test";
const dataDir = mkdtempSync(path.join(os.tmpdir(), "lifepark-chatgpt-"));
const password = "a-long-enough-password";
const emailPerson = `lee+${Date.now()}@example.com`;

function check(ok, message) {
  if (!ok) throw new Error(message);
}

const openai = createMockOpenAI({ base: issuer, clientId, redirectUri: `${base}/api/auth/callback/chatgpt` });
await new Promise((r) => openai.listen(3132, r));
// An OpenAI that takes the connection and never answers.
const silent = http.createServer(() => {});
await new Promise((r) => silent.listen(3134, r));

function startServer(env = {}) {
  const server = spawn("npx", ["next", "start", "-p", String(port)], {
    detached: true,
    env: {
      ...process.env,
      PGLITE_DIR: dataDir,
      BETTER_AUTH_URL: base,
      BETTER_AUTH_SECRET: "chatgpt-flow-test-secret-chatgpt-flow-test",
      CHATGPT_CLIENT_ID: clientId,
      CHATGPT_ISSUER: issuer,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.log = "";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server did not start.")), 30000);
    server.stdout.on("data", (d) => {
      server.log += d;
      if (String(d).includes("Ready")) {
        clearTimeout(timer);
        resolve(server);
      }
    });
    server.stderr.on("data", (d) => (server.log += d));
    server.once("exit", (code) => {
      clearTimeout(timer);
      reject(new Error(`Server exited early (${code}).`));
    });
  });
}

async function stopServer(server) {
  const done = new Promise((r) => server.once("exit", r));
  process.kill(-server.pid, "SIGTERM");
  await done;
  for (let i = 0; i < 50; i++) {
    const busy = await fetch(base).then(() => true, () => false);
    if (!busy) return;
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error("Server did not stop.");
}

let server = await startServer();
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
// Less motion skips the intro, so each visit to sign-in is ready at once.
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, reducedMotion: "reduce" });
const page = await context.newPage();
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(`${page.url()}: ${e.message}`));

const chatgptButton = () => page.getByRole("button", { name: "Continue with ChatGPT" });
/**
 * Taps Continue with ChatGPT and waits to leave the page. Sign-in allows three
 * tries per connection every 10 seconds, and this script signs in a lot, so a
 * "Too many tries" notice means wait and tap again.
 */
async function continueWithChatGPT() {
  for (let i = 0; i < 3; i++) {
    const from = page.url();
    await chatgptButton().click();
    const outcome = await Promise.race([
      page.waitForURL((u) => u.href !== from, { timeout: 20000 }).then(() => "left", () => "timeout"),
      page.getByText("Too many tries in a row").waitFor({ timeout: 20000 }).then(() => "limited", () => "timeout"),
    ]);
    if (outcome === "left") return;
    if (outcome === "timeout") throw new Error("Continue with ChatGPT went nowhere.");
    await page.waitForTimeout(11000);
  }
  throw new Error("Still rate limited after three tries.");
}
async function signOut() {
  await page.goto(base + "/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Sign out" }).click();
  await page.waitForURL("**/sign-in");
}
async function signedOut() {
  await page.goto(base + "/chats", { waitUntil: "networkidle" });
  return page.url().endsWith("/sign-in");
}
async function finishOnboarding() {
  await page.getByRole("button", { name: "Let's build your park" }).click();
  await page.getByRole("button", { name: "See my park" }).click();
  await page.waitForURL("**/park");
}

try {
  // The button sits with the other ways to sign in, drawn in once the intro ends.
  const intro = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  await intro.goto(base + "/sign-in", { waitUntil: "domcontentloaded" });
  await intro.locator('[data-intro="done"]').waitFor({ state: "attached", timeout: 20000 });
  await intro.getByRole("button", { name: "Continue with ChatGPT" }).waitFor();
  await intro.screenshot({ path: `${dir}/chatgpt-1-sign-in.png` });
  await intro.close();

  // A new person: one tap, OpenAI says who they are, and they land in onboarding.
  await page.goto(base + "/sign-in", { waitUntil: "networkidle" });
  await continueWithChatGPT();
  await page.waitForURL("**/onboarding", { timeout: 20000 });
  await page.getByRole("heading", { level: 1 }).waitFor();
  await page.screenshot({ path: `${dir}/chatgpt-2-onboarding.png` });
  check(openai.problems.length === 0, `stand-in OpenAI refused LifePark: ${openai.problems.join("; ")}`);
  const asked = openai.authorizeRequests.at(-1);
  check(asked.nonce && asked.state && asked.code_challenge, "sign-in did not send state, PKCE, and a nonce");
  const exchange = openai.tokenRequests.at(-1);
  check(!exchange.basic && !exchange.form.client_secret, "a public client sent a secret");
  await finishOnboarding();

  // Coming back: the same ChatGPT account opens the same LifePark account.
  await signOut();
  await continueWithChatGPT();
  await page.waitForURL("**/chats", { timeout: 20000 });
  await page.goto(base + "/settings", { waitUntil: "networkidle" });
  await page.getByText(`Signed in as ${openai.identity.email}.`).waitFor();
  await page.getByText("You can also sign in with ChatGPT.").waitFor();
  check(asked.nonce !== openai.authorizeRequests.at(-1).nonce, "the nonce was reused");
  check(asked.state !== openai.authorizeRequests.at(-1).state, "the state was reused");
  await signOut();

  // Anything tampered with is refused, and nobody is signed in.
  for (const [mode, words] of [
    ["bad-nonce", "didn't go through"],
    ["bad-audience", "didn't go through"],
    ["bad-signature", "didn't go through"],
    ["deny", "Sign-in was cancelled"],
  ]) {
    openai.mode = mode;
    await continueWithChatGPT();
    await page.waitForURL(/\/sign-in\?error=/, { timeout: 20000 });
    await page.getByRole("alert").filter({ hasText: words }).waitFor();
    check(await signedOut(), `signed in despite ${mode}`);
  }
  openai.mode = "ok";
  await page.goto(base + "/sign-in?error=access_denied", { waitUntil: "networkidle" });
  await page.screenshot({ path: `${dir}/chatgpt-3-cancelled.png` });

  // A callback LifePark never started is refused.
  await page.goto(`${base}/api/auth/callback/chatgpt?code=forged&state=forged`, { waitUntil: "networkidle" });
  check(await signedOut(), "a forged callback signed someone in");

  // Someone with a password account and the same email isn't merged silently.
  await page.goto(base + "/sign-up", { waitUntil: "networkidle" });
  await page.getByLabel("Name").fill("Lee");
  await page.getByLabel("Email").fill(emailPerson);
  await page.getByLabel("Password").fill(password);
  await submitAndWaitFor(page, "Create account", "**/onboarding");
  await finishOnboarding();
  await signOut();
  openai.identity = { sub: "user-chatgpt-2", email: emailPerson, name: "Lee on ChatGPT" };
  await continueWithChatGPT();
  await page.waitForURL(/\/sign-in\?error=account_not_linked/, { timeout: 20000 });
  await page.getByRole("alert").filter({ hasText: "already has a LifePark account" }).waitFor();
  await page.screenshot({ path: `${dir}/chatgpt-4-already-have-account.png` });

  // They sign in the old way and add ChatGPT from Settings, then it works.
  await page.getByLabel("Email").fill(emailPerson);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/chats");
  await page.goto(base + "/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Add ChatGPT sign-in" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${dir}/chatgpt-5-settings.png` });
  await page.getByRole("button", { name: "Add ChatGPT sign-in" }).click();
  await page.waitForURL("**/settings?chatgpt=added", { timeout: 20000 });
  await page.getByText("ChatGPT added.").waitFor();
  await signOut();
  await continueWithChatGPT();
  await page.waitForURL("**/chats", { timeout: 20000 });
  await page.goto(base + "/settings", { waitUntil: "networkidle" });
  await page.getByText(`Signed in as ${emailPerson}.`).waitFor();
  await signOut();

  // A ChatGPT account already used by someone else can't be added to a second account.
  await page.getByLabel("Email").fill(emailPerson);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/chats");
  openai.identity = { sub: "user-chatgpt-1", email: "chatgpt-person@example.com", name: "Casey ChatGPT" };
  // Lee already has ChatGPT, so Settings has no Add button; ask the server directly.
  const linkTry = await page.evaluate(async () => {
    const res = await fetch("/api/auth/link-social", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider: "chatgpt", callbackURL: "/settings?chatgpt=added", errorCallbackURL: "/settings?chatgpt=failed" }),
    });
    return (await res.json()).url;
  });
  await page.goto(linkTry, { waitUntil: "networkidle" });
  check(page.url().includes("chatgpt=failed"), `a second account took over a ChatGPT sign-in: ${page.url()}`);
  await page.getByText("ChatGPT wasn't added.").waitFor();
  await signOut();
  check(openai.problems.length === 0, `stand-in OpenAI refused LifePark: ${openai.problems.join("; ")}`);
  if (pageErrors.length) throw new Error(`page errors:\n${pageErrors.join("\n")}`);

  // A confidential client sends its secret in the Basic header only.
  await stopServer(server);
  openai.clientSecret = "shh-test-secret";
  server = await startServer({ CHATGPT_CLIENT_SECRET: "shh-test-secret" });
  await page.goto(base + "/sign-in", { waitUntil: "networkidle" });
  await continueWithChatGPT();
  await page.waitForURL("**/chats", { timeout: 20000 });
  check(openai.tokenRequests.at(-1).basic && !openai.tokenRequests.at(-1).form.client_secret, "secret not sent in the Basic header");
  await signOut();
  // OpenAI refuses a wrong secret, and LifePark says so instead of signing in.
  openai.clientSecret = "rotated-secret";
  await continueWithChatGPT();
  await page.waitForURL(/\/sign-in\?error=/, { timeout: 20000 });
  check(await signedOut(), "signed in with a rejected client secret");
  openai.problems.length = 0;
  await stopServer(server);

  // OpenAI never answers: passwords still work, and the ChatGPT button says it's unavailable.
  server = await startServer({ CHATGPT_ISSUER: "http://127.0.0.1:3134" });
  await page.goto(base + "/sign-in", { waitUntil: "networkidle", timeout: 30000 });
  await page.getByLabel("Email").fill(emailPerson);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/chats", { timeout: 20000 });
  await signOut();
  await chatgptButton().click();
  await page.getByRole("alert").filter({ hasText: "Couldn't reach ChatGPT" }).waitFor();
  check(server.log.includes("Sign in with ChatGPT is off until the next restart"), "no log line about ChatGPT being off");
  await stopServer(server);
  server = null;

  // LifePark keeps who someone is on ChatGPT, not OpenAI's tokens.
  const pg = new PGlite({ dataDir });
  const { rows } = await pg.query(
    `select a.issuer, a.account_id, a.id_token, a.access_token, a.refresh_token, u.email
       from account a join "user" u on u.id = a.user_id where a.provider_id = 'chatgpt' order by u.email`,
  );
  await pg.close();
  check(rows.length === 2, `expected two ChatGPT sign-ins, found ${rows.length}`);
  for (const row of rows) {
    check(row.issuer === issuer, `issuer saved as ${row.issuer}`);
    check(!row.id_token && !row.access_token && !row.refresh_token, `OpenAI tokens were kept for ${row.email}`);
  }
  check(rows.some((r) => r.account_id === "user-chatgpt-1" && r.email === "chatgpt-person@example.com"), "new ChatGPT person missing");
  check(rows.some((r) => r.account_id === "user-chatgpt-2" && r.email === emailPerson), "added ChatGPT sign-in missing");
} catch (e) {
  console.error(`failed at ${page.url()}`);
  if (openai.problems.length) console.error(`stand-in OpenAI problems: ${openai.problems.join("; ")}`);
  if (server) console.error(`server log:\n${server.log.slice(-3000)}`);
  throw e;
} finally {
  await browser.close();
  if (server) await stopServer(server).catch(() => {});
  openai.close();
  silent.closeAllConnections?.();
  silent.close();
}
console.log("sign in with ChatGPT flow ok");
