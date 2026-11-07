#!/usr/bin/env node
/**
 * scripts/generate-share-fonts.mjs
 *
 * Precomputes the font-embed CSS used by the client share-card renderer.
 *
 * html-to-image normally fetches every @font-face file over the network and
 * base64-encodes it at render time — with KaTeX's ~20 faces that is the
 * single slowest part of generating a share image (and on a phone over a
 * tunnel it looks like a hang). This script bakes the same @font-face rules
 * with data-URI sources into public/share-fonts.json once, so the renderer
 * can hand them straight to html-to-image with zero network work.
 *
 * Included faces (everything the share card can draw):
 *   - KaTeX (all faces)          → math in question text
 *   - Inter latin + latin-ext    → the card's body font (weights used by tokens)
 *   - Noto Sans Devanagari       → Hindi text
 *
 * Rerun whenever one of those packages updates: `npm run share:fonts`.
 * The output is committed so builds and CI never need to regenerate it.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = process.cwd();

function readCss(path) {
  const full = resolve(ROOT, path);
  if (!existsSync(full)) throw new Error(`Missing input CSS: ${path}`);
  return readFileSync(full, "utf8");
}

function toDataUri(file) {
  const full = resolve(ROOT, file);
  if (!existsSync(full)) throw new Error(`Missing font file: ${file}`);
  return `data:font/woff2;base64,${readFileSync(full).toString("base64")}`;
}

/** Rewrites every url(...) in a @font-face block to a woff2 data URI. */
function inlineBlock(block, baseDir) {
  const urls = [...block.matchAll(/url\((['"]?)([^)'"]+)\1\)/g)];
  let inlined = block;
  for (const match of urls) {
    const raw = match[2];
    if (!raw.endsWith(".woff2")) continue;
    const clean = raw.replace(/^\.\//, "").replace(/^["']|["']$/g, "");
    const file = baseDir ? `${baseDir}/${clean}` : clean;
    inlined = inlined.replace(match[0], `url(${toDataUri(file)}) format("woff2")`);
  }
  // Drop any remaining non-woff2 sources; the data URI above is authoritative.
  return inlined.replace(/,\s*url\([^)]*\)\s*format\(["']?(woff|truetype)["']?\)/g, "");
}

let baseCss = "";
let mathCss = "";

// --- KaTeX: every face, math rendering depends on all of them -------------
// Split into its own file: only fetched when the question actually contains
// math, so non-math papers never pay for it.
const katexCss = readCss("node_modules/katex/dist/katex.min.css");
for (const block of katexCss.matchAll(/@font-face\{[^}]*\}/g)) {
  if (!block[0].includes(".woff2")) continue;
  mathCss += `${inlineBlock(block[0], "node_modules/katex/dist")}\n`;
}

// --- @fontsource Inter + Noto Sans Devanagari: needed on every card -------
const INTER_WEIGHTS = [400, 600, 700, 800];
for (const weight of INTER_WEIGHTS) {
  const source = readCss(`node_modules/@fontsource/inter/${weight}.css`);
  for (const block of source.matchAll(/@font-face\s*\{[^}]*\}/g)) {
    if (!/\/files\/inter-(latin|latin-ext)-\d+-normal\.woff2/.test(block[0])) continue;
    baseCss += `${inlineBlock(block[0], "node_modules/@fontsource/inter")}\n`;
  }
}
for (const weight of [400, 700]) {
  const source = readCss(`node_modules/@fontsource/noto-sans-devanagari/${weight}.css`);
  for (const block of source.matchAll(/@font-face\s*\{[^}]*\}/g)) {
    if (!/\/files\/noto-sans-devanagari-(devanagari|latin)-\d+-normal\.woff2/.test(block[0])) continue;
    baseCss += `${inlineBlock(block[0], "node_modules/@fontsource/noto-sans-devanagari")}\n`;
  }
}

function writeJson(file, faces, css) {
  const payload = JSON.stringify({ generatedFor: "share-card", faces, css });
  writeFileSync(resolve(ROOT, file), payload);
  const sizeKb = Math.round(Buffer.byteLength(payload) / 1024);
  console.log(`${file} written: ${faces} font faces, ${sizeKb} KB`);
}

writeJson("public/share-fonts-base.json", (baseCss.match(/@font-face/g) ?? []).length, baseCss);
writeJson("public/share-fonts-math.json", (mathCss.match(/@font-face/g) ?? []).length, mathCss);
