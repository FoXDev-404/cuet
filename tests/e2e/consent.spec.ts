import { expect, test } from "@playwright/test";

const PAGE = "/dev/consent";
const GTAG = 'script[src*="googletagmanager.com/gtag/js"]';
const BANNER = { name: "Cookie consent" } as const;

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("consent gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
  });

  test("appears after a short delay and loads nothing before a choice", async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.addInitScript(() => {
      const started = performance.now();
      (window as unknown as { __consentShownAfter: number }).__consentShownAfter = -1;
      const tick = () => {
        const banner = document.getElementById("consent-banner");
        if (banner && !banner.hasAttribute("hidden")) {
          (window as unknown as { __consentShownAfter: number }).__consentShownAfter =
            performance.now() - started;
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await page.goto(PAGE);
    const banner = page.getByRole("dialog", BANNER);
    await expect(banner).toBeVisible();
    const shownAfter = await page.evaluate(
      () => (window as unknown as { __consentShownAfter: number }).__consentShownAfter,
    );
    expect(shownAfter).toBeGreaterThanOrEqual(900);
    await expect(page.locator(GTAG)).toHaveCount(0);
    await page.waitForTimeout(2500);
    await expect(page.locator(GTAG)).toHaveCount(0);
    expect(pageErrors).toEqual([]);
  });

  test("copies the policy link with a space before it", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole("dialog", BANNER)).toBeVisible();
    const text = await page.locator("#consent-banner-text").innerText();
    expect(text).toContain("See our Privacy Policy.");
    expect(text).not.toContain("ourPrivacy");
  });

  test("reject hides the banner, persists and never loads", async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByRole("dialog", BANNER)).toBeHidden();
    await expect(page.getByRole("status")).toHaveText("Analytics rejected.");
    await page.reload();
    await expect(page.getByRole("dialog", BANNER)).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("cuet_consent_v1"))).toBe("v1:analytics=0");
  });

  test("accept loads gtag once and persists across reload", async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await expect(page.locator(GTAG)).toHaveCount(1);
    await expect(page.getByRole("dialog", BANNER)).toBeHidden();
    await page.reload();
    await expect(page.getByRole("dialog", BANNER)).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(1, { timeout: 5000 });
  });

  test("Cookie settings reopens and withdrawal clears and reloads", async ({ page, context }) => {
    await page.goto(PAGE);
    await page.getByRole("button", { name: "Accept", exact: true }).click();
    await context.addCookies([
      { name: "_ga", value: "GA1.1.123", url: new URL(page.url()).origin },
    ]);
    await page.getByRole("button", { name: "Cookie settings" }).click();
    await expect(page.getByRole("dialog", BANNER)).toBeVisible();
    const reloaded = page.waitForEvent("load");
    await page.getByRole("button", { name: "Reject" }).click();
    await reloaded;
    expect(await page.evaluate(() => localStorage.getItem("cuet_consent_v1"))).toBe("v1:analytics=0");
    expect((await context.cookies()).some((cookie) => cookie.name === "_ga")).toBe(false);
    await expect(page.locator(GTAG)).toHaveCount(0);
  });

  test("desktop card stays compact in the bottom-left corner", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(PAGE);
    const banner = page.getByRole("dialog", BANNER);
    await expect(banner).toBeVisible();
    const box = await banner.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(101);
    expect(box!.width).toBeLessThanOrEqual(420);
    expect(box!.x).toBeGreaterThanOrEqual(15);
    expect(900 - (box!.y + box!.height)).toBeGreaterThanOrEqual(15);
  });

  test("mobile sheet fits the viewport and sits above the bottom nav", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);
    const banner = page.getByRole("dialog", BANNER);
    await expect(banner).toBeVisible();
    const box = await banner.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeLessThanOrEqual(150);
    expect(box!.x).toBeCloseTo(12, 0);
    expect(390 - (box!.x + box!.width)).toBeCloseTo(12, 0);
    // 4rem bottom nav + 12px gap is reserved even though /dev/consent has none.
    expect(844 - (box!.y + box!.height)).toBeGreaterThanOrEqual(75);
  });

  test("buttons keep a 44px tap target on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PAGE);
    await expect(page.getByRole("dialog", BANNER)).toBeVisible();
    for (const name of ["Accept", "Reject"]) {
      const box = await page.getByRole("button", { name, exact: true }).boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
  });

  test("fits narrow phone and small-tablet widths", async ({ page }) => {
    const cases = [
      { width: 360, height: 780, maxHeight: 150 },
      { width: 768, height: 1024, maxHeight: 101 },
    ];
    for (const view of cases) {
      await page.setViewportSize({ width: view.width, height: view.height });
      await page.goto(PAGE);
      await expect(page.getByRole("dialog", BANNER)).toBeVisible();
      const box = await page.getByRole("dialog", BANNER).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeLessThanOrEqual(view.maxHeight);
      expect(box!.x).toBeGreaterThanOrEqual(11);
      expect(view.width - (box!.x + box!.width)).toBeGreaterThanOrEqual(11);
    }
  });

  test("?allow=0 suppresses the component entirely", async ({ page }) => {
    await page.goto(`${PAGE}?allow=0`);
    await expect(page.getByRole("dialog", BANNER)).toBeHidden();
    await expect(page.getByRole("button", { name: "Cookie settings" })).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(0);
  });
});

test.describe("consent without JavaScript", () => {
  test.use({ javaScriptEnabled: false, storageState: { cookies: [], origins: [] } });

  test("fails closed", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole("dialog", BANNER)).toBeHidden();
    await expect(page.getByRole("button", { name: "Cookie settings" })).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(0);
  });
});
