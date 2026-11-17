#!/usr/bin/env node
/**
 * Generate 1200x630 PNG share images for repository-backed guides.
 *
 * Usage (from the repository root):
 *   npm run og:guides
 *
 * Output goes to public/og/blog/{slug}.png and is committed, matching the
 * paper and question OG workflows. Database-authored posts keep the runtime
 * SVG thumbnail and use /logo.png for sharing.
 *
 * The guide content is TypeScript with extensionless imports, so esbuild
 * bundles it into a temporary ESM module before this script imports it.
 */
import { build } from "esbuild";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { Resvg } from "@resvg/resvg-js";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public", "og", "blog");
const BUNDLE_PATH = join(ROOT, ".wrangler", "guide-og-bundle.mjs");

await build({
  stdin: {
    contents: [
      'export { STATIC_GUIDES } from "./src/content/guides/index.ts";',
      'export { blogArtworkSvg } from "./src/lib/blog-artwork.ts";',
    ].join("\n"),
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: BUNDLE_PATH,
  logLevel: "warning",
});

const { STATIC_GUIDES, blogArtworkSvg } = await import(pathToFileURL(BUNDLE_PATH).href);
rmSync(BUNDLE_PATH, { force: true });

mkdirSync(OUT_DIR, { recursive: true });
let totalBytes = 0;
for (const guide of STATIC_GUIDES) {
  const png = new Resvg(blogArtworkSvg(guide.title, guide.category), {
    fitTo: { mode: "width", value: 1200 },
  })
    .render()
    .asPng();
  writeFileSync(join(OUT_DIR, `${guide.slug}.png`), png);
  totalBytes += png.length;
}

console.log(
  `Wrote ${STATIC_GUIDES.length} guide OG images to ${OUT_DIR} (${Math.round(totalBytes / 1024)} KB).`,
);
