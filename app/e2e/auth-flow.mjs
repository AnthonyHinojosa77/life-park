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

// Signed out: everything leads to sign-in.
await page.goto(base + "/", { waitUntil: "networkidle" });
check(page.url().endsWith("/sign-in"), `expected redirect to /sign-in, got ${page.url()}`);
await page.screenshot({ path: `${dir}/auth-sign-in.png` });
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
