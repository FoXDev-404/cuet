import { STATIC_GUIDES } from "../content/guides";

/**
 * Guide artwork paths.
 *
 * Repository guides have a pre-generated 1200x630 PNG (see
 * `scripts/generate-guide-og.mjs`). Database-authored posts are rendered as SVG
 * by the `/og/blog/[slug].svg` endpoint for in-page thumbnails, but social
 * platforms do not render SVG, so their share image falls back to the site logo.
 *
 * This module deliberately imports only static content so it can be exercised
 * without the Worker runtime.
 */

const REPO_GUIDE_SLUGS = new Set(STATIC_GUIDES.map((guide) => guide.slug));

function encodedSlug(slug: string): string {
  return encodeURIComponent(slug);
}

/** In-page artwork: PNG for repository guides, SVG for database posts. */
export function guideImagePath(slug: string): string {
  const extension = REPO_GUIDE_SLUGS.has(slug) ? "png" : "svg";
  return `/og/blog/${encodedSlug(slug)}.${extension}`;
}

/** Social-share image: always a raster format. */
export function guideOgImagePath(slug: string): string {
  return REPO_GUIDE_SLUGS.has(slug)
    ? `/og/blog/${encodedSlug(slug)}.png`
    : "/logo.png";
}
