import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 } });

test("the mobile More drawer moves focus in and returns it to the trigger", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });

  const trigger = page.locator("#mobile-more-btn");
  const sheet = page.locator("#mobile-more-sheet");
  const close = page.locator("#mobile-more-close");

  await expect(trigger).toBeVisible();
  await trigger.click();
  await expect(sheet).toBeVisible();
  await expect(trigger).toHaveAttribute("aria-expanded", "true");
  await expect(close).toBeFocused();

  await close.click();
  await expect(sheet).toBeHidden();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
  await expect(trigger).toBeFocused();

  await trigger.click();
  await expect(sheet).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sheet).toBeHidden();
  await expect(trigger).toBeFocused();

  // Escape with the sheet already closed must not steal focus from the page.
  const homeLink = page.locator('nav[aria-label="Mobile Navigation"] a[href="/"]');
  await homeLink.focus();
  await page.keyboard.press("Escape");
  await expect(homeLink).toBeFocused();
});
