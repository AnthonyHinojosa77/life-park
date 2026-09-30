// Pictures of a full park, for judging how it looks: a stand-in Google with
// hundreds of neighbors, events, letters, and files fills a fresh account's
// park, then the whole park and every lawn are photographed at phone size.
// Usage: node e2e/park-shots.mjs <screenshotDir>
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { chromium } from "playwright";
import { createMockGoogle } from "./mock-google.mjs";
import { submitAndWaitFor } from "./helpers.mjs";

const [dir = "."] = process.argv.slice(2);
const port = 3131;
const base = `http://localhost:${port}`;
const email = `shots+${Date.now()}@example.com`;
const dataDir = mkdtempSync(path.join(os.tmpdir(), "lifepark-shots-"));

const google = createMockGoogle("big");
await new Promise((r) => google.listen(3127, r));
const openrouter = spawn("node", ["e2e/mock-openrouter.mjs", "3128"], { stdio: "ignore" });

function startServer() {
  const server = spawn("npx", ["next", "start", "-p", String(port)], {
    detached: true,
    env: {
      ...process.env,
      PGLITE_DIR: dataDir,
      BETTER_AUTH_URL: base,
      BETTER_AUTH_SECRET: "park-shots-secret-park-shots-secret-secret",
      GOOGLE_CLIENT_ID: "stand-in-client",
      GOOGLE_CLIENT_SECRET: "stand-in-secret",
      GOOGLE_API_BASE: "http://127.0.0.1:3127",
      OPENROUTER_API_KEY: "stand-in",
      OPENROUTER_BASE_URL: "http://127.0.0.1:3128/api/v1",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Server did not start.")), 30000);
    server.stdout.on("data", (d) => {
      if (String(d).includes("Ready")) {
        clearTimeout(timer);
        resolve(server);
      }
    });
    server.stderr.on("data", (d) => process.stderr.write(d));
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
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

try {
  await page.goto(base + "/sign-up", { waitUntil: "networkidle" });
  await page.getByLabel("Name").fill("Anthony");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-enough-password");
  await submitAndWaitFor(page, "Create account", "**/onboarding");
  // Through the welcome and the connect step, which marks onboarding done; Google itself is stood in for.
  await page.getByRole("button", { name: "Let's build your park" }).click();
  await page.route("https://accounts.google.com/**", (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>Google stand-in</p>" }));
  await page.getByRole("button", { name: "Connect Google" }).click();
  await page.getByText("Google stand-in").waitFor({ timeout: 15000 });

  await stopServer(server);
  const pg = new PGlite({ dataDir });
  const { rows } = await pg.query(`select id from "user" where email = $1`, [email]);
  const scope = [
    "openid",
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/contacts.readonly",
    "https://www.googleapis.com/auth/tasks.readonly",
    "https://www.googleapis.com/auth/gmail.metadata",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
    "https://www.googleapis.com/auth/documents.readonly",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
  ].join(",");
  await pg.query(
    `insert into account (id, issuer, account_id, provider_id, user_id, access_token, access_token_expires_at, scope, created_at, updated_at)
     values ($1, 'https://accounts.google.com', 'google-sub-1', 'google', $2, 'mock-google-token', now() + interval '1 hour', $3, now(), now())`,
    [crypto.randomUUID(), rows[0].id, scope],
  );
  await pg.close();
  server = await startServer();

  await page.goto(base + "/park", { waitUntil: "domcontentloaded" });
  await page.getByText("Your park is ready.").waitFor({ timeout: 120000 });
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.waitForTimeout(1800);
  await page.screenshot({ path: `${dir}/shots-1-first.png` });
  await page.getByRole("button", { name: "Show the whole park" }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/shots-2-whole.png` });
  for (const lawn of ["Neighborhood", "Library", "Post office"]) {
    await page.getByRole("button", { name: `Go to ${lawn}` }).click();
    await page.waitForTimeout(1100);
    await page.screenshot({ path: `${dir}/shots-3-${lawn.toLowerCase().replace(/ /g, "-")}.png` });
  }
  // Open the Neighborhood, then one of its streets.
  await page.getByRole("button", { name: "Go to Neighborhood" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /^Neighborhood: 169 neighbors/ }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${dir}/shots-4-open.png` });
  await page.getByRole("button", { name: /^M–P Street:/ }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${dir}/shots-5-street.png` });
  await page.getByRole("button", { name: "Show the whole park" }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${dir}/shots-6-whole-open.png` });
  await page.getByRole("button", { name: "Go to Library" }).click();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /^Library: 194 files/ }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${dir}/shots-7-library-open.png` });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + "/park", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Show the whole park" }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${dir}/shots-8-laptop.png` });
  await page.getByRole("button", { name: /^Festival board: 81 events/ }).click();
  await page.waitForTimeout(1400);
  await page.screenshot({ path: `${dir}/shots-9-laptop-open.png` });
  if (errors.length) throw new Error(`page errors: ${errors.join(" | ")}`);
  console.log("park shots ok");
} catch (e) {
  await page.screenshot({ path: `${dir}/shots-failed.png` }).catch(() => {});
  throw e;
} finally {
  await browser.close();
  await stopServer(server).catch(() => {});
  openrouter.kill();
  google.close();
}
