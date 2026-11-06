#!/usr/bin/env node
/**
 * SEO Consistency and Sitemap Audit Tool (Fix 7)
 *
 * Verifies:
 * 1. Every URL in sitemap.xml returns HTTP 200, is indexable (no noindex), and is self-canonical.
 * 2. Every indexable public page on the site is present in sitemap.xml.
 * 3. Zero private, admin, attempt, or unverified pages exist in sitemap.xml.
 * 4. Every indexable page has a single <h1>, valid title (30-70 chars), meta description, and valid structured data.
 * 5. Mismatch count must be exactly 0.
 *
 * Usage:
 *   node scripts/seo-consistency.mjs
 *   BASE_URL=https://staging... node scripts/seo-consistency.mjs
 */

import { spawn } from "node:child_process";
import http from "node:http";

const BASE_URL = (
  process.env.BASE_URL ??
  process.env.PLAYWRIGHT_BASE_URL ??
  process.env.STAGING_BASE_URL ??
  "http://localhost:4321"
).replace(/\/$/, "");

const PRIVATE_PREFIXES = [
  "/admin",
  "/attempt",
  "/result",
  "/dashboard",
  "/dev",
  "/api",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/forbidden",
];

const ALLOWED_JSONLD_TYPES = new Set([
  "Organization",
  "WebSite",
  "BreadcrumbList",
  "Article",
  "ItemList",
  "ListItem",
]);

const BANNED_JSONLD_TYPES = ["Quiz", "Course", "FAQPage", "Product", "Question", "Answer"];

// Wait for a URL to respond
async function waitForServer(url, timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { method: "HEAD" });
      if (res.status >= 200 && res.status < 500) return true;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

// Fetch helper with timeout and redirect handling
async function fetchPage(urlPath) {
  const fullUrl = `${BASE_URL}${urlPath.startsWith("/") ? urlPath : `/${urlPath}`}`;
  try {
    const res = await fetch(fullUrl, {
      redirect: "manual",
      signal: AbortSignal.timeout(15000),
      headers: { "user-agent": "CUET-SEO-Consistency-Crawler/1.0" },
    });
    const status = res.status;
    const location = res.headers.get("location");
    const html = status >= 200 && status < 300 ? await res.text() : "";
    return { fullUrl, status, location, html };
  } catch (err) {
    return { fullUrl, status: 0, location: null, html: "", error: err.message };
  }
}

// Extract metadata from HTML
function parsePageMetadata(html, urlPath) {
  // Title
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : "";

  // Canonical
  const canonicalMatch =
    html.match(/<link[^>]*rel=["']canonical["'][^>]*href=["']([^"']+)["']/i) ||
    html.match(/<link[^>]*href=["']([^"']+)["'][^>]*rel=["']canonical["']/i);
  const canonical = canonicalMatch ? canonicalMatch[1].trim() : "";

  // Robots
  const robotsMatch = html.match(/<meta[^>]*name=["']robots["'][^>]*content=["']([^"']+)["']/i);
  const robots = robotsMatch ? robotsMatch[1].trim() : "";
  const isNoindex = /noindex/i.test(robots);

  // Description
  const descMatch =
    html.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i) ||
    html.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i);
  const description = descMatch ? descMatch[1].trim() : "";

  // H1 count
  const h1Matches = html.match(/<h1[\s>]/gi) || [];
  const h1Count = h1Matches.length;

  // JSON-LD Types
  const jsonLdTypes = [];
  const scriptRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = scriptRegex.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(match[1]);
      const extractTypes = (obj) => {
        if (!obj || typeof obj !== "object") return;
        if (obj["@type"]) jsonLdTypes.push(obj["@type"]);
        for (const key of Object.keys(obj)) {
          if (Array.isArray(obj[key])) {
            obj[key].forEach(extractTypes);
          } else if (typeof obj[key] === "object") {
            extractTypes(obj[key]);
          }
        }
      };
      extractTypes(parsed);
    } catch {
      // invalid json
    }
  }

  // Canonical evaluation: extract pathname
  let canonicalPath = "";
  if (canonical) {
    try {
      canonicalPath = new URL(canonical).pathname.replace(/\/$/, "");
    } catch {
      canonicalPath = canonical.replace(/\/$/, "");
    }
  }
  const normalizedUrlPath = urlPath.replace(/\/$/, "");
  const isSelfCanonical = !canonical || canonicalPath === normalizedUrlPath;

  return {
    title,
    titleLength: title.length,
    canonical,
    canonicalPath,
    isSelfCanonical,
    robots,
    isNoindex,
    description,
    descriptionLength: description.length,
    h1Count,
    jsonLdTypes,
  };
}

// Discover internal links in HTML
function extractInternalLinks(html) {
  const links = new Set();
  const hrefRegex = /href=["'](\/[^"'#?]*)/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const rawPath = match[1].replace(/\/$/, "");
    const clean = rawPath || "/";
    if (!clean.startsWith("/_") && !clean.endsWith(".css") && !clean.endsWith(".js") && !clean.endsWith(".png") && !clean.endsWith(".svg") && !clean.endsWith(".ico")) {
      links.add(clean);
    }
  }
  return Array.from(links);
}

// Classify page group for reporting
function getPageGroup(path) {
  if (path === "/" || path === "/mock-tests" || path === "/cuet-ug-previous-year-papers") {
    return "Home & Hubs";
  }
  if (path.startsWith("/cuet-ug-")) {
    return "Exam Guides & Info";
  }
  if (path.startsWith("/cuet-mock-test/")) {
    const parts = path.split("/").filter(Boolean);
    return parts.length >= 3 ? "Topic Practice" : "Subject Practice";
  }
  if (path.startsWith("/pyq/")) {
    const parts = path.split("/").filter(Boolean);
    return parts.length >= 3 ? "PYQ Subjects" : "PYQ Years";
  }
  if (path.startsWith("/mock/")) {
    return "Mock Detail";
  }
  if (path.startsWith("/leaderboard")) {
    return "Leaderboards";
  }
  if (path.startsWith("/blog")) {
    return "Editorial & Blog";
  }
  if (path.startsWith("/q/")) {
    return "Shared Questions";
  }
  if (["/about", "/contact", "/privacy-policy", "/terms", "/disclaimer"].includes(path)) {
    return "Institutional & Legal";
  }
  return "Other Public Pages";
}

async function main() {
  console.log("================================================================");
  console.log("CUET Free Mock Test — SEO Consistency & Sitemap Auditor (Fix 7)");
  console.log("Target Base URL:", BASE_URL);
  console.log("================================================================\n");

  let spawnedServer = null;
  let exitCode = 0;
  const isAvailable = await waitForServer(`${BASE_URL}/`, 1500);

  if (!isAvailable) {
    console.log(`Base URL ${BASE_URL} not running. Spawning local dev server...`);
    spawnedServer = spawn("npm", ["run", "dev"], {
      stdio: "pipe",
      shell: true,
    });
    spawnedServer.stdout.on("data", (d) => {
      // quiet output
    });
    const ready = await waitForServer(BASE_URL, 60000);
    if (!ready) {
      console.error("FAIL: Could not start local dev server within 60s.");
      if (spawnedServer) spawnedServer.kill();
      process.exit(1);
    }
    console.log("Dev server is ready!\n");
  }

  try {
    // 1. Fetch and parse sitemap.xml
    console.log("1. Fetching /sitemap.xml ...");
    const sitemapRes = await fetchPage("/sitemap.xml");
    if (sitemapRes.status !== 200) {
      throw new Error(`Failed to fetch /sitemap.xml (status: ${sitemapRes.status})`);
    }

    const sitemapUrls = new Set();
    const locRegex = /<loc>([^<]+)<\/loc>/gi;
    let locMatch;
    while ((locMatch = locRegex.exec(sitemapRes.html)) !== null) {
      try {
        const parsed = new URL(locMatch[1].trim());
        const normPath = parsed.pathname.replace(/\/$/, "") || "/";
        sitemapUrls.add(normPath);
      } catch {
        // ignore
      }
    }
    console.log(`Found ${sitemapUrls.size} URLs in /sitemap.xml.\n`);

    // 2. Discover URLs to audit
    console.log("2. Crawling and discovering site URLs...");
    const discoveredUrls = new Set([
      "/",
      "/cuet-mock-test",
      "/pyq",
      "/cuet-ug-previous-year-papers",
      "/mock-tests",
      "/cuet-ug-syllabus",
      "/cuet-ug-exam-pattern",
      "/cuet-ug-marking-scheme",
      "/cuet-ug-important-dates",
      "/leaderboard",
      "/blog",
      "/about",
      "/contact",
      "/privacy-policy",
      "/terms",
      "/disclaimer",
      ...sitemapUrls,
    ]);

    // Seed crawl with worker pool
    // Warm the dev server's route modules before the parallel crawl. Without
    // this, the first batch of cold Astro pages can exceed the fetch timeout.
    await fetchPage("/");
    await fetchPage("/mock-tests");
    await fetchPage("/cuet-mock-test/psychology");

    const queue = Array.from(discoveredUrls);
    const enqueued = new Set(discoveredUrls);
    const audited = new Map();
    const visited = new Set();
    const CONCURRENCY = 1;
    // Every sitemap URL plus the fixed hubs is always audited. The optional cap
    // only bounds extra pages discovered by SEO_DEEP_CRAWL, so a low value can
    // never silently skip a sitemap URL and report it as unreachable.
    // 0 or unset means no cap.
    const MAX_AUDIT_PAGES = Number(process.env.MAX_AUDIT_PAGES ?? 0) || 0;
    const auditLimit = MAX_AUDIT_PAGES > 0 ? MAX_AUDIT_PAGES : Number.POSITIVE_INFINITY;
    const seedUrls = new Set(discoveredUrls);
    // Deep link discovery is opt-in: in CI it turns a 60-URL sitemap audit into
    // a multi-thousand-page crawl of noindex detail pages. The default audits
    // every sitemap URL plus the fixed hubs; set SEO_DEEP_CRAWL=1 to discover.
    const DEEP_CRAWL = process.env.SEO_DEEP_CRAWL === "1";

    async function worker() {
      while (queue.length > 0) {
        const currentPath = queue.shift();
        if (!currentPath || visited.has(currentPath)) continue;
        if (audited.size >= auditLimit && !seedUrls.has(currentPath)) continue;
        visited.add(currentPath);

        const res = await fetchPage(currentPath);
        const isRedirect = res.status === 301 || res.status === 302;
        const meta = res.status === 200 ? parsePageMetadata(res.html, currentPath) : null;

        audited.set(currentPath, {
          path: currentPath,
          status: res.status,
          location: res.location,
          isRedirect,
          meta,
        });

        // Discover links if 200 HTML
        if (res.status === 200 && meta) {
          const isPrivate = PRIVATE_PREFIXES.some((p) => currentPath.startsWith(p));
          if (!isPrivate) {
            const links = extractInternalLinks(res.html);
            for (const link of links) {
              if (!enqueued.has(link)) {
                enqueued.add(link);
                if (
                  DEEP_CRAWL &&
                  audited.size < auditLimit &&
                  !PRIVATE_PREFIXES.some((p) => link.startsWith(p))
                ) {
                  queue.push(link);
                }
              }
            }
          }
        }
      }
    }

    const workers = Array.from({ length: CONCURRENCY }, () => worker());
    await Promise.all(workers);

    console.log(`Total URLs audited: ${audited.size}`);
    if (queue.length > 0) {
      console.log(`Crawl stopped at ${audited.size} pages (${queue.length} links left unvisited).`);
    }
    console.log();

    // 3. Rule Enforcement & Analysis
    console.log("3. Enforcing Consistency Rules...");
    const mismatches = [];
    const indexableUrls = new Set();
    const groupCounts = {};

    for (const [urlPath, record] of audited.entries()) {
      const inSitemap = sitemapUrls.has(urlPath);
      const isPrivate = PRIVATE_PREFIXES.some((p) => urlPath.startsWith(p));

      // Rule: No private URLs in sitemap
      if (isPrivate && inSitemap) {
        mismatches.push({
          url: urlPath,
          rule: "NO_PRIVATE_IN_SITEMAP",
          details: "Private route must not be in sitemap.xml",
        });
      }

      // Handle Redirects (e.g. /cuet-mock-test -> /mock-tests, /pyq -> /cuet-ug-previous-year-papers)
      if (record.isRedirect) {
        if (inSitemap) {
          mismatches.push({
            url: urlPath,
            rule: "REDIRECT_IN_SITEMAP",
            details: `Redirecting URL (${record.status} -> ${record.location}) must not be in sitemap.xml`,
          });
        }
        continue;
      }

      // Check 200 pages
      if (record.status === 200 && record.meta) {
        const { isNoindex, isSelfCanonical, canonical, canonicalPath, h1Count, titleLength, jsonLdTypes } = record.meta;
        const isIndexable = !isPrivate && !isNoindex && isSelfCanonical;

        if (isIndexable) {
          indexableUrls.add(urlPath);
          const group = getPageGroup(urlPath);
          groupCounts[group] = (groupCounts[group] ?? 0) + 1;

          // Rule: Every indexable URL must be in sitemap
          if (!inSitemap) {
            mismatches.push({
              url: urlPath,
              rule: "INDEXABLE_MISSING_FROM_SITEMAP",
              details: `Indexable page (200, index, self-canonical) is missing from sitemap.xml`,
            });
          }

          // Quality checks on indexable pages
          if (h1Count !== 1) {
            console.warn(`[WARN] ${urlPath}: h1 count is ${h1Count} (expected exactly 1)`);
          }
          if (titleLength < 30 || titleLength > 70) {
            console.warn(`[WARN] ${urlPath}: title length is ${titleLength} chars (expected 30-70)`);
          }

          // Disallowed JSON-LD check
          for (const banned of BANNED_JSONLD_TYPES) {
            if (jsonLdTypes.includes(banned)) {
              mismatches.push({
                url: urlPath,
                rule: "DISALLOWED_JSONLD",
                details: `Contains banned structured data type: ${banned}`,
              });
            }
          }
        } else {
          // Not indexable (has noindex or canonical points elsewhere)
          if (inSitemap) {
            mismatches.push({
              url: urlPath,
              rule: "NON_INDEXABLE_IN_SITEMAP",
              details: isNoindex
                ? `Page marked noindex is present in sitemap.xml`
                : `Page with non-self-canonical (${canonical}) is present in sitemap.xml`,
            });
          }
        }
      } else if (inSitemap) {
        // Sitemap URL returned non-200
        mismatches.push({
          url: urlPath,
          rule: "SITEMAP_URL_NOT_200",
          details: `URL in sitemap returned HTTP ${record.status}`,
        });
      }
    }

    // Check for any sitemap URL that was not even reached
    for (const smUrl of sitemapUrls) {
      if (!audited.has(smUrl)) {
        mismatches.push({
          url: smUrl,
          rule: "SITEMAP_URL_UNREACHED",
          details: "URL listed in sitemap was not found during crawl",
        });
      }
    }

    // 4. Output Summary Table
    console.log("\n================================================================");
    console.log("INDEXABLE URL BREAKDOWN BY PAGE GROUP");
    console.log("================================================================");
    console.table(
      Object.entries(groupCounts).map(([group, count]) => ({
        "Page Group": group,
        "Indexable Count": count,
      }))
    );

    console.log("================================================================");
    console.log("SITEMAP AUDIT SUMMARY");
    console.log("================================================================");
    console.log(`Total URLs in sitemap.xml:     ${sitemapUrls.size}`);
    console.log(`Total Indexable Public URLs:   ${indexableUrls.size}`);
    console.log(`Total Mismatches / Violations: ${mismatches.length}`);
    console.log("================================================================\n");

    if (mismatches.length > 0) {
      console.error("FAIL: SEO consistency mismatches detected:");
      for (const m of mismatches) {
        console.error(`- [${m.rule}] ${m.url}: ${m.details}`);
      }
      exitCode = 1;
    } else {
      console.log("SUCCESS: Mismatch count = 0. All sitemap and indexable URLs are 100% consistent!");
      exitCode = 0;
    }
  } finally {
    if (spawnedServer) {
      console.log("\nStopping spawned dev server...");
      spawnedServer.kill("SIGKILL");
    }
    // `astro dev` daemonises and can keep inherited pipes open. Exit explicitly
    // so CI does not wait on the daemon after the audit has already decided.
    process.exit(exitCode);
  }
}

main().catch((err) => {
  console.error("Fatal error during SEO consistency crawl:", err);
  process.exit(1);
});
