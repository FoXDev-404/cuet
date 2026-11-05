import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE_URL = process.env.BASE_URL || "http://localhost:4321";
const SCREENS_DIR = join(process.cwd(), "docs", "report", "screens");
mkdirSync(SCREENS_DIR, { recursive: true });

async function run() {
  console.log(`[Baseline] Measuring /mock-tests on ${BASE_URL}...`);

  // 1. Fetch HTML size
  const res = await fetch(`${BASE_URL}/mock-tests`);
  const html = await res.text();
  const htmlBytes = Buffer.byteLength(html, "utf8");
  const cardCount = (html.match(/<article/g) || []).length;
  console.log(`[Baseline] HTML Size: ${htmlBytes} bytes (${(htmlBytes / 1024).toFixed(2)} KB)`);
  console.log(`[Baseline] Card count (<article>): ${cardCount}`);

  // 2. Playwright Screenshots
  const browser = await chromium.launch();

  // Desktop (1280px)
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
    const outPath = join(SCREENS_DIR, `before-mock-tests-desktop-${theme}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[Baseline] Saved screenshot: ${outPath}`);
    await context.close();
  }

  // Mobile (375px)
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
    const outPath = join(SCREENS_DIR, `before-mock-tests-mobile-${theme}.png`);
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`[Baseline] Saved screenshot: ${outPath}`);
    await context.close();
  }

  await browser.close();

  const baselineData = {
    url: `${BASE_URL}/mock-tests`,
    htmlBytes,
    htmlKb: (htmlBytes / 1024).toFixed(2),
    cardCount,
    recordedAt: new Date().toISOString(),
  };

  writeFileSync(
    join(process.cwd(), "docs", "report", "mock-tests-baseline.json"),
    JSON.stringify(baselineData, null, 2),
    "utf8"
  );
  console.log("[Baseline] Complete. Saved to docs/report/mock-tests-baseline.json");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

