// Signs up, skips onboarding, chats once against the mock, then checks Settings:
// the spend shows, a rules edit saves, and restore brings the repository text back.
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
await page.waitForURL("**/chats");

await page.getByRole("link", { name: "New chat" }).click();
await page.waitForURL(/\/chats\/[0-9a-f-]{36}$/);
await page.getByLabel("Message").fill("Cost me something");
await page.getByRole("button", { name: "Send" }).click();
await page.getByText("Hello from the mock. You asked: Cost me something").waitFor({ timeout: 20000 });

// The reply's cost is written just after the stream closes; give it a moment.
for (let attempt = 0; attempt < 10; attempt++) {
  await page.goto(base + "/settings", { waitUntil: "networkidle" });
  if (await page.getByText("$0.0003").count()) break;
  await page.waitForTimeout(500);
}
await page.getByText("$0.0003").first().waitFor();
await page.getByText("1 reply").waitFor();
await page.screenshot({ path: `${dir}/settings-phone.png`, fullPage: true });

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

await browser.close();
console.log("settings flow ok:", email);
