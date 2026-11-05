import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:4321";
const SCREENS_DIR = join(process.cwd(), "docs", "report", "screens");
mkdirSync(SCREENS_DIR, { recursive: true });

async function run() {
  console.log(`[After] Measuring /mock-tests on ${BASE_URL}...`);

  // 1. Fetch HTML size
  const res = await fetch(`${BASE_URL}/mock-tests`);
  const html = await res.text();
  const htmlBytes = Buffer.byteLength(html, "utf8");
  const cardCount = (html.match(/<article/g) || []).length;
  // Notice each paper renders 1 desktop <article> and 1 mobile <article>, so row count is cardCount / 2
  const rowCount = (html.match(/class="[^"]*hidden md:flex[^"]*"/g) || []).length;
  console.log(`[After] HTML Size: ${htmlBytes} bytes (${(htmlBytes / 1024).toFixed(2)} KB)`);
  console.log(`[After] Desktop Rows rendered: ${rowCount}`);
  console.log(`[After] Total article elements: ${cardCount}`);

  // 2. Playwright Screenshots
  const browser = await chromium.launch();

  // Desktop (1280px) - Light & Dark
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 900 },
      colorScheme: theme,
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/mock-tests`, { waitUntil: "networkidle" });
    if (theme === "dark") {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    } else {
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
    }
    await page.waitForTimeout(500);
    const outPath = join(SCREENS_DIR, `after-mock-tests-desktop-${theme}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[After] Saved screenshot: ${outPath}`);
    await context.close();
  }

  // Mobile (375px) - Light & Dark
  for (const theme of ["light", "dark"]) {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      colorScheme: theme,
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/mock-tests`, { waitUntil: "networkidle" });
    if (theme === "dark") {
      await page.evaluate(() => document.documentElement.classList.add("dark"));
    } else {
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
    }
    await page.waitForTimeout(500);
    const outPath = join(SCREENS_DIR, `after-mock-tests-mobile-${theme}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[After] Saved screenshot: ${outPath}`);
    await context.close();
  }

  // Filtered view (Desktop, e.g. year=2026&subject=physics)
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/mock-tests?year=2026&subject=physics`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const outPath = join(SCREENS_DIR, `after-mock-tests-filtered-desktop.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[After] Saved filtered screenshot: ${outPath}`);
    await context.close();
  }

  // Empty state view (Desktop, search with no matches)
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/mock-tests?q=nonexistentquery12345`, { waitUntil: "networkidle" });
    await page.waitForTimeout(500);
    const outPath = join(SCREENS_DIR, `after-mock-tests-empty-desktop.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[After] Saved empty state screenshot: ${outPath}`);
    await context.close();
  }

  // Mobile Filters Sheet Open
  {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.goto(`${BASE_URL}/mock-tests`, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    await page.click("#open-filters-sheet-btn");
    await page.waitForTimeout(300);
    const outPath = join(SCREENS_DIR, `after-mock-tests-sheet-open-mobile.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[After] Saved mobile sheet screenshot: ${outPath}`);
    await context.close();
  }

  await browser.close();

  const afterData = {
    url: `${BASE_URL}/mock-tests`,
    htmlBytes,
    htmlKb: (htmlBytes / 1024).toFixed(2),
    desktopRows: rowCount,
    recordedAt: new Date().toISOString(),
  };

  writeFileSync(
    join(process.cwd(), "docs", "report", "mock-tests-after.json"),
    JSON.stringify(afterData, null, 2),
    "utf8"
  );
  console.log("[After] Complete. Saved to docs/report/mock-tests-after.json");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

