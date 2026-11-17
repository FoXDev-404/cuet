/**
 * scripts/lighthouse-audit.mjs
 *
 * Mobile Lighthouse audit and route-budget gate for the production build.
 *
 *   npm run build
 *   npm run audit:lighthouse
 *
 * Defaults: 3 runs per route, light theme, mobile simulated throttling. The
 * runner discovers a published mock and a shared public question from the
 * running app instead of relying on hard-coded content ids, provisions a fresh
 * guest attempt and result, and seeds a disposable local admin session when
 * auditing localhost. `performance-budget.json` is the source of truth for the
 * pass/fail decision; a breach exits non-zero.
 *
 * Options:
 *   --runs=3                     Runs per route/theme (1-10)
 *   --themes=light               Comma-separated: light,dark
 *   --base-url=http://...        Target origin (also LIGHTHOUSE_BASE_URL)
 *   --spawn=auto                 auto | never. Auto starts dist/ with wrangler.
 *
 * Authenticated pages:
 *   LIGHTHOUSE_ADMIN_COOKIE      Full Cookie header (e.g. "cuet_session=...")
 *   LIGHTHOUSE_STORAGE_STATE     Playwright storage-state JSON (A11Y_STORAGE_STATE also works)
 *   Localhost with neither        Seeds a disposable session in local D1.
 *
 * Set LIGHTHOUSE_SKIP_ADMIN=1 to omit /admin. Set LIGHTHOUSE_SKIP_ATTEMPT=1 to
 * skip attempt/result provisioning against a host where writes are unwanted.
 * Set LIGHTHOUSE_PUBLIC_QUESTION=/q/... when the sitemap has no eligible shared
 * question (fixtures are excluded from the sitemap and cannot be audited).
 */

import { exec, execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { join } from "node:path";
import os from "node:os";
import {
  describeFailure,
  evaluateBudget,
  matchRouteBudget,
} from "./lib/perf-budget.mjs";

const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  const prefix = `--${name}=`;
  const match = args.find((value) => value.startsWith(prefix));
  return match ? match.slice(prefix.length) : defaultValue;
}
function hasFlag(name) {
  return args.includes(`--${name}`);
}

if (hasFlag("help")) {
  console.log(
    [
      "Usage: node scripts/lighthouse-audit.mjs [options]",
      "",
      "  --runs=3              Runs per route/theme (default 3, max 10)",
      "  --themes=light        Comma-separated themes: light,dark (default light)",
      "  --base-url=<origin>   Target origin (default http://localhost:4321)",
      "  --spawn=auto          auto | never (default auto: start dist/ with wrangler)",
      "",
      "Budgets are read from performance-budget.json and enforced on the median.",
      "Exit code is 1 when any route exceeds a score, transfer, metric or DOM cap.",
    ].join("\n"),
  );
  process.exit(0);
}

const RUNS = Math.min(10, Math.max(1, Number.parseInt(getArg("runs", "3"), 10) || 3));
const THEMES = [
  ...new Set(
    getArg("themes", "light")
      .split(",")
      .map((theme) => theme.trim().toLowerCase())
      .filter(Boolean),
  ),
];
const INVALID_THEMES = THEMES.filter((theme) => !["light", "dark"].includes(theme));
if (THEMES.length === 0 || INVALID_THEMES.length > 0) {
  console.error(`Invalid --themes value. Use light, dark or light,dark. Got: ${THEMES.join(",") || "<empty>"}`);
  process.exit(1);
}

const BASE_URL = (
  getArg(
    "base-url",
    process.env.LIGHTHOUSE_BASE_URL ??
      process.env.PLAYWRIGHT_BASE_URL ??
      "http://localhost:4321",
  ) ?? "http://localhost:4321"
).replace(/\/+$/, "");
const SITE_ORIGIN = (() => {
  try {
    return new URL(BASE_URL).origin;
  } catch {
    return null;
  }
})();
if (!SITE_ORIGIN) {
  console.error(`Invalid --base-url: ${BASE_URL}`);
  process.exit(1);
}

const SPAWN_MODE = getArg("spawn", "auto");
if (!["auto", "never"].includes(SPAWN_MODE)) {
  console.error(`Invalid --spawn value: ${SPAWN_MODE}. Use auto or never.`);
  process.exit(1);
}

const skipAdmin = /^(1|true|yes)$/i.test(process.env.LIGHTHOUSE_SKIP_ADMIN ?? "");
const skipAttempt = /^(1|true|yes)$/i.test(process.env.LIGHTHOUSE_SKIP_ATTEMPT ?? "");

const ROOT = process.cwd();
const OUTPUT_DIR = join(ROOT, "docs", "report", "lighthouse");
const BUDGET_FILE = join(ROOT, "performance-budget.json");
// Cookie headers are session credentials. Keep them out of the committed
// evidence directory; Lighthouse also copies them into the report config.
const HEADER_DIR = mkdtempSync(join(os.tmpdir(), "cuet-lighthouse-"));
const GUEST_HEADERS_FILE = join(HEADER_DIR, "headers-guest.json");
const ADMIN_HEADERS_FILE = join(HEADER_DIR, "headers-admin.json");
const WRANGLER_BIN = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const DIST_CONFIG = join(ROOT, "dist", "server", "wrangler.json");
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const IS_LOCAL = LOCAL_HOSTS.has(new URL(BASE_URL).hostname);
const LOCAL_ADMIN_EMAIL = "lighthouse-local@cuetfreemocktest.test";

function loadBudget() {
  if (!existsSync(BUDGET_FILE)) {
    throw new Error("performance-budget.json not found. Add route budgets before auditing.");
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(BUDGET_FILE, "utf8"));
  } catch (error) {
    throw new Error(`performance-budget.json is not valid JSON: ${error.message}`);
  }
  if (!parsed.routeBudgets || typeof parsed.routeBudgets !== "object") {
    throw new Error("performance-budget.json has no routeBudgets object.");
  }
  if (!parsed.metrics?.mobileSimulated4G) {
    throw new Error("performance-budget.json has no metrics.mobileSimulated4G caps.");
  }
  return parsed;
}

function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function parseMetricMs(displayValue) {
  if (!displayValue) return null;
  const match = displayValue.match(/([\d,.]+)\s*(s|ms)/i);
  if (!match) return null;
  const num = Number.parseFloat(match[1].replace(/,/g, ""));
  return match[2].toLowerCase() === "s" ? Math.round(num * 1000) : Math.round(num);
}

function auditNumeric(audits, id) {
  const audit = audits?.[id];
  if (!audit) return null;
  if (Number.isFinite(audit.numericValue)) return audit.numericValue;
  return parseMetricMs(audit.displayValue);
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(2_000) });
      if (response.status >= 200 && response.status < 500) return true;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return false;
}

function runLighthouseCommand(url, outputPath, theme, headerFile) {
  return new Promise((resolve, reject) => {
    const chromeFlags = `--headless --force-prefers-color-scheme=${theme} --no-sandbox --disable-gpu`;
    let command = `npx lighthouse "${url}" --chrome-flags="${chromeFlags}" --output=json --output-path="${outputPath}" --only-categories=performance,accessibility,best-practices,seo --form-factor=mobile --throttling-method=simulate --quiet`;
    if (headerFile && existsSync(headerFile)) {
      command += ` --extra-headers="${headerFile}"`;
    }

    exec(command, { maxBuffer: 32 * 1024 * 1024, timeout: 300_000 }, (error, _stdout, stderr) => {
      if (!error && existsSync(outputPath)) {
        resolve();
      } else {
        reject(
          new Error(
            `Lighthouse failed (${error?.code ?? "unknown"}): ${
              stderr?.slice(0, 300) || error?.message || "no output"
            }`,
          ),
        );
      }
    });
  });
}

/**
 * Lighthouse copies the --extra-headers values into configSettings.extraHeaders.
 * The raw JSON is committed as audit evidence, so strip the Cookie header
 * before it ever reaches the repository. Edit the text (instead of a
 * JSON.parse/stringify round-trip) so the diff stays limited to the header.
 */
function readSanitizedReport(outputPath) {
  const text = readFileSync(outputPath, "utf8");
  let cleaned = text.replace(/,\s*"extraHeaders"\s*:\s*\{[^}]*\}/, "");
  // Defensive fallback if Lighthouse ever emits the key first or changes its
  // formatting: a parse/stringify round-trip still removes the credential.
  if (cleaned.includes('"extraHeaders"')) {
    const raw = JSON.parse(cleaned);
    if (raw?.configSettings?.extraHeaders) {
      delete raw.configSettings.extraHeaders;
      cleaned = JSON.stringify(raw, null, 2);
    }
  }
  if (cleaned !== text) writeFileSync(outputPath, cleaned, "utf8");
  return JSON.parse(cleaned);
}

function cookieHeaderFromStorageState(file) {
  if (!file) return null;
  if (!existsSync(file)) {
    console.warn(`  -> Storage state not found: ${file}`);
    return null;
  }
  try {
    const state = JSON.parse(readFileSync(file, "utf8"));
    const cookies = Array.isArray(state.cookies) ? state.cookies : [];
    const header = cookies
      .filter((cookie) => cookie && cookie.name && typeof cookie.value === "string")
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");
    return header || null;
  } catch (error) {
    console.warn(`  -> Could not read storage state: ${error.message}`);
    return null;
  }
}

/**
 * Create a disposable admin session in the local D1 database. The product has
 * no password form, so this mirrors the E2E/a11y fixtures: seed the user, the
 * admin row and a session whose id is the SHA-256 of the cookie token.
 */
function seedLocalAdminSession() {
  if (!existsSync(WRANGLER_BIN)) {
    throw new Error("wrangler is not installed; run npm install first.");
  }
  const token = randomBytes(32).toString("hex");
  const sessionId = createHash("sha256").update(token).digest("hex");
  const sql = [
    `DELETE FROM sessions WHERE user_id = (SELECT id FROM users WHERE lower(email) = lower('${LOCAL_ADMIN_EMAIL}'));`,
    `INSERT OR IGNORE INTO users (username, email, password_hash) VALUES ('lighthouse_local_admin', '${LOCAL_ADMIN_EMAIL}', NULL);`,
    `INSERT OR IGNORE INTO admins (email, role, is_active) VALUES ('${LOCAL_ADMIN_EMAIL}', 'super', 1);`,
    `UPDATE admins SET is_active = 1, role = 'super' WHERE lower(email) = lower('${LOCAL_ADMIN_EMAIL}');`,
    `INSERT INTO sessions (id, user_id, expires_at) SELECT '${sessionId}', id, datetime('now', '+30 days') FROM users WHERE lower(email) = lower('${LOCAL_ADMIN_EMAIL}');`,
  ].join("\n");

  execFileSync(
    process.execPath,
    [
      WRANGLER_BIN,
      "d1",
      "execute",
      "cuet-blueprint-db",
      "--local",
      "--persist-to",
      ".wrangler/state",
      "--command",
      sql,
    ],
    { cwd: ROOT, stdio: "pipe", timeout: 120_000 },
  );
  return `cuet_session=${token}`;
}

function resolveAdminCookie() {
  const explicit = process.env.LIGHTHOUSE_ADMIN_COOKIE?.trim();
  if (explicit) {
    console.log("  -> Using LIGHTHOUSE_ADMIN_COOKIE for authenticated pages.");
    return explicit;
  }

  const storageState =
    process.env.LIGHTHOUSE_STORAGE_STATE ?? process.env.A11Y_STORAGE_STATE;
  const fromStorage = cookieHeaderFromStorageState(storageState);
  if (fromStorage) {
    console.log("  -> Using the supplied storage state for authenticated pages.");
    return fromStorage;
  }

  if (IS_LOCAL) {
    try {
      const cookie = seedLocalAdminSession();
      console.log("  -> Seeded a disposable local admin session.");
      return cookie;
    } catch (error) {
      console.warn(`  -> Local admin seed failed: ${error.message}`);
    }
  }

  return null;
}

function spawnPreviewServer() {
  if (!existsSync(DIST_CONFIG)) {
    throw new Error("dist/server/wrangler.json not found. Run `npm run build` first.");
  }
  if (!existsSync(WRANGLER_BIN)) {
    throw new Error("wrangler is not installed; run npm install first.");
  }

  const port = new URL(BASE_URL).port || "4321";
  const child = spawn(
    process.execPath,
    [
      WRANGLER_BIN,
      "dev",
      "--config",
      "dist/server/wrangler.json",
      "--persist-to",
      ".wrangler/state",
      "--port",
      port,
      "--var",
      "USE_LOCAL_D1:1",
      "--var",
      `SITE_URL:${SITE_ORIGIN}`,
      "--var",
      "ENV:development",
    ],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], windowsHide: true },
  );

  child.stdout?.on("data", () => {});
  child.stderr?.on("data", () => {});
  return child;
}

function stopSpawnedServer(child) {
  if (!child?.pid) return;
  try {
    if (process.platform === "win32") {
      execFileSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      child.kill("SIGTERM");
    }
  } catch {}
}

async function fetchText(pathname, headers = {}) {
  try {
    const response = await fetch(`${BASE_URL}${pathname}`, {
      headers,
      redirect: "follow",
      signal: AbortSignal.timeout(15_000),
    });
    return response.ok ? response.text() : null;
  } catch {
    return null;
  }
}

async function discoverMockSlug() {
  const html = await fetchText("/mock-tests");
  if (!html) return null;
  // The library links straight to /mock/<slug>/instructions; accept the
  // detail page too so a future hub redesign does not break discovery.
  for (const match of html.matchAll(/href="\/mock\/([^"/?#]+)(?:\/[^"?#]*)?"/g)) {
    const slug = match[1];
    if (/^[a-z0-9-]+$/i.test(slug)) return slug;
  }
  return null;
}

async function discoverMockId(slug) {
  const html = await fetchText(`/mock/${encodeURIComponent(slug)}/instructions`);
  if (!html) return null;
  const match = html.match(/data-mock-id="(\d+)"/);
  return match ? Number(match[1]) : null;
}

async function sitemapQuestionPath() {
  const sitemap = await fetchText("/sitemap.xml");
  if (!sitemap) return null;
  const match = sitemap.match(/<loc>([^<]*\/q\/[^<]+)<\/loc>/);
  if (!match) return null;
  try {
    return new URL(match[1]).pathname;
  } catch {
    return null;
  }
}

async function discoverSharedQuestion() {
  const override = process.env.LIGHTHOUSE_PUBLIC_QUESTION?.trim();
  if (override) {
    if (override.startsWith("/q/")) return override;
    console.warn("  -> LIGHTHOUSE_PUBLIC_QUESTION must start with /q/; ignoring it.");
  }

  // The sitemap is the production source of truth: fixtures and noindex
  // questions are excluded there, so they are never audited as public pages.
  const discovered = await sitemapQuestionPath();
  if (discovered) return discovered;

  const fallback = "/q/uPJRyUwJ3s";
  try {
    const response = await fetch(`${BASE_URL}${fallback}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 200 || response.status === 301) return fallback;
  } catch {}
  return null;
}

async function postJson(pathname, body, cookie) {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      origin: SITE_ORIGIN,
      ...(cookie ? { cookie } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${text.slice(0, 180)}`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Expected JSON from ${pathname}`);
  }
}

async function provisionAttempts(mockId, guestCookie) {
  const submitted = await postJson("/api/attempts/start", { mockId }, guestCookie);
  if (!submitted.attemptId) throw new Error("Attempt start returned no attemptId.");
  await postJson(`/api/attempts/${submitted.attemptId}/submit`, {}, guestCookie);

  const active = await postJson("/api/attempts/start", { mockId }, guestCookie);
  if (!active.attemptId) throw new Error("Second attempt start returned no attemptId.");

  return {
    resultPath: `/result/${submitted.attemptId}`,
    attemptPath: `/attempt/${active.attemptId}`,
  };
}

async function preflight(target) {
  try {
    const response = await fetch(`${BASE_URL}${target.path}`, {
      headers: target.cookie ? { cookie: target.cookie } : {},
      redirect: "manual",
      signal: AbortSignal.timeout(5_000),
    });
    if (response.status === 200) {
      console.log(`  [OK 200] ${target.name} (${target.path})`);
      return true;
    }
    if (response.status >= 300 && response.status < 400) {
      console.error(`  [REDIRECT ${response.status}] ${target.path} -> ${response.headers.get("location")}`);
    } else {
      console.error(`  [FAIL ${response.status}] ${target.path}`);
    }
  } catch (error) {
    console.error(`  [ERROR] ${target.path}: ${error.message}`);
  }
  return false;
}

function toMarkdown(results, failures) {
  const themes = [...new Set(results.map((row) => row.theme))];
  const lighthouseVersions =
    [...new Set(results.map((row) => row.lighthouseVersion))].filter(Boolean).join(", ") ||
    "unknown";
  const lines = [
    "# Lighthouse Mobile Audit Results",
    "",
    `*Audited against ${BASE_URL} on ${new Date().toISOString()}*`,
    `- **Tool:** Lighthouse (via npx) ${lighthouseVersions}, mobile emulation, simulated 4G throttling`,
    `- **Method:** ${RUNS} independent run(s) per route and theme; scores and metrics are medians.`,
    `- **Themes:** ${themes.join(", ") || "none"}`,
    `- **Environment:** Windows/Linux runner, Node.js ${process.version}, Host: ${os.hostname()}`,
    `- **Budgets:** \`performance-budget.json\` — route transfer/score plus LCP, TBT, CLS, FCP, Speed Index and total DOM caps.`,
    "",
    "| Page | Theme | Runs | Perf [min-max] | A11y | Best Practices | SEO | LCP | TBT | CLS | Transfer | Budget |",
    "| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |",
    ...results.map(
      (row) =>
        `| ${row.page} | ${row.theme} | ${row.runs} | **${row.perfMedian}** [${row.perfMin}-${row.perfMax}] | ${row.a11y} | ${row.bp} | ${row.seo} | ${(row.lcpMs / 1000).toFixed(2)}s | ${row.tbtMs}ms | ${row.cls} | ${row.transferKb} KB | ${row.budgetPass ? "PASS" : "FAIL"} (${row.budgetPattern ?? "no budget"}) |`,
    ),
    "",
    "## Budget results",
    "",
  ];

  if (failures.length === 0) {
    lines.push("All audited routes passed their budgets.");
  } else {
    lines.push("The following checks failed:", "");
    for (const failure of failures) lines.push(`- ${failure}`);
  }

  lines.push(
    "",
    "> `maxInitialDomNodes` is evaluated against Lighthouse's `dom-size` audit, which counts total DOM nodes. Total DOM is an upper bound for the initial count, so this check is conservative.",
    "",
  );
  return lines.join("\n");
}

async function main() {
  console.log("================================================================");
  console.log("CUET Free Mock Test — Lighthouse mobile audit and budget gate");
  console.log(`Target: ${BASE_URL}`);
  console.log(`Runs per route/theme: ${RUNS}`);
  console.log(`Themes: ${THEMES.join(", ")}`);
  console.log(`Budget file: ${BUDGET_FILE}`);
  console.log("================================================================\n");

  const budget = loadBudget();
  console.log(
    `Loaded ${Object.keys(budget.routeBudgets).length} route budgets and the ${Object.keys(budget.metrics.mobileSimulated4G).length}-metric mobile cap set.\n`,
  );

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const guestToken = `lighthouse_${randomBytes(16).toString("hex")}`;
  const guestCookie = `cuet_guest=${guestToken}`;
  writeFileSync(GUEST_HEADERS_FILE, JSON.stringify({ Cookie: guestCookie }), "utf8");

  let spawnedServer = null;
  try {
    const available = await waitForServer(`${BASE_URL}/`, 2_000);
    if (!available) {
      if (SPAWN_MODE === "never") {
        throw new Error(`No server at ${BASE_URL} and --spawn=never.`);
      }
      if (!IS_LOCAL) {
        throw new Error(`No server at ${BASE_URL}. Start it or use --spawn=never with a reachable host.`);
      }
      console.log(`No server at ${BASE_URL}; starting the production build with wrangler...`);
      spawnedServer = spawnPreviewServer();
      if (!(await waitForServer(`${BASE_URL}/`, 120_000))) {
        throw new Error("The production preview did not become ready within 120s.");
      }
      console.log("Production preview is ready.\n");
    }

    let adminCookie = null;
    if (!skipAdmin) {
      adminCookie = resolveAdminCookie();
      if (adminCookie) {
        writeFileSync(ADMIN_HEADERS_FILE, JSON.stringify({ Cookie: adminCookie }), "utf8");
      } else {
        console.warn("  -> No admin session available; /admin will be skipped.");
      }
    } else {
      console.log("  -> LIGHTHOUSE_SKIP_ADMIN is set; /admin will be skipped.");
    }

    const targets = [
      { id: "home", name: "Home", path: "/" },
      { id: "hubs", name: "Mock Test Hub", path: "/mock-tests" },
      { id: "subject", name: "Subject Hub", path: "/cuet-mock-test/english" },
    ];

    const slug = await discoverMockSlug();
    if (!slug) {
      throw new Error("Could not discover a published mock from /mock-tests.");
    }
    console.log(`Discovered mock: ${slug}`);
    targets.push(
      { id: "mock-detail", name: "Mock Detail", path: `/mock/${slug}` },
      { id: "instructions", name: "Instructions", path: `/mock/${slug}/instructions` },
    );

    if (!skipAttempt) {
      const mockId = await discoverMockId(slug);
      if (!mockId) throw new Error(`Could not read data-mock-id for /mock/${slug}.`);
      try {
        const { resultPath, attemptPath } = await provisionAttempts(mockId, guestCookie);
        console.log(`Provisioned result: ${resultPath}`);
        console.log(`Provisioned attempt: ${attemptPath}`);
        targets.push(
          {
            id: "attempt",
            name: "Attempt Screen",
            path: attemptPath,
            cookie: guestCookie,
            headerFile: GUEST_HEADERS_FILE,
          },
          {
            id: "result",
            name: "Result Screen",
            path: resultPath,
            cookie: guestCookie,
            headerFile: GUEST_HEADERS_FILE,
          },
        );
      } catch (error) {
        throw new Error(`Could not provision attempt/result pages: ${error.message}`);
      }
    } else {
      console.log("LIGHTHOUSE_SKIP_ATTEMPT is set; attempt/result pages will be skipped.");
    }

    const sharedQuestionPath = await discoverSharedQuestion();
    if (sharedQuestionPath) {
      targets.push({
        id: "public-question",
        name: "Public Question",
        path: sharedQuestionPath,
      });
    } else {
      console.warn("No shared public question found; /q/[id] will be skipped.");
    }

    if (adminCookie) {
      targets.push({
        id: "admin",
        name: "Admin Dashboard",
        path: "/admin",
        cookie: adminCookie,
        headerFile: ADMIN_HEADERS_FILE,
      });
    }

    console.log("\nPre-flight HTTP 200 check for all audit targets...");
    const readyTargets = [];
    for (const target of targets) {
      if (await preflight(target)) readyTargets.push(target);
    }
    if (readyTargets.length !== targets.length) {
      throw new Error("Pre-flight failed for one or more targets.");
    }

    console.log(
      `\nAll ${readyTargets.length} targets returned 200. Starting ${RUNS} run(s) per route/theme...\n`,
    );

    const results = [];
    const budgetFailures = [];

    for (const target of readyTargets) {
      for (const theme of THEMES) {
        const fullUrl = `${BASE_URL}${target.path}`;
        console.log(`\nAuditing [${target.name}] (${theme}) across ${RUNS} run(s)...`);

        const runData = {
          perf: [],
          a11y: [],
          bp: [],
          seo: [],
          lcpMs: [],
          tbtMs: [],
          cls: [],
          fcpMs: [],
          speedIndexMs: [],
          transferKb: [],
          domNodes: [],
          lighthouseVersions: new Set(),
          topIssues: new Set(),
        };

        for (let run = 1; run <= RUNS; run += 1) {
          const outputPath = join(OUTPUT_DIR, `${target.id}.${theme}.run${run}.json`);
          process.stdout.write(`  Run ${run}/${RUNS}... `);
          const started = Date.now();

          try {
            await runLighthouseCommand(fullUrl, outputPath, theme, target.headerFile);
            const raw = readSanitizedReport(outputPath);
            const categories = raw.categories ?? {};
            const audits = raw.audits ?? {};

            const performanceScore = Math.round((categories.performance?.score ?? 0) * 100);
            const accessibilityScore = Math.round((categories.accessibility?.score ?? 0) * 100);
            const bestPracticesScore = Math.round(
              (categories["best-practices"]?.score ?? 0) * 100,
            );
            const seoScore = Math.round((categories.seo?.score ?? 0) * 100);

            const lcp = auditNumeric(audits, "largest-contentful-paint");
            const tbt = auditNumeric(audits, "total-blocking-time");
            const cls = auditNumeric(audits, "cumulative-layout-shift");
            const fcp = auditNumeric(audits, "first-contentful-paint");
            const speedIndex = auditNumeric(audits, "speed-index");
            const transferBytes = auditNumeric(audits, "total-byte-weight");
            // Lighthouse 13.6 renamed dom-size to dom-size-insight. Accept
            // both so a runner upgrade does not silently skip the DOM cap.
            const domNodes =
              auditNumeric(audits, "dom-size") ?? auditNumeric(audits, "dom-size-insight");

            const missing = Object.entries({
              LCP: lcp,
              TBT: tbt,
              CLS: cls,
              FCP: fcp,
              "Speed Index": speedIndex,
              "Transfer size": transferBytes,
              "DOM nodes": domNodes,
            })
              .filter(([, value]) => value === null)
              .map(([name]) => name);

            if (missing.length > 0) {
              throw new Error(`Lighthouse report is missing: ${missing.join(", ")}`);
            }

            runData.perf.push(performanceScore);
            runData.a11y.push(accessibilityScore);
            runData.bp.push(bestPracticesScore);
            runData.seo.push(seoScore);
            runData.lcpMs.push(lcp);
            runData.tbtMs.push(tbt);
            runData.cls.push(cls);
            runData.fcpMs.push(fcp);
            runData.speedIndexMs.push(speedIndex);
            runData.transferKb.push(transferBytes / 1024);
            runData.domNodes.push(domNodes);
            if (raw.lighthouseVersion) {
              runData.lighthouseVersions.add(raw.lighthouseVersion);
            }

            Object.values(audits)
              .filter(
                (audit) =>
                  typeof audit.score === "number" &&
                  audit.score < 0.9 &&
                  audit.title &&
                  audit.description,
              )
              .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
              .slice(0, 2)
              .forEach((audit) => runData.topIssues.add(audit.title));

            process.stdout.write(`done (${((Date.now() - started) / 1000).toFixed(1)}s)\n`);
          } catch (error) {
            process.stdout.write(`FAILED: ${error.message}\n`);
          }
        }

        const minimumSamples = RUNS >= 3 ? Math.ceil((RUNS * 2) / 3) : 1;
        if (runData.perf.length < minimumSamples) {
          const detail =
            runData.perf.length === 0
              ? "every Lighthouse run failed"
              : `only ${runData.perf.length}/${RUNS} Lighthouse runs succeeded`;
          budgetFailures.push(`${target.path} (${theme}): ${detail}`);
          results.push({
            page: target.name,
            theme,
            url: target.path,
            runs: runData.perf.length,
            perfMedian: 0,
            perfMin: 0,
            perfMax: 0,
            a11y: 0,
            bp: 0,
            seo: 0,
            lcpMs: 0,
            tbtMs: 0,
            cls: 0,
            transferKb: 0,
            domNodes: 0,
            budgetPattern: null,
            budgetPass: false,
            budgetChecks: [],
            topIssues: detail,
            lighthouseVersion: "not captured",
          });
          continue;
        }

        const metrics = {
          performanceScore: round(median(runData.perf)),
          transferKb: round(median(runData.transferKb), 1),
          lcpMs: round(median(runData.lcpMs)),
          tbtMs: round(median(runData.tbtMs)),
          cls: round(median(runData.cls), 3),
          fcpMs: round(median(runData.fcpMs)),
          speedIndexMs: round(median(runData.speedIndexMs)),
          domNodes: round(median(runData.domNodes)),
        };

        const matched = matchRouteBudget(budget.routeBudgets, target.path);
        const evaluation = evaluateBudget({
          budget: matched?.budget,
          metrics,
          metricsBudgets: budget.metrics.mobileSimulated4G,
          limits: budget.limits ?? {},
        });

        for (const failed of evaluation.checks.filter((entry) => !entry.pass)) {
          budgetFailures.push(describeFailure(`${target.path} (${theme})`, failed));
        }

        results.push({
          page: target.name,
          theme,
          url: target.path,
          runs: runData.perf.length,
          perfMedian: metrics.performanceScore,
          perfMin: Math.min(...runData.perf),
          perfMax: Math.max(...runData.perf),
          a11y: round(median(runData.a11y)),
          bp: round(median(runData.bp)),
          seo: round(median(runData.seo)),
          lcpMs: metrics.lcpMs,
          tbtMs: metrics.tbtMs,
          cls: metrics.cls,
          fcpMs: metrics.fcpMs,
          speedIndexMs: metrics.speedIndexMs,
          transferKb: metrics.transferKb,
          domNodes: metrics.domNodes,
          budgetPattern: matched?.pattern ?? null,
          budgetPass: evaluation.pass,
          budgetChecks: evaluation.checks,
          topIssues: Array.from(runData.topIssues).slice(0, 3).join("; ") || "None",
          lighthouseVersion:
            Array.from(runData.lighthouseVersions).sort().join(", ") || "unknown",
        });
      }
    }

    console.log("\n================================================================");
    console.log(`LIGHTHOUSE MOBILE SUMMARY (${RUNS} run median, ${THEMES.join("/")})`);
    console.log("================================================================\n");

    console.table(
      results.map((row) => ({
        Page: row.page,
        Theme: row.theme,
        "Perf (med [min-max])": `${row.perfMedian} [${row.perfMin}-${row.perfMax}]`,
        A11y: row.a11y,
        "Best Pract": row.bp,
        SEO: row.seo,
        LCP: `${(row.lcpMs / 1000).toFixed(2)}s`,
        TBT: `${row.tbtMs}ms`,
        CLS: row.cls,
        Transfer: `${row.transferKb} KB`,
        Budget: row.budgetPass ? "PASS" : "FAIL",
      })),
    );

    writeFileSync(
      join(OUTPUT_DIR, "lighthouse-results.json"),
      JSON.stringify(results, null, 2),
      "utf8",
    );
    writeFileSync(join(OUTPUT_DIR, "SUMMARY.md"), toMarkdown(results, budgetFailures), "utf8");

    console.log(`\nSummary: ${join(OUTPUT_DIR, "SUMMARY.md")}`);
    console.log(`Results: ${join(OUTPUT_DIR, "lighthouse-results.json")}`);

    if (budgetFailures.length > 0) {
      console.error(`\nFAIL: ${budgetFailures.length} performance budget check(s) failed:`);
      for (const failure of budgetFailures) console.error(`  - ${failure}`);
      console.error("\nFix the route, or revise performance-budget.json deliberately.");
      process.exitCode = 1;
    } else {
      console.log("\nPASS: every audited route is within its performance budget.");
    }
  } finally {
    rmSync(HEADER_DIR, { recursive: true, force: true });
    if (spawnedServer) {
      console.log("Stopping the spawned preview...");
      stopSpawnedServer(spawnedServer);
    }
  }
}

main().catch((error) => {
  console.error(`\nFATAL: ${error.message}`);
  process.exitCode = 1;
});
