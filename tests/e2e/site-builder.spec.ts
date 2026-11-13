import { expect, test, type Page } from "@playwright/test";
import { seedUser, sessionCookie } from "./auth-helpers";

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@cuetfreemocktest.com";

function testClientIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
}

async function loginAsAdmin(page: Page): Promise<void> {
  const admin = seedUser({
    email: ADMIN_EMAIL,
    username: "e2e_site_builder_admin",
    admin: true,
  });
  await page.context().addCookies([sessionCookie(admin.token)]);
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": testClientIp() });
});

test("public About and Contact pages retain their page-specific structure", async ({ page }) => {
  await page.goto("/about");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "A practice site built around the attempt, not the answer key",
    }),
  ).toBeVisible();

  await page.goto("/contact");
  await expect(
    page.getByRole("heading", {
      level: 1,
      name: "Tell us what is broken, unclear or missing",
    }),
  ).toBeVisible();
  await expect(
    page.locator('a[href="mailto:support@cuetfreemocktest.com"]'),
  ).toBeVisible();
  await expect(
    page.locator('a[href="mailto:privacy@cuetfreemocktest.com"]'),
  ).toBeVisible();
  await expect(
    page.locator('a[href="mailto:legal@cuetfreemocktest.com"]'),
  ).toBeVisible();
});

test("Site Builder exposes page-specific block types and draft previews", async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test seeds an admin session in local D1.",
  );

  await loginAsAdmin(page);
  await page.goto("/admin/settings", { waitUntil: "domcontentloaded" });

  const aboutEditor = page.locator('[data-page-block-editor="about"]');
  const contactEditor = page.locator('[data-page-block-editor="contact"]');
  await expect(aboutEditor).toBeVisible();
  await expect(contactEditor).toBeVisible();
  await expect(aboutEditor.locator("select").first()).toBeVisible();
  await expect(contactEditor.locator("select").first()).toBeVisible();

  const aboutBlockTypes = await aboutEditor
    .locator("select")
    .first()
    .locator("option")
    .allTextContents();
  const contactBlockTypes = await contactEditor
    .locator("select")
    .first()
    .locator("option")
    .allTextContents();
  const mediaResponse = await page.request.get("/api/admin/media");
  expect(mediaResponse.ok()).toBeTruthy();
  const mediaResult = await mediaResponse.json();
  const imageType = mediaResult.assets.length > 0 ? ["image"] : [];

  expect(aboutBlockTypes).toEqual([
    "heading",
    "paragraph",
    "list",
    "callout",
    ...imageType,
    "internal link",
  ]);
  expect(contactBlockTypes).toEqual([
    "heading",
    "paragraph",
    "list",
    "callout",
    ...imageType,
  ]);
  await expect(aboutEditor.getByRole("link", { name: "Preview draft" })).toHaveAttribute(
    "href",
    "/about?sitePreview=1",
  );
  await expect(contactEditor.getByRole("link", { name: "Preview draft" })).toHaveAttribute(
    "href",
    "/contact?sitePreview=1",
  );
  await expect(aboutEditor.getByRole("link", { name: "Media library" })).toHaveAttribute(
    "href",
    "/admin/media",
  );

  expect(Array.isArray(mediaResult.assets)).toBe(true);

  await page.goto("/admin/media");
  await expect(page.getByRole("heading", { name: "Media library", level: 1 })).toBeVisible();
  await expect(page.getByLabel("Image file")).toHaveAttribute(
    "accept",
    "image/png,image/jpeg,image/webp",
  );
  await expect(page.getByLabel("Alternative text")).toHaveAttribute("required", "");
});
