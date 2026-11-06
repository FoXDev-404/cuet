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

test("password reset is disabled unless email or a non-production dev link is configured", async ({
  page,
  request,
}) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test creates a local D1 user and only exercises the development reset path.",
  );

  await page.goto("/forgot-password");
  const mode = await page.locator("[data-reset-mode]").getAttribute("data-reset-mode");
  test.skip(mode !== "development", "Email delivery or disabled mode is active locally.");

  const stamp = uniqueStamp();
  const email = `e2e-phasef-${stamp}@example.com`;
  const password = "PhaseFPass!2026";

  try {
    const signup = await request.post("/api/auth/signup", {
      headers: { "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
      data: { email, password, username: `phasef_${stamp}` },
    });
    expect(signup.status()).toBe(200);

    const forgot = await request.post("/api/auth/forgot", {
      headers: { "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
      data: { email },
    });
    expect(forgot.status()).toBe(200);
    const body = (await forgot.json()) as { ok: boolean; devResetUrl?: string };
    expect(body.ok).toBe(true);
    expect(body.devResetUrl).toMatch(/^\/reset-password\/[A-Za-z0-9_-]+$/);

    const resetPage = await page.goto(body.devResetUrl ?? "");
    expect(resetPage?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Choose a new password" })).toBeVisible();
  } finally {
    const target = `(SELECT id FROM users WHERE email = ${sqlString(email)})`;
    localD1(`DELETE FROM password_resets WHERE user_id IN ${target}`);
    localD1(`DELETE FROM sessions WHERE user_id IN ${target}`);
    localD1(`DELETE FROM users WHERE email = ${sqlString(email)}`);
  }
});
