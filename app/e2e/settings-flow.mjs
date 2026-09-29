// Signs up as a regular user and checks Settings: no spending, no owner link,
// the owner page is hidden, a rules edit saves, restore works, preferences persist.
// Usage: node e2e/settings-flow.mjs <baseUrl> <screenshotDir>
import { chromium } from "playwright";
import { submitAndWaitFor } from "./helpers.mjs";

const [base = "http://localhost:3123", dir = "."] = process.argv.slice(2);
const email = `settings+${Date.now()}@example.com`;
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });

await page.goto(base + "/sign-up", { waitUntil: "networkidle" });
await page.getByLabel("Name").fill("Anthony");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("a-long-enough-password");
await submitAndWaitFor(page, "Create account", "**/onboarding");
await page.getByRole("button", { name: "Skip for now" }).click();
await page.waitForURL("**/park");

// Spending is not a user concern any more, and the owner dashboard is hidden.
await page.goto(base + "/settings", { waitUntil: "networkidle" });
if (await page.getByText(/Spending in/).count()) throw new Error("Settings still shows spending.");
if (await page.getByRole("link", { name: "Owner dashboard" }).count()) throw new Error("Owner link shown to a regular user.");
await page.screenshot({ path: `${dir}/settings-phone.png`, fullPage: true });
const ownerPage = await page.goto(base + "/owner", { waitUntil: "networkidle" });
if (ownerPage?.status() !== 404) throw new Error(`Owner page answered ${ownerPage?.status()} for a regular user.`);
await page.goto(base + "/settings", { waitUntil: "networkidle" });

const rules = page.getByLabel("Rules");
const original = await rules.inputValue();
if (!original.includes("Anthony's Global Agent Instructions")) throw new Error("default rules missing");
await rules.fill("Always answer in one sentence.");
await page.getByRole("button", { name: "Save rules" }).click();
await page.getByRole("status").waitFor();
await page.reload({ waitUntil: "networkidle" });
if ((await page.getByLabel("Rules").inputValue()) !== "Always answer in one sentence.") throw new Error("rules did not persist");
await page.getByText("Edited in LifePark").waitFor();
await page.getByRole("button", { name: "Restore repository version" }).click();
await page.getByRole("status").waitFor();
await page.reload({ waitUntil: "networkidle" });
if (!(await page.getByLabel("Rules").inputValue()).includes("Anthony's Global Agent Instructions")) throw new Error("restore failed");

await page.getByRole("button", { name: "Park map" }).click();
await page.waitForTimeout(800);
await page.reload({ waitUntil: "networkidle" });
const parkOn = await page.getByRole("button", { name: "Park map" }).getAttribute("aria-pressed");
if (parkOn !== "true") throw new Error("preference did not persist");

// Deleting the account removes it for good and starts sign-up over.
await page.getByRole("button", { name: "Delete my account" }).click();
const del = page.getByRole("button", { name: "Delete everything" });
if (!(await del.isDisabled())) throw new Error("delete was allowed before typing the confirmation");
await page.getByLabel('Type "delete" to confirm').fill("delete");
await page.screenshot({ path: `${dir}/settings-delete.png`, fullPage: true });
await del.click();
await page.waitForURL("**/sign-up");
await page.goto(base + "/park", { waitUntil: "networkidle" });
if (!page.url().endsWith("/sign-in")) throw new Error("still signed in after deleting the account");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("a-long-enough-password");
await page.getByRole("button", { name: "Sign in" }).click();
await page.getByRole("alert").waitFor();
// The same email signs up again and lands back at the very start.
await page.goto(base + "/sign-up", { waitUntil: "networkidle" });
await page.getByLabel("Name").fill("Anthony");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill("a-long-enough-password");
await submitAndWaitFor(page, "Create account", "**/onboarding");
await page.getByText("Welcome to LifePark").waitFor();

await browser.close();
console.log("settings flow ok:", email);
