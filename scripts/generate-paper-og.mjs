#!/usr/bin/env node
/**
 * scripts/generate-paper-og.mjs
 *
 * Renders one Open Graph card per previous-year practice paper
 * (src/data/local-papers/index.json) into public/og/papers/{slug}.png and
 * writes the manifest src/data/og-papers.json with the generated slugs.
 *
 * The /mock-tests/{slug} pages check the manifest before emitting
 * og:image="/og/papers/{slug}.png", so a paper without a generated card
 * (or a brand-new admin-created mock) silently falls back to /logo.png.
 *
 * Run after importing new papers: `npm run og:papers`. Idempotent; safe to
 * commit the outputs.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadPaperOgFonts, renderPaperOgPng } from "./lib/paper-og.mjs";

const ROOT = resolve(process.cwd());
const INDEX = join(ROOT, "src/data/local-papers/index.json");
const OUT_DIR = join(ROOT, "public/og/papers");
const MANIFEST = join(ROOT, "src/data/og-papers.json");

if (!existsSync(INDEX)) {
  console.error("Missing src/data/local-papers/index.json — nothing to render.");
  process.exit(1);
}

const { papers } = JSON.parse(readFileSync(INDEX, "utf8"));
if (!Array.isArray(papers) || papers.length === 0) {
  console.error("Paper index is empty — nothing to render.");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });
const fonts = loadPaperOgFonts(ROOT);

let rendered = 0;
let failed = 0;
const slugs = [];
for (const paper of papers) {
  const slug = paper.slug;
  if (!slug) continue;
  slugs.push(slug);
  const outPath = join(OUT_DIR, `${slug}.png`);
  try {
    const png = await renderPaperOgPng(paper, fonts);
    writeFileSync(outPath, png);
    rendered += 1;
  } catch (error) {
    failed += 1;
    console.error(`✗ ${slug}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

slugs.sort();
writeFileSync(MANIFEST, `${JSON.stringify(slugs, null, 2)}\n`);
console.log(`Paper OG images: ${rendered} rendered, ${failed} failed → public/og/papers/`);
console.log(`Manifest: ${slugs.length} slugs → src/data/og-papers.json`);
if (failed > 0) process.exit(1);
