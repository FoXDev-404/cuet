/**
 * Lighthouse mobile audit runner for key pages in both light and dark themes.
 * Stores raw JSON reports in docs/report/lighthouse/
 * Outputs aggregated scores and top issues.
 */
import { exec, spawn } from "node:child_process";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

const BASE_URL = (
  process.env.BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  "http://localhost:4321"
).replace(/\/$/, "");

const OUTPUT_DIR = join(process.cwd(), "docs", "report", "lighthouse");

const GUEST_HEADERS_FILE = join(OUTPUT_DIR, "headers-guest.json");
const ADMIN_HEADERS_FILE = join(OUTPUT_DIR, "headers-admin.json");

const AUDIT_TARGETS = [
  { id: "home", name: "Home", path: "/" },
  { id: "hubs", name: "Hubs (Mock Test)", path: "/cuet-ug-mock-test" },
  { id: "mock-detail", name: "Mock Detail", path: "/mock/e2e-local-fixture-mock" },
  { id: "instructions", name: "Instructions", path: "/mock/e2e-local-fixture-mock/instructions" },
  { id: "attempt", name: "Attempt Screen", path: "/attempt/4", headerFile: GUEST_HEADERS_FILE, cookie: "cuet_guest=lighthouse_test_token_2026" },
  { id: "result", name: "Result Screen", path: "/result/605", headerFile: GUEST_HEADERS_FILE, cookie: "cuet_guest=lighthouse_test_token_2026" },
  { id: "subject", name: "Subject Page", path: "/cuet-mock-test/english" },
  {
    id: "public-question",
    name: "Public Question Page",
    path: "/q/e2e-fixture-question-01-which-option-uPJRyUwJ3s",
  },
  { id: "admin", name: "Admin Dashboard", path: "/admin", headerFile: ADMIN_HEADERS_FILE, cookie: "cuet_session=lighthouse_admin_test_session_token_2026" },
];

const THEMES = ["light", "dark"];

async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.status >= 200 && res.status < 500) return true;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

function runLighthouseCommand(url, outputPath, theme, headerFile) {
  return new Promise((resolve, reject) => {
    const chromeFlags = `--headless --force-prefers-color-scheme=${theme} --no-sandbox --disable-gpu`;
    let cmd = `npx lighthouse "${url}" --chrome-flags="${chromeFlags}" --output=json --output-path="${outputPath}" --only-categories=performance,accessibility,best-practices,seo --form-factor=mobile --throttling-method=simulate --quiet`;

    if (headerFile && existsSync(headerFile)) {
      cmd += ` --extra-headers="${headerFile}"`;
    }

    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, _stdout, stderr) => {
      if (!error && existsSync(outputPath)) {
        resolve();
      } else {
        reject(new Error(`Lighthouse failed (${error?.code}): ${stderr.slice(0, 300) || error?.message}`));
      }
    });
  });
}

async function main() {
  console.log("================================================================");
  console.log("CUET Free Mock Test — Lighthouse Mobile Runner (Fix 10 Item 6)");
  console.log(`Target Base URL: ${BASE_URL}`);
  console.log(`Output Directory: ${OUTPUT_DIR}`);
  console.log("================================================================\n");

  if (!existsSync(OUTPUT_DIR)) {
    mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  let spawnedServer = null;
  const isAvailable = await waitForServer(`${BASE_URL}/`, 2000);

  if (!isAvailable) {
    console.log(`Base URL ${BASE_URL} not running. Spawning local dev server...`);
    spawnedServer = spawn("npm", ["run", "dev"], {
      stdio: "pipe",
      shell: true,
    });
    const ready = await waitForServer(`${BASE_URL}/`, 60000);
    if (!ready) {
      console.error("FAIL: Could not start local dev server within 60s.");
      if (spawnedServer) spawnedServer.kill();
      process.exit(1);
    }
    console.log("Dev server is ready!\n");
  }

  // Pre-flight check
  console.log("Pre-flight HTTP 200 check for all audit targets...");
  let preflightFailed = false;
  for (const target of AUDIT_TARGETS) {
    const headers = {};
    if (target.cookie) headers.cookie = target.cookie;

    try {
      const res = await fetch(`${BASE_URL}${target.path}`, {
        headers,
        redirect: "manual",
        signal: AbortSignal.timeout(5000),
      });
      if (res.status === 200) {
        console.log(`  [OK 200] ${target.path}`);
      } else if (res.status >= 300 && res.status < 400) {
        console.warn(`  [REDIRECT ${res.status}] ${target.path} -> ${res.headers.get("location")}`);
        preflightFailed = true;
      } else {
        console.error(`  [FAIL ${res.status}] ${target.path}`);
        preflightFailed = true;
      }
    } catch (e) {
      console.error(`  [ERROR] ${target.path}: ${e.message}`);
      preflightFailed = true;
    }
  }

  if (preflightFailed) {
    console.error("\nFAIL: Pre-flight check failed for one or more targets.");
    if (spawnedServer) spawnedServer.kill();
    process.exit(1);
  }

  console.log("\nAll targets returned OK 200! Starting Lighthouse mobile audits...\n");

  const results = [];

  try {
    for (const target of AUDIT_TARGETS) {
      for (const theme of THEMES) {
        const fullUrl = `${BASE_URL}${target.path}`;
        const filename = `${target.id}.${theme}.report.json`;
        const outputPath = join(OUTPUT_DIR, filename);

        console.log(`Auditing [${target.name}] (${theme} theme) at ${target.path}...`);
        const startTime = Date.now();

        try {
          await runLighthouseCommand(fullUrl, outputPath, theme, target.headerFile);
          const duration = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`  -> Completed in ${duration}s. Report saved to ${filename}`);

          const raw = JSON.parse(await readFile(outputPath, "utf8"));
          const categories = raw.categories ?? {};
          const audits = raw.audits ?? {};

          const perf = Math.round((categories.performance?.score ?? 0) * 100);
          const a11y = Math.round((categories.accessibility?.score ?? 0) * 100);
          const bp = Math.round((categories["best-practices"]?.score ?? 0) * 100);
          const seo = Math.round((categories.seo?.score ?? 0) * 100);

          const lcp = audits["largest-contentful-paint"]?.displayValue ?? "N/A";
          const cls = audits["cumulative-layout-shift"]?.displayValue ?? "N/A";
          const tbt = audits["total-blocking-time"]?.displayValue ?? "N/A";

          const failingAudits = Object.values(audits)
            .filter((a) => typeof a.score === "number" && a.score < 0.9 && a.title && a.description)
            .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
            .slice(0, 3)
            .map((a) => a.title);

          results.push({
            page: target.name,
            theme,
            url: target.path,
            perf,
            a11y,
            bp,
            seo,
            lcp,
            cls,
            tbt,
            topIssues: failingAudits.join("; ") || "None",
          });
        } catch (err) {
          console.error(`  -> Failed: ${err.message}`);
          results.push({
            page: target.name,
            theme,
            url: target.path,
            perf: "ERR",
            a11y: "ERR",
            bp: "ERR",
            seo: "ERR",
            lcp: "ERR",
            cls: "ERR",
            tbt: "ERR",
            topIssues: err.message,
          });
        }
      }
    }

    console.log("\n================================================================");
    console.log("LIGHTHOUSE MOBILE AUDIT SUMMARY (9 Pages x 2 Themes)");
    console.log("================================================================");
    console.table(
      results.map((r) => ({
        Page: r.page,
        Theme: r.theme,
        Perf: r.perf,
        A11y: r.a11y,
        "Best Pract": r.bp,
        SEO: r.seo,
        LCP: r.lcp,
        CLS: r.cls,
        TBT: r.tbt,
      }))
    );

    const mdTable = [
      "# Lighthouse Mobile Audit Results",
      "",
      `- **Tool Version:** Lighthouse 13.6.0`,
      `- **Form Factor:** Mobile (emulated screen: 360x640, dpr 2)`,
      `- **Throttling:** Simulated 4G (RTT: 150ms, Throughput: 1.6Mbps, CPU Slowdown: 4x)`,
      `- **Audit Date:** ${new Date().toISOString()}`,
      "",
      "| Page | Theme | Perf | A11y | Best Practices | SEO | LCP | CLS | TBT | Top Issues |",
      "| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |",
      ...results.map(
        (r) =>
          `| ${r.page} | ${r.theme} | ${r.perf} | ${r.a11y} | ${r.bp} | ${r.seo} | ${r.lcp} | ${r.cls} | ${r.tbt} | ${r.topIssues} |`
      ),
      "",
    ].join("\n");

    writeFileSync(join(OUTPUT_DIR, "SUMMARY.md"), mdTable, "utf8");
    console.log(`Summary written to ${join(OUTPUT_DIR, "SUMMARY.md")}`);
  } finally {
    if (spawnedServer) {
      console.log("Stopping spawned dev server...");
      spawnedServer.kill();
    }
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
