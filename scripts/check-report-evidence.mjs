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

  // Regex patterns for routes: e.g. `/cuet-ug-mock-test`, `/admin`, `/attempt/[id]`
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

  if (failed) {
    process.exit(1);
  } else {
    console.log("SUCCESS: 100% of cited files and routes exist and are verified!");
    process.exit(0);
  }
}

main();

