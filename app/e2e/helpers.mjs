// Shared steps for the end-to-end scripts.

/**
 * Clicks a submit button and waits for the next page. Sign-up is limited to a
 * few attempts per connection every 10 seconds, and these scripts run back to
 * back from one machine, so a "Too many tries" notice means wait and resubmit.
 */
export async function submitAndWaitFor(page, buttonName, urlGlob, attempts = 3) {
  for (let i = 0; i < attempts; i++) {
    await page.getByRole("button", { name: buttonName }).click();
    const outcome = await Promise.race([
      page
        .waitForURL(urlGlob, { timeout: 20000 })
        .then(() => "ok")
        .catch(() => "timeout"),
      page
        .getByText("Too many tries in a row")
        .waitFor({ timeout: 20000 })
        .then(() => "limited")
        .catch(() => "timeout"),
    ]);
    if (outcome === "ok") return;
    if (outcome === "timeout") throw new Error(`No new page after "${buttonName}".`);
    await page.waitForTimeout(11000);
  }
  throw new Error(`Still rate limited after ${attempts} tries on "${buttonName}".`);
}
