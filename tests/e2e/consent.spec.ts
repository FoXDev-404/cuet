import { expect, test } from "@playwright/test";

const PAGE = "/dev/consent";
const GTAG = 'script[src*="googletagmanager.com/gtag/js"]';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("consent gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
  });

  test("shows the banner and loads nothing before a choice", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeVisible();
    await expect(page.locator(GTAG)).toHaveCount(0);
    await page.waitForTimeout(2500);
    await expect(page.locator(GTAG)).toHaveCount(0);
  });

  test("reject hides the banner, persists and never loads", async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await expect(page.getByRole("status")).toHaveText("Analytics rejected.");
    await page.reload();
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("cuet_consent_v1"))).toBe("v1:analytics=0");
  });

  test("allow loads gtag once and persists across reload", async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole("button", { name: "Allow analytics" }).click();
    await expect(page.locator(GTAG)).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await page.reload();
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(1, { timeout: 5000 });
  });

  test("Privacy choices reopens and withdrawal clears and reloads", async ({ page, context }) => {
    await page.goto(PAGE);
    await page.getByRole("button", { name: "Allow analytics" }).click();
    await context.addCookies([
      { name: "_ga", value: "GA1.1.123", url: new URL(page.url()).origin },
    ]);
    await page.getByRole("button", { name: "Privacy choices" }).click();
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeVisible();
    const reloaded = page.waitForEvent("load");
    await page.getByRole("button", { name: "Reject" }).click();
    await reloaded;
    expect(await page.evaluate(() => localStorage.getItem("cuet_consent_v1"))).toBe("v1:analytics=0");
    expect((await context.cookies()).some((cookie) => cookie.name === "_ga")).toBe(false);
    await expect(page.locator(GTAG)).toHaveCount(0);
  });

  test("?allow=0 suppresses the component entirely", async ({ page }) => {
    await page.goto(`${PAGE}?allow=0`);
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Privacy choices" })).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(0);
  });
});

test.describe("consent without JavaScript", () => {
  test.use({ javaScriptEnabled: false, storageState: { cookies: [], origins: [] } });

  test("fails closed", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Privacy choices" })).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(0);
  });
});
