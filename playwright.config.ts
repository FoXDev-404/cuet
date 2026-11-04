import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4321";
const webServerCommand = process.env.PLAYWRIGHT_SERVER_COMMAND
  ? process.env.PLAYWRIGHT_SERVER_COMMAND
  : process.env.USE_PROD_BUILD
    ? "npx wrangler dev --port 4321 --ip 127.0.0.1"
    : "npm run dev";

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
        url: baseURL,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
