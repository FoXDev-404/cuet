import { expect, test } from "@playwright/test";

const DARK_BG = "rgb(15, 23, 42)";
const LIGHT_BG = "rgb(255, 255, 255)";

async function bodyBackground(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => getComputedStyle(document.body).backgroundColor);
}

test.describe("theme engine — system dark", () => {
  test.use({ colorScheme: "dark" });

  test("paints dark at DOMContentLoaded without a stored choice", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    expect(await bodyBackground(page)).toBe(DARK_BG);
  });

  test("a stored light choice beats the OS preference without a flash", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "light"));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
  });
});

test.describe("theme engine — system light", () => {
  test.use({ colorScheme: "light" });

  test("paints light at DOMContentLoaded without a stored choice", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
  });

  test("a stored dark choice beats the OS preference without a flash", async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem("theme", "dark"));
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await bodyBackground(page)).toBe(DARK_BG);
  });

  test("cycles system → light → dark, persists, and resets to system", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    const toggle = page.locator(".theme-toggle").first();
    await expect(toggle).toHaveAttribute("aria-label", /Theme: system/);

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
    expect(await bodyBackground(page)).toBe(LIGHT_BG);

    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await bodyBackground(page)).toBe(DARK_BG);

    await page.reload({ waitUntil: "load" });
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await bodyBackground(page)).toBe(DARK_BG);

    await toggle.click();
    await expect(page.locator("html")).not.toHaveAttribute("data-theme");
    expect(await page.evaluate(() => localStorage.getItem("theme"))).toBeNull();
    expect(await bodyBackground(page)).toBe(LIGHT_BG);
  });

  test("syncs an open tab when another tab changes the theme", async ({ context, page }) => {
    await page.goto("/", { waitUntil: "load" });
    const second = await context.newPage();
    await second.goto("/", { waitUntil: "load" });

    const toggle = page.locator(".theme-toggle").first();
    await toggle.click();
    await toggle.click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(second.locator("html")).toHaveAttribute("data-theme", "dark");
    expect(await bodyBackground(second)).toBe(DARK_BG);
  });
});

test("survives blocked localStorage and still follows the OS", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark" });
  // The Astro dev toolbar is a development-only overlay that reads
  // localStorage at module init without a guard. It is not shipped in the
  // production build, so stub it out to keep this test about app code.
  await context.route("**/dev-toolbar/entrypoint.js*", (route) =>
    route.fulfill({ status: 200, contentType: "text/javascript", body: "" }),
  );
  await context.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      get() {
        throw new DOMException("Storage is blocked", "SecurityError");
      },
    });
  });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));

  await page.goto("/", { waitUntil: "load" });
  expect(await bodyBackground(page)).toBe(DARK_BG);
  await page.locator(".theme-toggle").first().click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(errors).toEqual([]);

  await context.close();
});

test("renders the OS theme with JavaScript disabled", async ({ browser }) => {
  const context = await browser.newContext({ colorScheme: "dark", javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/", { waitUntil: "load" });
  await expect(page.locator("html")).not.toHaveAttribute("data-theme");
  expect(await bodyBackground(page)).toBe(DARK_BG);
  await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible();
  await context.close();
});
