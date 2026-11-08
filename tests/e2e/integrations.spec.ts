import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";

const DB_NAME = "cuet-blueprint-db";
const WRANGLER_BIN = path.resolve("node_modules/wrangler/bin/wrangler.js");
const DEV_VARS = path.resolve(".dev.vars");

function localD1(sql: string): void {
  execFileSync(
    process.execPath,
    [WRANGLER_BIN, "d1", "execute", DB_NAME, "--local", "--command", sql],
    { cwd: process.cwd(), stdio: "pipe", timeout: 120_000 },
  );
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function uniqueStamp(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

/** Read a local .dev.vars value without booting the Worker. */
function devVar(name: string): string {
  if (!existsSync(DEV_VARS)) return "";
  const line = readFileSync(DEV_VARS, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));
  return line ? line.slice(line.indexOf("=") + 1).trim() : "";
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({
    "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
  });
});

test("optional integrations inject nothing when unconfigured", async ({ page, request }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "Staging may have optional integrations enabled; absence is only deterministic locally.",
  );
  test.skip(
    Boolean(devVar("CF_ANALYTICS_TOKEN") || devVar("ADSENSE_CLIENT") || devVar("GSC_VERIFICATION")),
    "Local .dev.vars configures an optional integration, so absence cannot be asserted.",
  );

  for (const route of ["/", "/mock-tests", "/cuet-mock-test"]) {
    await page.goto(route);
    await expect(page.locator('script[src*="cloudflareinsights"]'), route).toHaveCount(0);
    await expect(page.locator('script[src*="adsbygoogle"]'), route).toHaveCount(0);
    await expect(page.locator('meta[name="google-site-verification"]'), route).toHaveCount(0);
    await expect(page.locator("ins.adsbygoogle"), route).toHaveCount(0);
  }

  const adsTxt = await request.get("/ads.txt");
  expect(adsTxt.status()).toBe(404);
});

