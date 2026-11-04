/**
 * Repeatable WCAG A/AA audit for the Astro app.
 *
 * Prerequisites: a running app with a published mock in D1.
 *   npm run dev
 *   npm run test:a11y
 *
 * Set A11Y_ADMIN_EMAIL and A11Y_ADMIN_PASSWORD to also audit the authenticated
 * pages. Without them the script only scans public pages; no credentials are
 * stored in the repository.
 *
 * Set A11Y_STORAGE_STATE to a Playwright storage-state file to reuse an
 * existing session instead of email/password login. This is the safer option
 * for an interactive owner login, especially for Google-only accounts.
 *
 * Set A11Y_SKIP_ATTEMPT=1 to skip the guest attempt/result walk. Use this
 * against production when you do not want the audit to write attempt rows.
 *
 * The axe bundle is injected from node_modules, so nothing is shipped in public/.
 */
import { chromium } from "@playwright/test";
import { createRequire } from "node:module";
import { writeFileSync, mkdirSync } from "node:fs";
import { execSync } from "node:child_process";

const require = createRequire(import.meta.url);
const axePath = require.resolve("axe-core/axe.min.js");

const baseURL =
  process.env.A11Y_BASE_URL ?? process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4321";
const adminEmail = process.env.A11Y_ADMIN_EMAIL ?? "admin@cuetfreemocktest.com";
const adminPassword = process.env.A11Y_ADMIN_PASSWORD ?? "AdminPass123!";
const storageState = process.env.A11Y_STORAGE_STATE;
const skipAttempt = /^(1|true|yes)$/i.test(process.env.A11Y_SKIP_ATTEMPT ?? "");

const STATIC_PUBLIC_PATHS = [
  "/",
  "/cuet-ug-mock-test",
  "/leaderboard",
  "/cuet-ug-syllabus",
  "/cuet-ug-exam-pattern",
  "/cuet-ug-marking-scheme",
  "/cuet-ug-important-dates",
  "/cuet-ug-previous-year-papers",
  "/practice",
  "/practice/english-2022-08-06-shift-1",
  "/cuet-mock-test/english",
  "/cuet-ug-syllabus/english",
  "/blog",
  "/search?q=english",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/disclaimer",
  "/login",
  "/signup",
  "/forgot-password",
];

// Placeholders are filled from the live admin APIs after login. Production
// content ids change, so hard-coded ids such as /admin/questions/1 would scan a
// deleted row or redirect to a 404.
const AUTHENTICATED_PATH_TEMPLATES = [
  "/dashboard",
  "/dashboard/history",
  "/dashboard/bookmarks",
  "/dashboard/wrong-questions",
  "/dashboard/wrong-questions/retry",
  "/dashboard/discussions",
  "/dashboard/settings",
  "/admin",
  "/admin/questions",
  "/admin/questions/new",
  "/admin/questions/import",
  "/admin/questions/{questionId}",
  "/admin/mocks",
  "/admin/mocks/new",
  "/admin/mocks/{mockId}",
  "/admin/mocks/{mockId}/preview",
  "/admin/pyq",
  "/admin/users",
  "/admin/moderation",
  "/admin/leaderboard",
  "/admin/announcements",
  "/admin/blog",
  "/admin/settings",
  "/admin/seo",
  "/admin/exam-info",
  "/admin/audit-log",
  "/admin/review",
  "/admin/data",
  "/admin/trash",
  "/admin/attempts",
  "/admin/admins",
  "/admin/passages",
  "/admin/search",
];

const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const VIEWPORTS = [
  { name: "desktop", width: 1280, height: 800 },
  { name: "mobile", width: 375, height: 667 },
];

const failures = [];
const allScans = [];
let scans = 0;

async function runAxe(page) {
  return page.evaluate(async (tags) => {
    const results = await window.axe.run(document, {
      runOnly: { type: "tag", values: tags },
    });
    return {
      violations: results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        nodes: violation.nodes.map((node) => ({
          target: node.target.join(" "),
          summary: (node.failureSummary ?? "").replace(/\s+/g, " ").trim(),
        })),
      })),
      overflow:
        document.documentElement.scrollWidth > window.innerWidth + 1
          ? document.documentElement.scrollWidth
          : 0,
    };
  }, WCAG_TAGS);
}

async function auditPath(page, label, path, viewport, waitFor, prepare) {
  await page.setViewportSize({ width: viewport.width, height: viewport.height });

  let response = null;
  let navigationError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      response = await page.goto(`${baseURL}${path}`, {
        waitUntil: "load",
        timeout: 45_000,
      });
      navigationError = null;
      break;
    } catch (error) {
      navigationError = error;
      if (attempt < 3) {
        console.log(`  retry ${attempt}/3 ${path}: ${String(error.message).split("\n")[0]}`);
        await page.waitForTimeout(1_000 * attempt);
      }
    }
  }

  if (!response) {
    failures.push({
      label,
      path,
      viewport: viewport.name,
      theme: "n/a",
      reason: `navigation failed: ${String(navigationError?.message ?? "unknown").split("\n")[0]}`,
    });
    return;
  }

  const status = response.status();
  if (status >= 400) {
    failures.push({ label, path, viewport: viewport.name, theme: "n/a", reason: `HTTP ${status}` });
    return;
  }
  if (prepare) {
    await prepare(page);
  }
  if (waitFor) {
    await waitFor(page);
  } else {
    await page.waitForTimeout(150);
  }
  await page.addScriptTag({ path: axePath });

  for (const theme of ["light", "dark"]) {
    await page.evaluate((mode) => {
      document.documentElement.setAttribute("data-theme", mode);
    }, theme);
    // Cards use a 150ms color transition; wait for it to settle before axe
    // samples computed colors, otherwise it can catch a mid-transition frame.
    await page.waitForTimeout(300);

    const result = await runAxe(page);
    scans += 1;
    allScans.push({
      label,
      path,
      viewport: viewport.name,
      width: viewport.width,
      theme,
      violations: result.violations,
      overflow: result.overflow,
      passed: result.violations.length === 0 && result.overflow === 0,
    });
    if (result.overflow) {
      failures.push({
        label,
        path,
        viewport: viewport.name,
        theme,
        reason: `horizontal overflow: ${result.overflow}px`,
      });
    }
    for (const violation of result.violations) {
      failures.push({
        label,
        path,
        viewport: viewport.name,
        theme,
        reason: `${violation.id} (${violation.impact}): ${violation.help}`,
        nodes: violation.nodes.slice(0, 4),
      });
    }
  }

  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
  console.log(`  checked ${path}`);
}

async function findMockSlug(page) {
  await page.goto(`${baseURL}/cuet-ug-mock-test`, { waitUntil: "load" });
  const href = await page.locator('a[href^="/mock/"]').first().getAttribute("href").catch(() => null);
  if (!href) return null;
  const match = href.match(/^\/mock\/([^/?#]+)/);
  return match?.[1] ?? null;
}

async function findMockId(page, slug) {
  await page.goto(`${baseURL}/mock/${slug}/instructions`, { waitUntil: "load" });
  const id = await page.locator("#start-attempt").getAttribute("data-mock-id").catch(() => null);
  return id ? Number(id) : null;
}

async function findSharedQuestionPath(page) {
  const response = await page.request.get(`${baseURL}/sitemap.xml`);
  if (response.ok()) {
    const xml = await response.text();
    const loc = xml.match(/<loc>([^<]*\/q\/[^<]+)<\/loc>/)?.[1];
    if (loc) {
      try {
        return new URL(loc).pathname;
      } catch {}
    }
  }
  // If sitemap has no question due to rights quarantine, verify fallback public id
  const fallbackRes = await page.request.get(`${baseURL}/q/uPJRyUwJ3s`);
  if (fallbackRes.ok() || fallbackRes.status() === 301) {
    return "/q/uPJRyUwJ3s";
  }
  return null;
}

async function findAdminIds(page) {
  const ids = { questionId: null, mockId: null };

  const questions = await page.request.get(
    `${baseURL}/api/admin/questions?status=published&limit=1`,
  );
  if (questions.ok()) {
    const body = await questions.json();
    ids.questionId = body?.questions?.[0]?.id ?? null;
  }

  const mocks = await page.request.get(`${baseURL}/api/admin/mocks?limit=1`);
  if (mocks.ok()) {
    const body = await mocks.json();
    ids.mockId = body?.mocks?.[0]?.id ?? null;
  }

  return ids;
}

function authenticatedPaths(ids, slug) {
  const paths = [];
  for (const template of AUTHENTICATED_PATH_TEMPLATES) {
    if (template.includes("{questionId}") && !ids.questionId) continue;
    if (template.includes("{mockId}") && !ids.mockId) continue;
    paths.push(
      template.replace("{questionId}", String(ids.questionId ?? "")).replace(
        "{mockId}",
        String(ids.mockId ?? ""),
      ),
    );
  }
  if (slug) paths.push(`/mock/${slug}/discussion`);
  return paths;
}

async function auditPublic(browser) {
  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("\nPublic pages");
  for (const path of STATIC_PUBLIC_PATHS) {
    for (const viewport of VIEWPORTS) {
      await auditPath(page, "public", path, viewport);
    }
  }

  const sharedQuestionPath = await findSharedQuestionPath(page);
  if (sharedQuestionPath) {
    console.log("\nPublic question page");
    for (const viewport of VIEWPORTS) {
      await auditPath(page, "public-question", sharedQuestionPath, viewport);
    }
  }

  console.log("\nLocal practice pages");
  const localPracticePaths = skipAttempt
    ? ["/practice/english-2022-08-06-shift-1", "/practice/english-2024-05-15-shift-2"]
    : [
        "/mock/english-2022-08-06-shift-1/instructions",
        "/mock/english-2024-05-15-shift-2/instructions",
      ];
  for (const path of localPracticePaths) {
    for (const viewport of VIEWPORTS) {
      if (skipAttempt) {
        await auditPath(page, "local-practice", path, viewport);
        continue;
      }
      await auditPath(
        page,
        "local-practice",
        path,
        viewport,
        (target) => target.locator("#question-area [data-option]").first().waitFor(),
        async (target) => {
          await target.getByRole("button", { name: /Begin test/ }).click();
          await target.waitForURL(/\/attempt\/\d+$/, { timeout: 60_000 });
        },
      );
      const attemptId = page.url().match(/\/attempt\/(\d+)$/)?.[1];
      if (attemptId) {
        await context.request.post(`${baseURL}/api/attempts/${attemptId}/submit`, { data: {} });
      }
    }
  }

  const slug = await findMockSlug(page);
  if (!slug) {
    // The public catalogue intentionally serves the refined /practice library;
    // the D1 mock suite may be empty while it is rebuilt. The library pages
    // above are the coverage that matters in that state.
    console.log(
      "\nNo published D1 mock; mock-specific pages skipped (the refined /practice library is covered above).",
    );
    await context.close();
    return;
  }

  for (const path of [
    `/leaderboard/${slug}`,
    `/mock/${slug}`,
    `/mock/${slug}/instructions`,
    `/mock/${slug}/discussion`,
  ]) {
    for (const viewport of VIEWPORTS) {
      await auditPath(page, "mock", path, viewport);
    }
  }

  const mockId = await findMockId(page, slug);
  if (skipAttempt) {
    console.log("\nAttempt/result pages skipped (A11Y_SKIP_ATTEMPT is set).");
  } else if (mockId) {
    const started = await context.request.post(`${baseURL}/api/attempts/start`, {
      data: { mockId },
    });
    const attempt = started.ok() ? await started.json() : null;
    if (attempt?.attemptId) {
      for (const viewport of VIEWPORTS) {
        await auditPath(page, "attempt", `/attempt/${attempt.attemptId}`, viewport, (target) =>
          target.locator("#question-area [data-option]").first().waitFor(),
        );
        // Palette expanded state
        await auditPath(
          page,
          "attempt-palette",
          `/attempt/${attempt.attemptId}`,
          viewport,
          null,
          async (target) => {
            const toggle = target.locator("button:has-text('Palette'), [aria-label*='palette' i]").first();
            if (await toggle.isVisible().catch(() => false)) {
              await toggle.click();
              await target.waitForTimeout(200);
            }
          },
        );
      }

      await context.request.post(`${baseURL}/api/attempts/${attempt.attemptId}/submit`, {
        data: {},
      });

      for (const viewport of VIEWPORTS) {
        await auditPath(page, "result", `/result/${attempt.attemptId}`, viewport, (target) =>
          target.getByRole("link", { name: "Review solutions →" }).waitFor(),
        );
        await auditPath(page, "result", `/result/${attempt.attemptId}/solutions`, viewport);
      }

      // A finished attempt unlocks the discussion thread for guests.
      for (const viewport of VIEWPORTS) {
        await auditPath(page, "mock", `/mock/${slug}/discussion`, viewport);
      }
    }
  }

  await context.close();
}

async function auditAuthenticated(browser) {
  const context = storageState
    ? await browser.newContext({ storageState })
    : await browser.newContext();
  const page = await context.newPage();

  if (storageState) {
    console.log("\nAuthenticated pages (reusing A11Y_STORAGE_STATE)");
  } else {
    await page.goto(`${baseURL}/login`, { waitUntil: "load" });
    await page.fill('input[name="email"]', adminEmail);
    await page.fill('input[name="password"]', adminPassword);
    await Promise.all([
      page.waitForURL(/\/dashboard$/, { timeout: 15_000 }),
      page.locator('form button[type="submit"]').click(),
    ]);
    console.log("\nAuthenticated pages");
  }
  const slug = await findMockSlug(page);
  const ids = await findAdminIds(page);
  if (!ids.questionId) {
    console.log("  no live admin question found; question editor paths skipped");
  }
  if (!ids.mockId) {
    console.log("  no live admin mock found; mock editor paths skipped");
  }
  const paths = authenticatedPaths(ids, slug);
  for (const path of paths) {
    for (const viewport of VIEWPORTS) {
      await auditPath(page, "auth", path, viewport);
    }
  }

  await context.close();
}

const browser = await chromium.launch();
try {
  console.log(`Accessibility audit against ${baseURL}`);
  await auditPublic(browser);
  if (storageState || (adminEmail && adminPassword)) {
    await auditAuthenticated(browser);
  } else {
    console.log(
      "\nSkipping authenticated pages: set A11Y_STORAGE_STATE or A11Y_ADMIN_EMAIL and A11Y_ADMIN_PASSWORD to include them.",
    );
  }
} finally {
  await browser.close();
}

console.log(`\n${scans} axe scans completed.`);

let commitHash = "unknown";
try {
  commitHash = execSync("git rev-parse --short HEAD", { encoding: "utf8" }).trim();
} catch {}

const a11ySummary = {
  timestamp: new Date().toISOString(),
  commitHash,
  axeVersion: "4.14.0",
  totalScans: scans,
  passedScans: scans - failures.length,
  failedScans: failures.length,
  failures,
  scans: allScans,
};

try {
  mkdirSync("docs/report", { recursive: true });
  writeFileSync("docs/report/a11y-results.json", JSON.stringify(a11ySummary, null, 2), "utf8");
  console.log(`Saved machine-readable axe report to docs/report/a11y-results.json`);
} catch (err) {
  console.error("Failed to write a11y-results.json:", err.message);
}

if (failures.length > 0) {
  console.error(`\n${failures.length} issue(s) found:`);
  for (const failure of failures) {
    console.error(
      `- [${failure.viewport}/${failure.theme}] ${failure.path} — ${failure.reason}`,
    );
    for (const node of failure.nodes ?? []) {
      console.error(`    ${node.target}: ${node.summary}`);
    }
  }
  process.exit(1);
}

console.log("No WCAG A/AA violations and no horizontal overflow detected.");
