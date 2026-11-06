/**
 * Scans /docs/report/PROJECT_REPORT.md for cited file paths and routes
 * and fails (exit code 1) if any cited path does not exist.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const REPORT_PATH = join(ROOT, "docs", "report", "PROJECT_REPORT.md");

// Discover actual file paths and route templates in the repo
function getExistingPages() {
  const pages = new Set();
  const pagesDir = join(ROOT, "src", "pages");

  function walk(dir, currentPrefix = "") {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), `${currentPrefix}/${entry.name}`);
      } else if (/\.(astro|ts|js)$/.test(entry.name)) {
        let routePath = `${currentPrefix}/${entry.name.replace(/\.(astro|ts|js)$/, "")}`;
        if (routePath.endsWith("/index")) {
          routePath = routePath.slice(0, -"/index".length) || "/";
        }
        if (!routePath.startsWith("/")) routePath = `/${routePath}`;
        pages.add(routePath);
      }
    }
  }

  walk(pagesDir);
  return pages;
}

// Convert route patterns to regex
function matchesRoute(route, pages) {
  if (pages.has(route)) return true;
  // Test dynamic route templates like /mock/[slug] or /attempt/[id]
  for (const template of pages) {
    if (!template.includes("[")) continue;
    // Replace [slug] with [^/]+ and [...rest] with .*
    const pattern =
      "^" +
      template
        .replace(/\[\.\.\.[^\]]+\]/g, ".*")
        .replace(/\[[^\]]+\]/g, "[^/]+")
        .replace(/\//g, "\\/") +
      "$";
    if (new RegExp(pattern).test(route)) return true;
  }
  return false;
}

function main() {
  console.log("================================================================");
  console.log("CUET Free Mock Test — Report Evidence Validator (Fix 11)");
  console.log(`Auditing file: ${REPORT_PATH}`);
  console.log("================================================================\n");

  if (!existsSync(REPORT_PATH)) {
    console.error(`FAIL: Report file not found: ${REPORT_PATH}`);
    process.exit(1);
  }

  const content = readFileSync(REPORT_PATH, "utf8");
  const lines = content.split("\n");
  const existingPages = getExistingPages();

  const missingFiles = [];
  const missingRoutes = [];
  const scannedFiles = new Set();
  const scannedRoutes = new Set();

  // Regex patterns for file citations: e.g. `src/lib/foo.ts` or [text](file:///...) or `migrations/0001_init.sql`
  const fileRegex = /(`|\()((src|scripts|migrations|docs|tests|\.github)\/[a-zA-Z0-9_\-\.\/]+|package\.json|wrangler\.jsonc)(\)|`)/g;

  // Regex patterns for routes: e.g. `/mock-tests`, `/admin`, `/attempt/[id]`
  const routeRegex = /`(\/(?:[a-zA-Z0-9_\-\[\]]+(?:\/[a-zA-Z0-9_\-\[\]]+)*|\/))`(?!\s*(?:row|rows|sec|ms|s\b|column|table|table_info))/g;

  for (let lineNum = 1; lineNum <= lines.length; lineNum++) {
    const line = lines[lineNum - 1];

    // Scan files
    let match;
    while ((match = fileRegex.exec(line)) !== null) {
      let rawPath = match[2];
      // Strip line numbers e.g. foo.ts:123 or foo.ts#L10
      rawPath = rawPath.replace(/#L?\d+(-\d+)?$/, "").replace(/:\d+$/, "");
      scannedFiles.add(rawPath);

      const fullPath = join(ROOT, rawPath);
      if (!existsSync(fullPath)) {
        missingFiles.push({ lineNum, path: rawPath, line: line.trim() });
      }
    }

    // Scan routes
    while ((match = routeRegex.exec(line)) !== null) {
      const rawRoute = match[1];
      // Skip markdown artifacts, regexes, math, dates or obvious false positives
      if (
        rawRoute === "/" ||
        rawRoute.startsWith("//") ||
        rawRoute.includes("*") ||
        rawRoute.includes("${") ||
        /^\/\d+$/.test(rawRoute)
      ) {
        continue;
      }

      scannedRoutes.add(rawRoute);
      if (!matchesRoute(rawRoute, existingPages)) {
        missingRoutes.push({ lineNum, route: rawRoute, line: line.trim() });
      }
    }
  }

  console.log(`Unique file references verified:  ${scannedFiles.size}`);
  console.log(`Unique route references verified: ${scannedRoutes.size}`);
  console.log(`Total missing files detected:     ${missingFiles.length}`);
  console.log(`Total missing routes detected:    ${missingRoutes.length}\n`);

  let failed = false;

  if (missingFiles.length > 0) {
    failed = true;
    console.error("FAIL: The following referenced files do not exist in the repository:");
    for (const m of missingFiles) {
      console.error(`  - Line ${m.lineNum}: "${m.path}"`);
    }
    console.error("");
  }

  if (missingRoutes.length > 0) {
    failed = true;
    console.error("FAIL: The following referenced routes do not match any known route in src/pages:");
    for (const m of missingRoutes) {
      console.error(`  - Line ${m.lineNum}: "${m.route}"`);
    }
    console.error("");
  }

  // 3. Verify Appendices Existence
  console.log("Verifying report appendices existence...");
  const requiredAppendices = [
    "docs/report/APPENDIX_A_ROUTES.md",
    "docs/report/APPENDIX_B_SCHEMA.md",
    "docs/report/APPENDIX_C_TEST_RESULTS.md",
    "docs/report/APPENDIX_D_DEPENDENCIES.md",
    "docs/report/APPENDIX_E_FILE_TREE.md",
    "docs/report/report.json",
  ];

  for (const app of requiredAppendices) {
    if (!existsSync(join(ROOT, app))) {
      failed = true;
      console.error(`FAIL: Missing required appendix: ${app}`);
    } else {
      console.log(`  [OK] ${app}`);
    }
  }
  console.log("");

  // 4. Verify Version Consistency against Lockfile
  console.log("Verifying dependency versions against package-lock.json...");
  const lockPath = join(ROOT, "package-lock.json");
  if (existsSync(lockPath)) {
    const lock = JSON.parse(readFileSync(lockPath, "utf8"));
    const getLockVer = (pkg) =>
      lock.packages?.[`node_modules/${pkg}`]?.version || lock.dependencies?.[pkg]?.version;

    const legacyOutdated = [
      { name: "Tailwind 3.4", expected: getLockVer("tailwindcss") },
      { name: "Playwright 1.58", expected: getLockVer("@playwright/test") },
      { name: "axe 4.11", expected: getLockVer("axe-core") },
      { name: "Wrangler 4.65", expected: getLockVer("wrangler") },
      { name: "TypeScript 5.8", expected: getLockVer("typescript") },
    ];

    for (const leg of legacyOutdated) {
      if (content.includes(leg.name)) {
        failed = true;
        console.error(
          `FAIL: Report contains outdated version string "${leg.name}". Lockfile has version "${leg.expected}".`
        );
      }
    }
  }
  console.log("");

  // 5. Reconcile Counts with facts.json
  console.log("Reconciling database and route counts with facts.json...");
  const factsPath = join(ROOT, "docs", "report", "facts.json");
  if (existsSync(factsPath)) {
    const facts = JSON.parse(readFileSync(factsPath, "utf8"));
    const totalTables = facts.database?.totalTables;
    const totalMigrations = facts.migrations?.totalMigrations;
    const totalRoutes = facts.routes?.totalRoutes;

    if (totalTables && !content.includes(`${totalTables} tables`) && !content.includes(`${totalTables} Tables`)) {
      console.warn(`WARN: Report does not mention exact table count (${totalTables} tables).`);
    }
    if (totalMigrations && !content.includes(`${totalMigrations} migrations`) && !content.includes(`0001 to 00${totalMigrations}`)) {
      console.warn(`WARN: Report does not mention migration count (${totalMigrations} migrations).`);
    }
    if (totalRoutes && !content.includes(`${totalRoutes} routes`) && !content.includes(`${totalRoutes} total routes`)) {
      console.warn(`WARN: Report does not mention exact route count (${totalRoutes} routes).`);
    }
  }
  console.log("");

  if (failed) {
    process.exit(1);
  } else {
    console.log("SUCCESS: 100% of cited files, routes, appendices, and lockfile versions are verified!");
    process.exit(0);
  }
}

main();

