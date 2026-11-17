import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { blogArtworkSvg } from "../../src/lib/blog-artwork";
import { guideImagePath, guideOgImagePath } from "../../src/lib/guide-images";
import { STATIC_GUIDES } from "../../src/content/guides";

const SAMPLE_GUIDE = STATIC_GUIDES[0]!;

describe("blog artwork", () => {
  it("creates a 1200 by 630 SVG and safely escapes article titles", () => {
    const svg = blogArtworkSvg('CUET <Mock> & "PYQ"', "practice");

    expect(svg).toContain('width="1200" height="630"');
    expect(svg).toContain("CUET &lt;Mock&gt; &amp; &quot;PYQ&quot;");
    expect(svg).not.toContain("<Mock>");
  });

  it("uses a distinct palette for different guide categories", () => {
    const basics = blogArtworkSvg("A CUET guide", "exam-basics");
    const examDay = blogArtworkSvg("A CUET guide", "exam-day");

    expect(basics).not.toBe(examDay);
  });
});

describe("guide social images", () => {
  it("points repository guides at generated PNGs", () => {
    expect(guideImagePath(SAMPLE_GUIDE.slug)).toBe(`/og/blog/${SAMPLE_GUIDE.slug}.png`);
    expect(guideOgImagePath(SAMPLE_GUIDE.slug)).toBe(`/og/blog/${SAMPLE_GUIDE.slug}.png`);
  });

  it("keeps SVG only for database posts and falls back to the logo when sharing", () => {
    expect(guideImagePath("admin-authored-post")).toBe("/og/blog/admin-authored-post.svg");
    expect(guideOgImagePath("admin-authored-post")).toBe("/logo.png");
  });

  it("pre-generates a PNG for every repository guide", () => {
    for (const guide of STATIC_GUIDES) {
      expect(existsSync(join(process.cwd(), "public", guideImagePath(guide.slug))), guide.slug).toBe(
        true,
      );
    }
  });

  it("uses the standard name attribute for Twitter card metadata", () => {
    const layout = readFileSync(join(process.cwd(), "src/layouts/BaseLayout.astro"), "utf8");
    expect(layout).toContain('name="twitter:card"');
    expect(layout).toContain('name="twitter:image"');
    expect(layout).not.toContain('property="twitter:');
  });
});
