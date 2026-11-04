import { expect, test, type Page } from "@playwright/test";

/**
 * Phase G slow-network check: the attempt screen must load, autosave, resume
 * and submit on a throttled mobile connection. The server timer is still the
 * authority; this test proves the UI stays usable when every round trip costs
 * hundreds of milliseconds.
 */
test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

function testClientIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
}

async function throttle(page: Page): Promise<void> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.emulateNetworkConditions", {
    offline: false,
    latency: 400,
    downloadThroughput: (400 * 1024) / 8,
    uploadThroughput: (400 * 1024) / 8,
  });
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
}

test.beforeEach(async ({ page }) => {
  // The local dev server honours this test-only header for rate-limit
  // isolation. Cloudflare rejects client-supplied cf-connecting-ip on staging.
  if (!process.env.PLAYWRIGHT_BASE_URL) {
    await page.setExtraHTTPHeaders({ "cf-connecting-ip": testClientIp() });
  }
  await throttle(page);
});

test("attempt stays usable on a throttled mobile connection", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/cuet-ug-mock-test", { waitUntil: "domcontentloaded" });
  const mockLink = page.locator('a[href^="/mock/"]').first();
  let href = (await mockLink.count()) > 0 ? await mockLink.getAttribute("href") : null;
  if (!href && !process.env.PLAYWRIGHT_BASE_URL) {
    // QA fixtures are deliberately hidden from the public catalogue; use the
    // local fixture directly so the throttled attempt flow stays covered.
    const fixture = await page.goto("/mock/e2e-local-fixture-mock/instructions", {
      waitUntil: "domcontentloaded",
    });
    if (fixture?.status() === 200) href = "/mock/e2e-local-fixture-mock";
  }
  if (!href) {
    test.skip(true, "No published mock test is available in this environment.");
    return;
  }

  await page.goto(`${href}/instructions`, { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible({ timeout: 60_000 });

  await page.getByRole("button", { name: /Begin test/ }).click();
  await expect(page).toHaveURL(/\/attempt\/\d+$/, { timeout: 60_000 });
  await expect(page.locator("#question-area [data-option]").first()).toBeVisible({ timeout: 60_000 });
  // Server HTML renders the options before the island hydrates. On a throttled
  // CPU a click can land on a button with no listener yet and be lost, so wait
  // for the timer to leave its SSR placeholder first.
  await expect(page.locator("#timer")).not.toHaveText("--:--:--", { timeout: 60_000 });

  // No horizontal overflow at 390 px, even while the throttled page is loading.
  const overflows = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth + 1,
  );
  expect(overflows).toBe(false);

  const saved = page.waitForResponse(
    (response) =>
      /\/api\/attempts\/\d+\/answers$/.test(new URL(response.url()).pathname) &&
      response.request().method() === "PUT",
    { timeout: 60_000 },
  );
  await page.locator("#question-area [data-option]").first().click();
  await expect(page.locator("#question-area [data-option].selected").first()).toBeVisible();
  expect((await saved).ok()).toBe(true);
  await expect(page.locator("#save-state")).toHaveText(/Saved/, { timeout: 60_000 });

  // Refresh on the slow link: the saved answer must come back from D1.
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.locator("#attempt-data")).toBeAttached({ timeout: 60_000 });
  await expect(page.locator("#question-area [data-option].selected").first()).toBeVisible({ timeout: 60_000 });

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#submit-attempt").click();
  await expect(page).toHaveURL(/\/result\/\d+$/, { timeout: 90_000 });
  await expect(page.getByText("Server-scored with this paper's marking scheme")).toBeVisible({ timeout: 60_000 });
});
