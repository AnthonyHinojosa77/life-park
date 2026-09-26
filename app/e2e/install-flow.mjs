// Checks the home-screen install pieces: manifest, icons, service worker,
// offline page, and the hands-free / listen controls in a chat.
// Usage: node e2e/install-flow.mjs <baseUrl> <screenshotDir>
import { chromium } from "playwright";
import { submitAndWaitFor } from "./helpers.mjs";

const [base = "http://localhost:3123", dir = "."] = process.argv.slice(2);
const email = `install+${Date.now()}@example.com`;
const password = "a-long-enough-password";

const manifest = await (await fetch(base + "/manifest.webmanifest")).json();
if (manifest.display !== "standalone" || manifest.start_url !== "/") {
  throw new Error("Manifest is not set up for standalone install: " + JSON.stringify(manifest));
}
for (const size of ["192x192", "512x512"]) {
  const icon = manifest.icons.find((i) => i.sizes === size && i.type === "image/png");
  if (!icon) throw new Error(`Manifest has no ${size} PNG icon.`);
  const res = await fetch(base + icon.src);
  if (!res.ok || res.headers.get("content-type") !== "image/png") {
    throw new Error(`Icon ${icon.src} did not load as a PNG.`);
  }
}
const sw = await fetch(base + "/sw.js");
if (!sw.ok || !(await sw.text()).includes("work-park")) throw new Error("Service worker missing.");
const offline = await fetch(base + "/offline");
if (!offline.ok || !(await offline.text()).includes("offline")) throw new Error("Offline page missing.");

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  userAgent:
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
});
const page = await context.newPage();

await page.goto(base + "/sign-up", { waitUntil: "networkidle" });
await page.getByLabel("Name").fill("Anthony");
await page.getByLabel("Email").fill(email);
await page.getByLabel("Password").fill(password);
await submitAndWaitFor(page, "Create account", "**/onboarding");
await page.getByRole("button", { name: "Skip for now" }).click();
await page.waitForURL("**/chats");

// The service worker registered and controls the page.
await page.waitForFunction(() => navigator.serviceWorker?.controller !== null, null, {
  timeout: 15000,
}).catch(async () => {
  const ready = await page.evaluate(() => navigator.serviceWorker.ready.then((r) => r.active?.state));
  if (ready !== "activated") throw new Error("Service worker never activated.");
});

// iPhone visitors see the Add to Home Screen hint until they dismiss it.
await page.getByText("Add to your home screen").waitFor();
await page.screenshot({ path: `${dir}/install-hint-iphone.png` });
await page.getByRole("button", { name: "Later" }).click();
await page.reload({ waitUntil: "networkidle" });
if (await page.getByText("Add to your home screen").isVisible()) {
  throw new Error("Install hint came back after dismissal.");
}

// Hands-free remembers its setting and Listen appears on replies.
await page.getByRole("link", { name: "New chat" }).click();
await page.waitForURL(/\/chats\/[0-9a-f-]{36}$/);
const handsFree = page.getByRole("switch", { name: "Hands-free" });
await handsFree.click();
if ((await handsFree.getAttribute("aria-checked")) !== "true") throw new Error("Hands-free did not turn on.");
await page.getByLabel("Message").fill("Say hello");
await page.getByRole("button", { name: "Send" }).click();
await page.getByText("Hello from the mock. You asked: Say hello").waitFor({ timeout: 20000 });
await page.getByRole("button", { name: "Listen" }).waitFor();
await page.screenshot({ path: `${dir}/chat-hands-free.png` });
await page.reload({ waitUntil: "networkidle" });
if ((await handsFree.getAttribute("aria-checked")) !== "true") throw new Error("Hands-free forgot its setting.");

// Offline: navigation falls back to the friendly page.
await context.setOffline(true);
await page.goto(base + "/settings").catch(() => {});
await page.getByText("The park is closed for now.").waitFor({ timeout: 10000 });
await page.screenshot({ path: `${dir}/offline-page.png` });
await context.setOffline(false);

await browser.close();
console.log("install flow ok");
