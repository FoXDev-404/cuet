import { describe, expect, it } from "vitest";
import { blogArtworkSvg } from "../../src/lib/blog-artwork";

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
