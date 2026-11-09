#!/usr/bin/env node
/**
 * Post-deploy smoke check.
 *
 * Most public paths must answer 200. `/sitemap.xml` may instead answer 503
 * with `x-sitemap-degraded`: that is the deliberate guard that keeps a
 * partial, quota-limited sitemap out of the 6-hour edge cache. A 503 without
 * the guard header is still a failure.
 *
 * Usage: node scripts/smoke-check.mjs <base-url> [--expect <text>]
 * The optional `--expect` text must appear in the `/mock-tests` response.
 */

const args = process.argv.slice(2);
const baseUrl = args.shift();
if (!baseUrl) {
  console.error("Usage: node scripts/smoke-check.mjs <base-url> [--expect <text>]");
  process.exit(2);
}

let expectedText = null;
while (args.length > 0) {
  const flag = args.shift();
  if (flag === "--expect") {
    expectedText = args.shift() ?? "";
  } else {
    console.error(`Unknown argument: ${flag}`);
    process.exit(2);
  }
}

const ATTEMPTS = 3;
const RETRY_DELAY_MS = 10_000;
const paths = [
  "/api/health",
  "/mock-tests",
  "/sitemap.xml",
  "/mock/psychology-2024-07-19-shift-1/instructions",
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function request(path) {
  const response = await fetch(new URL(path, baseUrl), {
    redirect: "manual",
    signal: AbortSignal.timeout(30_000),
  });
  return {
    status: response.status,
    body: await response.text(),
    degraded: Boolean(response.headers.get("x-sitemap-degraded")),
  };
}

function accepted(path, result) {
  if (result.status === 200) return true;
  return path === "/sitemap.xml" && result.status === 503 && result.degraded;
}

let failed = false;
for (const path of paths) {
  let result = null;
  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    try {
      result = await request(path);
    } catch (error) {
      console.error(`${path} (attempt ${attempt}) -> request failed: ${error}`);
      result = null;
    }
    if (result) {
      const suffix = path === "/sitemap.xml" && result.degraded ? " (guarded degraded)" : "";
      console.log(`${path} (attempt ${attempt}) -> ${result.status}${suffix}`);
      if (accepted(path, result)) break;
    }
    if (attempt < ATTEMPTS) await sleep(RETRY_DELAY_MS);
  }
  if (!result || !accepted(path, result)) {
    console.error(`::error::${path} did not return an accepted status after ${ATTEMPTS} attempts.`);
    failed = true;
    continue;
  }
  if (path === "/mock-tests" && expectedText && !result.body.includes(expectedText)) {
    console.error(`::error::/mock-tests did not contain the expected text: ${expectedText}`);
    failed = true;
  }
}

if (failed) process.exit(1);
console.log("Smoke check passed.");
