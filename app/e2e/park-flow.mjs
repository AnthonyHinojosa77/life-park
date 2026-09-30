// The park end to end: welcome, the Google permission request, chat filing
// something into the park, and a connected Google account filling the park.
// Starts its own server (from an existing `next build`), a stand-in Google, and
// a stand-in OpenRouter, because it restarts the server midway to link Google.
// Usage: node e2e/park-flow.mjs <screenshotDir>
import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { chromium } from "playwright";
import { createMockGoogle } from "./mock-google.mjs";
import { submitAndWaitFor } from "./helpers.mjs";

const [dir = "."] = process.argv.slice(2);
const port = 3130;
const base = `http://localhost:${port}`;
const email = `park+${Date.now()}@example.com`;
const dataDir = mkdtempSync(path.join(os.tmpdir(), "lifepark-park-"));

function check(ok, message) {
  if (!ok) throw new Error(message);
}

const google = createMockGoogle();
await new Promise((r) => google.listen(3125, r));
const openrouter = spawn("node", ["e2e/mock-openrouter.mjs", "3126"], { stdio: "ignore" });

function startServer() {
  // Its own process group, so stopping it also stops the server npx starts underneath.
  const server = spawn("npx", ["next", "start", "-p", String(port)], {
    detached: true,
    env: {
      ...process.env,
      PGLITE_DIR: dataDir,
      BETTER_AUTH_URL: base,
      BETTER_AUTH_SECRET: "park-flow-test-secret-park-flow-test-secret",
      GOOGLE_CLIENT_ID: "stand-in-client",
      GOOGLE_CLIENT_SECRET: "stand-in-secret",
      GOOGLE_API_BASE: "http://127.0.0.1:3125",
      OPENROUTER_API_KEY: "stand-in",
      OPENROUTER_BASE_URL: "http://127.0.0.1:3126/api/v1",
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
  // Wait until the port is free again before the next start.
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
async function flyTo(lawnName) {
  await page.getByRole("button", { name: `Go to ${lawnName}` }).click();
  await page.getByRole("button", { name: `Go to ${lawnName}` }).and(page.locator('[aria-current="location"]')).waitFor();
  await page.waitForTimeout(900); // let the glide settle
}

// Any script error or server/phone mismatch on the page fails the test.
const pageErrors = [];
page.on("pageerror", (e) => pageErrors.push(`${page.url()}: ${e.message} ${(e.stack ?? "").split("\n").slice(1, 3).join(" ")}`));
page.on("console", (m) => {
  if (m.type() === "error" && /hydrat|did not match/i.test(m.text())) pageErrors.push(m.text());
});

try {
  // Sign up and read the welcome.
  await page.goto(base + "/sign-up", { waitUntil: "networkidle" });
  await page.getByLabel("Name").fill("Anthony");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("a-long-enough-password");
  await submitAndWaitFor(page, "Create account", "**/onboarding");
  await page.getByText("Watch your park grow").waitFor();
  await page.screenshot({ path: `${dir}/park-1-welcome.png` });
  await page.getByRole("button", { name: "Let's build your park" }).click();

  // The connect step lists every Google service, all chosen to start.
  const boxes = page.getByRole("checkbox");
  check((await boxes.count()) === 7, "expected seven Google services");
  for (const label of ["Google Calendar", "Google Contacts", "Google Tasks", "Gmail", "My Drive", "Google Docs", "Google Sheets"]) {
    await page.getByRole("checkbox", { name: new RegExp(label) }).waitFor();
  }
  await page.screenshot({ path: `${dir}/park-2-connect.png`, fullPage: true });

  // Connecting sends the person to Google, asking read-only for each chosen service.
  let googleUrl = null;
  await page.route("https://accounts.google.com/**", (route) => {
    googleUrl = new URL(route.request().url());
    return route.fulfill({ status: 200, contentType: "text/html", body: "<p>Google stand-in</p>" });
  });
  await page.getByRole("checkbox", { name: /Google Sheets/ }).click();
  await page.getByRole("button", { name: "Connect Google" }).click();
  await page.getByText("Google stand-in").waitFor({ timeout: 15000 });
  const scopes = googleUrl.searchParams.get("scope").split(" ");
  check(scopes.includes("https://www.googleapis.com/auth/calendar.readonly"), "calendar scope missing");
  check(scopes.includes("https://www.googleapis.com/auth/gmail.metadata"), "gmail scope missing");
  check(!scopes.includes("https://www.googleapis.com/auth/spreadsheets.readonly"), "unticked Sheets was still requested");
  check(scopes.every((s) => !s.includes("auth/") || s.endsWith("readonly") || s.endsWith("metadata")), "a scope is not read-only");
  check(googleUrl.searchParams.get("access_type") === "offline", "no long-lived access requested");

  // Coming back without allowing access still lands on the park, now empty with signs.
  await page.goto(base + "/park?connect=failed", { waitUntil: "networkidle" });
  await page.getByText("Google didn't connect").waitFor();
  await page.getByText(/^0 of 8 lawns growing/).waitFor();
  await page.getByRole("button", { name: /Neighborhood: Who's in your life/ }).waitFor();
  await page.getByRole("button", { name: "Connect Google" }).waitFor();
  await page.screenshot({ path: `${dir}/park-3-empty.png`, fullPage: true });

  // An empty area's sign opens a chat with a starter sentence typed in.
  await page.getByRole("button", { name: "Go to Orchard" }).click();
  await page.getByRole("button", { name: "Go to Orchard" }).and(page.locator('[aria-current="location"]')).waitFor();
  await page.getByRole("button", { name: /Orchard: Grow a recipe/ }).click();
  await page.waitForURL(/\/chats\/[0-9a-f-]{36}\?prompt=/);
  check((await page.getByLabel("Message").inputValue()) === "Here's a recipe I love: ", "starter sentence missing");

  // Telling the assistant something files it into the park.
  await page.getByLabel("Message").fill("Remember: Grandma's chili");
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByText("Saved it to your park.").waitFor({ timeout: 20000 });
  await page.getByRole("link", { name: "Added to your park: Grandma's chili" }).waitFor();
  await page.screenshot({ path: `${dir}/park-4-chat-saved.png` });
  await page.getByRole("link", { name: "Added to your park: Grandma's chili" }).click();
  await page.waitForURL("**/park");
  await page.getByText(/^1 of 8 lawns growing/).waitFor();
  // The park opens on the first lawn with something on it.
  await page.getByRole("button", { name: "Go to Orchard" }).and(page.locator('[aria-current="location"]')).waitFor();
  await page.getByRole("button", { name: /Orchard: 1 recipe/ }).click();
  await page.getByRole("region", { name: "Orchard" }).getByRole("button", { name: /^Mains 1$/ }).waitFor();
  await page.getByRole("button", { name: "Grandma's chili, recipe" }).waitFor();

  // Link a Google account the way a finished Google sign-in would, then reopen the park.
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

  // The park brings everything in on its own and fills up as it goes.
  await page.goto(base + "/park", { waitUntil: "domcontentloaded" });
  await page.getByText("Building your park").waitFor();
  await page.getByText("Your park is ready.").waitFor({ timeout: 60000 });
  for (const line of [
    "✓ Google Calendar: 2 added",
    "✓ Google Contacts: 3 added",
    "✓ Google Tasks: 2 added",
    "✓ Gmail: 2 added",
    "✓ My Drive: 2 added",
    "✓ Google Docs: 1 added",
    "✓ Google Sheets: 1 added",
  ]) {
    await page.getByText(line).waitFor();
  }
  await page.getByText(/^6 of 8 lawns growing/).waitFor();
  await page.getByRole("button", { name: "Dismiss" }).click();
  await page.waitForTimeout(1500); // let the sprouting finish before the picture
  await page.screenshot({ path: `${dir}/park-5-filled.png`, fullPage: true });

  // Every lawn is one landmark until it is tapped; then its categories open, then a category's things.
  await flyTo("Neighborhood");
  await page.screenshot({ path: `${dir}/park-5b-neighborhood.png` });
  check((await page.locator('[data-zone="person"] [data-plot]').count()) === 0, "categories showed before the lawn was opened");
  await page.getByRole("button", { name: /Neighborhood: 3 neighbors/ }).click();
  const hood = page.getByRole("region", { name: "Neighborhood" });
  await hood.getByRole("button", { name: /^Family 1$/ }).waitFor();
  await hood.getByRole("button", { name: /^Everyone else 2$/ }).waitFor();
  await page.locator('[data-zone="person"] [data-plot="family"]').waitFor();
  await page.getByRole("button", { name: /^Family: 1 neighbor/ }).waitFor();
  await page.waitForTimeout(800); // the lawn grows and the camera settles
  await page.screenshot({ path: `${dir}/park-5c-open.png` });
  // Opening a category shows everything in it, on the map and in the list.
  await page.getByRole("button", { name: /^Everyone else: 2 neighbors/ }).click();
  await page.locator('[data-zone="person"] [data-plot="everyone"][data-open]').waitFor();
  await hood.getByRole("button", { name: /^Everyone else 2$/, pressed: true }).waitFor();
  await page.getByRole("button", { name: "Priya Shah, neighbor" }).waitFor();
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${dir}/park-5d-category.png` });

  // Tapping one thing opens its card on the map.
  await page.getByRole("button", { name: "Sam Rivera, neighbor" }).click();
  const card = page.getByRole("region", { name: "Sam Rivera" });
  await card.getByText("Birthday Nov 3").waitFor();
  await card.getByText("Planted from Google Contacts").waitFor();
  await page.screenshot({ path: `${dir}/park-6b-card.png` });
  await card.getByRole("button", { name: "Close" }).click();

  // Tapping another lawn closes the first and opens that one.
  await flyTo("Post office");
  await page.getByRole("button", { name: /Post office: 2 letters/ }).click();
  await page.getByRole("region", { name: "Post office" }).getByRole("button", { name: /^Everyone 2$/ }).waitFor();
  await page.getByRole("button", { name: "Dinner Friday?, letter" }).waitFor();
  check((await page.locator('[data-zone="person"] [data-plot]').count()) === 0, "the Neighborhood stayed open");
  await page.locator('[data-zone="mail"] [data-plot]').first().waitFor();
  await page.screenshot({ path: `${dir}/park-6-lawn.png`, fullPage: true });

  // The plain list shows everything, lawn by lawn.
  await page.getByRole("radio", { name: "List" }).click();
  const all = page.getByRole("region", { name: "Everything in your park" });
  await all.getByText("Budget 2026").waitFor();
  await all.getByText("Grandma's chili").waitFor();
  await page.getByRole("radio", { name: "Map" }).click();

  // Dragging moves around the park like a maps app: pull the map left to reach the lawn to the right.
  await flyTo("Neighborhood");
  const box = await page.locator("main svg").first().boundingBox();
  await page.mouse.move(box.x + box.width * 0.8, box.y + box.height * 0.55);
  await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(box.x + box.width * (0.8 - i * 0.06), box.y + box.height * 0.55, { steps: 2 });
  await page.mouse.up();
  await page.getByRole("button", { name: "Go to Festival board" }).and(page.locator('[aria-current="location"]')).waitFor();
  await page.screenshot({ path: `${dir}/park-5d-dragged.png` });

  // Zoom buttons, and the whole park at once.
  await page.getByRole("button", { name: "Zoom in" }).click();
  await page.getByRole("button", { name: "Zoom out" }).click();
  await page.getByRole("button", { name: "Show the whole park" }).click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${dir}/park-5e-whole.png` });

  // Reopening does not import again, and nothing is duplicated.
  await page.goto(base + "/park", { waitUntil: "networkidle" });
  check((await page.getByText("Building your park").count()) === 0, "park re-imported on every visit");
  await page.getByRole("button", { name: /Neighborhood: 3 neighbors/ }).waitFor();
  await page.getByRole("button", { name: "Go to Neighborhood" }).and(page.locator('[aria-current="location"]')).waitFor();

  // Laptop width: the park lays out wide, four lawns across.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(base + "/park", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Show the whole park" }).click();
  await page.waitForTimeout(1500);
  const wide = await page.locator("main svg").first().boundingBox();
  const hoodBox = await page.locator('[data-zone="person"]').first().boundingBox();
  const mail = await page.locator('[data-zone="mail"]').first().boundingBox();
  check(wide && hoodBox && mail && Math.abs(hoodBox.y - mail.y) < wide.height * 0.25 && mail.x > hoodBox.x + wide.width * 0.3, "the park did not lay out wide on a laptop");
  await page.screenshot({ path: `${dir}/park-7-laptop.png` });

  check(pageErrors.length === 0, `page errors: ${pageErrors.join(" | ")}`);
  console.log("park flow ok:", email);
} finally {
  await browser.close();
  await stopServer(server).catch(() => {});
  openrouter.kill();
  google.close();
}
