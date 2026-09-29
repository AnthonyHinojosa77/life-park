// The owner dashboard: spend across everyone, and the model switch that changes
// the AI for the owner's account only. Needs the server started with
// OWNER_EMAILS=owner@example.com and the mock model server on the given port.
// Usage: node e2e/owner-flow.mjs <baseUrl> <screenshotDir> [mockBaseUrl]
import { chromium, request } from "playwright";
import { submitAndWaitFor } from "./helpers.mjs";

const [base = "http://localhost:3123", dir = ".", mock = "http://localhost:3124"] = process.argv.slice(2);
const email = "owner@example.com";
const password = "a-long-enough-password";
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

// Sign in if the owner account exists from an earlier run; otherwise create it.
async function signUpOrIn() {
  await page.goto(base + "/sign-in", { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  for (let attempt = 0; attempt < 3; attempt++) {
    await page.getByRole("button", { name: "Sign in" }).click();
    const outcome = await Promise.race([
      page.waitForURL(/\/(chats|onboarding)/, { timeout: 20000 }).then(() => "in").catch(() => "timeout"),
      page.locator("form [role=alert]").waitFor({ timeout: 20000 }).then(() => "alert").catch(() => "timeout"),
    ]);
    if (outcome === "in") return;
    if (outcome === "timeout") throw new Error("Sign-in neither finished nor showed an error.");
    // Sign-in is rate limited too; wait it out. Any other error means no account yet.
    if (!(await page.getByText("Too many tries in a row").count())) break;
    await page.waitForTimeout(11000);
  }
  await page.goto(base + "/sign-up", { waitUntil: "networkidle" });
  await page.getByLabel("Name").fill("Anthony");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await submitAndWaitFor(page, "Create account", "**/onboarding");
}
await signUpOrIn();
await page.goto(base + "/chats", { waitUntil: "networkidle" });
if (page.url().endsWith("/onboarding")) {
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL("**/park");
}

async function chat(text) {
  await page.getByRole("link", { name: "New chat" }).click();
  await page.waitForURL(/\/chats\/[0-9a-f-]{36}$/);
  await page.getByLabel("Message").fill(text);
  await page.getByRole("button", { name: "Send" }).click();
  await page.getByText(`Hello from the mock. You asked: ${text}`).waitFor({ timeout: 20000 });
}

// Settings links to the dashboard for the owner.
await page.goto(base + "/settings", { waitUntil: "networkidle" });
await page.getByRole("link", { name: "Owner dashboard" }).click();
await page.waitForURL("**/owner");

// Start from the default model, then chat once and see the spend.
await page.getByRole("button", { name: /^Default/ }).click();
await page.waitForTimeout(800);
await chat("Owner spend check");
const defaultModel = await (await fetch(mock + "/last-model")).text();
// The reply's cost is written just after the stream closes; give it a moment.
for (let attempt = 0; attempt < 10; attempt++) {
  await page.goto(base + "/owner", { waitUntil: "networkidle" });
  if (await page.getByText(/\d+ repl(y|ies)/).count()) break;
  await page.waitForTimeout(500);
}
await page.getByText(/\d+ repl(y|ies)/).first().waitFor();
await page.getByText(/across everyone so far/).waitFor();
await page.getByText(/\d+ (person|people) active/).waitFor();

// Switch the trial model; it persists and the next chat uses it.
await page.getByRole("button", { name: "Qwen 3.8 Flash" }).click();
await page.waitForTimeout(800);
await page.reload({ waitUntil: "networkidle" });
if ((await page.getByRole("button", { name: "Qwen 3.8 Flash" }).getAttribute("aria-pressed")) !== "true") {
  throw new Error("Model switch did not persist.");
}
await page.screenshot({ path: `${dir}/owner-dashboard.png`, fullPage: true });
await chat("Which model now");
const trialModel = await (await fetch(mock + "/last-model")).text();
if (trialModel !== "qwen/qwen3.8-flash") throw new Error(`Expected the trial model, got ${trialModel}.`);
if (defaultModel === trialModel) throw new Error("Default and trial models were the same.");

// Back to the default for the next run.
await page.goto(base + "/owner", { waitUntil: "networkidle" });
await page.getByRole("button", { name: /^Default/ }).click();
await page.waitForTimeout(800);


// The People section lists everyone and can remove another person, for good.
const stray = `stray+${Date.now()}@example.com`;
// A separate request context, so creating the account never signs the browser in as it.
const api = await request.newContext();
// Sign-up is limited to a few per 10 seconds; earlier scripts may have just used them.
let made;
for (let attempt = 0; attempt < 4; attempt++) {
  made = await api.post(base + "/api/auth/sign-up/email", {
    headers: { origin: base, "content-type": "application/json" },
    data: { name: "Stray", email: stray, password: "a-long-enough-password" },
  });
  if (made.status() !== 429) break;
  await page.waitForTimeout(11000);
}
if (!made.ok()) throw new Error(`could not create a throwaway account: ${made.status()}`);
await page.goto(base + "/owner", { waitUntil: "networkidle" });
const people = page.getByRole("list", { name: "People" });
await people.getByText(stray).waitFor();
await people.getByText(`${email} (you)`).waitFor();
if (await people.getByRole("button", { name: `Remove ${email}` }).count()) throw new Error("the owner can remove themselves here");
await page.getByRole("button", { name: `Remove ${stray}` }).click();
await page.getByRole("button", { name: `Really remove ${stray}` }).click();
await people.getByText(stray).waitFor({ state: "detached", timeout: 15000 });
await page.screenshot({ path: `${dir}/owner-people.png`, fullPage: true });
const gone = await api.post(base + "/api/auth/sign-in/email", {
  headers: { origin: base, "content-type": "application/json" },
  data: { email: stray, password: "a-long-enough-password" },
});
if (gone.status() !== 401) throw new Error(`removed person can still sign in (${gone.status()})`);
await api.dispose();

await browser.close();
console.log(`owner flow ok: default ${defaultModel}, trial ${trialModel}`);
