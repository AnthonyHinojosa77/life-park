// Drives sign-up, onboarding, sign-out, and sign-in through the real pages.
// Usage: node e2e/auth-flow.mjs <baseUrl> <screenshotDir>
import { chromium } from "playwright";
import { submitAndWaitFor } from "./helpers.mjs";

const [base = "http://localhost:3123", dir = "."] = process.argv.slice(2);
const email = `anthony+${Date.now()}@example.com`;
const password = "a-long-enough-password";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

function check(condition, message) {
  if (!condition) throw new Error(message);
}

// Signed out: everything leads to sign-in, which opens with the intro every
// time the app is opened: the logo draws itself big, shrinks into its spot at
// the top, then the page draws itself in piece by piece.
await page.goto(base + "/", { waitUntil: "domcontentloaded" });
check(page.url().endsWith("/sign-in"), `expected redirect to /sign-in, got ${page.url()}`);
await page.locator("[data-intro-overlay]").waitFor({ state: "visible", timeout: 5000 });
await page.screenshot({ path: `${dir}/auth-intro.png` });
await page.locator("[data-intro-overlay]").waitFor({ state: "detached", timeout: 15000 });
await page.locator('[data-intro="reveal"]').waitFor({ state: "attached", timeout: 5000 });
const revealStarted = Date.now();
await page.locator('[data-intro="done"]').waitFor({ state: "attached", timeout: 12000 });
const revealTook = Date.now() - revealStarted;
check(revealTook > 3500, `page drew in too fast: ${revealTook}ms`);
check((await page.locator("[data-intro-target]").evaluate((el) => getComputedStyle(el).opacity)) === "1", "wordmark hidden after the intro");
const outlineMask = () => page.locator(".intro-card-outline").evaluate((el) => getComputedStyle(el).maskImage);
check((await outlineMask()) === "none", "card outline still masked after the intro");
await page.screenshot({ path: `${dir}/auth-sign-in.png` });
// Hopping to sign-up in the same visit skips the logo but still draws the page in.
await page.getByRole("link", { name: "Create an account" }).click();
await page.waitForURL("**/sign-up");
check(!(await page.locator("[data-intro-overlay]").isVisible()), "logo intro replayed on the sign-up link");
check((await page.locator('[data-intro="reveal"]').count()) === 1, "page did not draw in on sign-up");
await page.locator('[data-intro="done"]').waitFor({ state: "attached", timeout: 12000 });
check((await outlineMask()) === "none", "card outline still masked on sign-up");
// Opening the app again plays the whole intro again; a tap on the logo skips it.
await page.reload({ waitUntil: "domcontentloaded" });
await page.locator("[data-intro-overlay]").waitFor({ state: "visible", timeout: 5000 });
await page.locator("[data-intro-overlay]").click();
await page.locator('[data-intro="reveal"]').waitFor({ state: "attached", timeout: 5000 });
await page.locator('[data-intro="done"]').waitFor({ state: "attached", timeout: 12000 });
check((await page.locator("[data-intro-overlay]").count()) === 0, "logo intro left behind after a tap");
// People who ask for less motion never see it.
const calm = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
await calm.goto(base + "/sign-in", { waitUntil: "domcontentloaded" });
check((await calm.locator('[data-intro="done"]').count()) === 1, "intro played despite reduced motion");
await calm.getByLabel("Email").waitFor();
await calm.close();
await page.goto(base + "/chats", { waitUntil: "networkidle" });
check(page.url().endsWith("/sign-in"), "protected page did not redirect when signed out");

// Sign up, land in onboarding.
await page.goto(base + "/sign-up", { waitUntil: "networkidle" });
await page.screenshot({ path: `${dir}/auth-sign-up.png` });
await page.getByLabel("Name").fill("Anthony");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await submitAndWaitFor(page, "Create account", "**/onboarding");
await page.getByRole("heading", { level: 1 }).waitFor();
await page.screenshot({ path: `${dir}/onboarding-1-welcome.png` });

// Chats is not reachable until onboarding is done.
await page.goto(base + "/chats", { waitUntil: "networkidle" });
check(page.url().endsWith("/onboarding"), "chats opened before onboarding finished");

// The welcome explains how LifePark works, then offers to connect accounts.
await page.getByText("It files everything").waitFor();
await page.getByRole("button", { name: "Let's build your park" }).click();
await page.getByRole("heading", { level: 1 }).waitFor();
await page.screenshot({ path: `${dir}/onboarding-2-connect.png` });
// This test server has no Google credentials, so the park opens straight away.
await page.getByRole("button", { name: "See my park" }).click();
await page.waitForURL("**/park");
await page.getByRole("heading", { name: "Anthony's park" }).waitFor();
await page.screenshot({ path: `${dir}/auth-park.png` });

// Onboarding does not reappear once done.
await page.goto(base + "/", { waitUntil: "networkidle" });
check(page.url().endsWith("/chats"), "home did not go straight to chats after onboarding");

// Sign out, wrong password, sign in.
await page.goto(base + "/settings", { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Sign out" }).click();
await page.waitForURL("**/sign-in");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("wrong-password-here");
await page.getByRole("button", { name: "Sign in" }).click();
await page.getByRole("alert").waitFor();
await page.getByLabel("Password").fill(password);
await page.getByRole("button", { name: "Sign in" }).click();
await page.waitForURL("**/chats");
await page.getByRole("heading", { name: "Chats" }).waitFor();

await browser.close();
console.log("auth and onboarding flow ok:", email);
