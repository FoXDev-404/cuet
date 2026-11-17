import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4321";
const origin = new URL(baseURL).origin;
const webServerCommand = process.env.PLAYWRIGHT_SERVER_COMMAND
  ? process.env.PLAYWRIGHT_SERVER_COMMAND
  : process.env.USE_PROD_BUILD
    ? "npx wrangler dev --port 4321 --ip 127.0.0.1"
    : "npm run dev";

// A developer may configure GA4 locally. Seeding a rejected choice keeps the
// consent banner (and any analytics request) out of unrelated specs. The
// consent spec overrides this with an empty storage state.
const consentStorageState = {
  cookies: [],
  origins: [
    {
      origin,
      localStorage: [{ name: "cuet_consent_v1", value: "v1:analytics=0" }],
    },
  ],
};

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [
    [process.env.CI ? "github" : "list"],
    ["json", { outputFile: process.env.PLAYWRIGHT_JSON_OUTPUT_NAME || "docs/report/playwright-results.json" }],
  ],
  use: {
    baseURL,
    // Playwright's APIRequestContext does not send Origin, but every
    // state-changing API route requires it. Same-origin browser requests
    // tolerate the override; the app makes no cross-origin fetch calls.
    extraHTTPHeaders: { origin },
    storageState: consentStorageState,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: webServerCommand,
        // Never let local E2E write to production Turso through .dev.vars.
        env: { USE_LOCAL_D1: "1" },
        url: baseURL,
        // Do not inherit an already running app that may be connected to Turso
        // or a stale build. Local E2E always needs the local D1 flag above.
        reuseExistingServer: false,
        timeout: 120_000,
      },
});
