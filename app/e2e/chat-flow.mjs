// Signs up, skips onboarding, sends a message, and checks the reply streams,
// persists across a reload, and appears in the chat list.
// Usage: node e2e/chat-flow.mjs <baseUrl> <screenshotDir>
import { chromium } from "playwright";
import { submitAndWaitFor } from "./helpers.mjs";

const [base = "http://localhost:3123", dir = "."] = process.argv.slice(2);
const email = `chat+${Date.now()}@example.com`;
const password = "a-long-enough-password";

const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });

async function signUp(page) {
  await page.goto(base + "/sign-up", { waitUntil: "networkidle" });
  await page.getByLabel("Name").fill("Anthony");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await submitAndWaitFor(page, "Create account", "**/onboarding");
  await page.getByRole("button", { name: "Skip for now" }).click();
  await page.waitForURL("**/park");
}

const phone = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
await signUp(phone);
await phone.screenshot({ path: `${dir}/chat-list-empty.png` });

await phone.getByRole("link", { name: "New chat" }).click();
await phone.waitForURL(/\/chats\/[0-9a-f-]{36}$/);
const threadUrl = phone.url();
await phone.getByLabel("Message").fill("Say hello");
await phone.getByRole("button", { name: "Send" }).click();
await phone.getByText("Hello from the mock. You asked: Say hello").waitFor({ timeout: 20000 });
await phone.screenshot({ path: `${dir}/chat-thread-phone.png` });
if (await phone.getByLabel("Model").count()) throw new Error("A model picker is still visible.");
if (await phone.getByText(/Claude|Gemini|GPT|Grok|DeepSeek/).count()) throw new Error("A model name is visible to the user.");

// Reload: both messages come back from the database and the list shows the title.
await phone.goto(threadUrl, { waitUntil: "networkidle" });
await phone.getByText("Hello from the mock. You asked: Say hello").waitFor();
await phone.goto(base + "/chats", { waitUntil: "networkidle" });
await phone.getByRole("link", { name: "Say hello" }).waitFor();
await phone.screenshot({ path: `${dir}/chat-list-phone.png` });

// Laptop width, same account and thread.
const cookies = await phone.context().cookies();
const desktop = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 1 });
await desktop.context().addCookies(cookies);
await desktop.goto(threadUrl, { waitUntil: "networkidle" });
await desktop.getByText("Hello from the mock. You asked: Say hello").waitFor();
await desktop.getByLabel("Message").fill("And again");
await desktop.getByRole("button", { name: "Send" }).click();
await desktop.getByText("Hello from the mock. You asked: And again").waitFor({ timeout: 20000 });
await desktop.screenshot({ path: `${dir}/chat-thread-desktop.png` });

await browser.close();
console.log("chat flow ok:", email);
