#!/usr/bin/env node
/**
 * Link health checker: crawls the site's key pages, extracts every anchor,
 * sitemap and OG-image reference, then verifies each unique URL.
 * Usage: node scripts/check-links.mjs [base-url]
 */
import { readFileSync } from "node:fs";

const BASE = process.argv[2] || "https://cuet-astro.cuet-platform.workers.dev";

// Every page that carries links: entry pages + every blog post + paper samples.
const SEED_PATHS = [
  "/",
  "/mock-tests",
  "/cuet-ug-previous-year-papers",
  "/cuet-ug-syllabus",
  "/cuet-ug-exam-pattern",
  "/cuet-ug-marking-scheme",
  "/cuet-ug-important-dates",
  "/cuet-ug-mock-test",
  "/cuet-mock-test",
  "/cuet-mock-test/english",
  "/blog",
  "/leaderboard",
  "/leaderboard/english-2026-06-06-shift-1",
  "/about",
  "/contact",
  "/privacy-policy",
  "/terms",
  "/disclaimer",
  "/login",
  "/signup",
  "/forgot-password",
  "/search?q=english",
  "/pyq/2026",
  "/pyq/2026/english",
  "/cuet-ug-syllabus/english",
  "/mock/english-2026-06-06-shift-1",
  "/mock/english-2026-06-06-shift-1/instructions",
  "/mock/english-2026-06-06-shift-1/discussion",
  "/mock-tests/english-2026-06-06-shift-1",
  "/mock-tests/chemistry-2026-06-06-shift-1",
];

const results = { internal: new Map(), external: new Map() };
const htmlCache = new Map();

async function fetchPage(path) {
  if (htmlCache.has(path)) return htmlCache.get(path);
  try {
    const res = await fetch(`${BASE}${path}`, { redirect: "follow" });
    const html = res.ok ? await res.text() : "";
    htmlCache.set(path, html);
    return html;
  } catch {
    htmlCache.set(path, "");
    return "";
  }
}

function collectLinks(from, html) {
  const out = [];
  const anchor = /<a\b[^>]*href="([^"#]+)"/g;
  for (const m of html.matchAll(anchor)) out.push(m[1]);
  const og = /<meta property="og:image" content="([^"]+)"/g;
  for (const m of html.matchAll(og)) out.push(m[1]);
  return out.filter((h) => !h.startsWith("mailto:") && !h.startsWith("tel:"));
}

async function main() {
  // 1. All blog posts from the blog index.
  const blogHtml = await fetchPage("/blog");
  const blogSlugs = [...blogHtml.matchAll(/href="(\/blog\/[a-z0-9-]+)"/g)].map((m) => m[1]);
  const seedPaths = [...new Set([...SEED_PATHS, ...blogSlugs])];
  console.log(`Crawling ${seedPaths.length} pages on ${BASE}...`);

  // 2. Collect every link reference { url -> [fromPages] }.
  for (const path of seedPaths) {
    const html = await fetchPage(path);
    if (!html) {
      results.internal.set(path, { status: 0, from: ["<seed>"] });
      continue;
    }
    for (const href of collectLinks(path, html)) {
      if (href.startsWith("http")) {
        if (!results.external.has(href)) results.external.set(href, { from: [] });
        results.external.get(href).from.push(path);
      } else if (href.startsWith("/")) {
        if (!results.internal.has(href)) results.internal.set(href, { from: [] });
        results.internal.get(href).from.push(path);
      }
    }
  }

  // Sitemap URLs too.
  const sitemap = await fetch(`${BASE}/sitemap.xml`).then((r) => (r.ok ? r.text() : ""));
  for (const m of sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    const url = m[1].replace(BASE, "");
    if (url.startsWith("/")) {
      if (!results.internal.has(url)) results.internal.set(url, { from: [] });
      results.internal.get(url).from.push("<sitemap>");
    }
  }
  console.log(`Unique URLs: ${results.internal.size} internal, ${results.external.size} external`);

  // 3. Verify internal links (concurrency 12).
  const internalEntries = [...results.internal.entries()];
  let done = 0;
  async function checkBatch(start, size) {
    for (let i = start; i < Math.min(start + size, internalEntries.length); i++) {
      const [url, info] = internalEntries[i];
      try {
        const res = await fetch(`${BASE}${url}`, { redirect: "follow" });
        info.status = res.status;
      } catch {
        info.status = 0;
      }
      done += 1;
      if (done % 100 === 0) console.log(`  internal ${done}/${internalEntries.length}`);
    }
  }
  await Promise.all(
    Array.from({ length: 12 }, (_, k) => checkBatch(k * Math.ceil(internalEntries.length / 12), Math.ceil(internalEntries.length / 12))),
  );

  // 4. Verify external links (HEAD, follow redirects).
  const externalEntries = [...results.external.entries()];
  await Promise.all(
    externalEntries.map(async ([url, info]) => {
      try {
        const res = await fetch(url, { method: "HEAD", redirect: "follow" });
        info.status = res.status;
        if (res.status === 405 || res.status === 403) {
          const get = await fetch(url, { redirect: "follow" });
          info.status = get.status;
        }
      } catch {
        info.status = 0;
      }
    }),
  );

  // 5. Report.
  const bad = (info) => info.status === 0 || info.status >= 400;
  const badInternal = internalEntries.filter(([, info]) => bad(info));
  const badExternal = externalEntries.filter(([, info]) => bad(info));

  console.log("\n=== BROKEN INTERNAL LINKS ===");
  if (badInternal.length === 0) console.log("(none)");
  for (const [url, info] of badInternal) console.log(`${info.status} ${url}\n     used on: ${[...new Set(info.from)].slice(0, 4).join(", ")}`);

  console.log("\n=== EXTERNAL LINKS ===");
  for (const [url, info] of externalEntries) {
    const mark = bad(info) ? "✗" : "✓";
    console.log(`${mark} ${info.status} ${url}`);
  }

  console.log(`\nSUMMARY: ${badInternal.length}/${internalEntries.length} internal broken, ${badExternal.length}/${externalEntries.length} external broken`);
  if (badInternal.length > 0 || badExternal.length > 0) process.exit(1);
}

main();
