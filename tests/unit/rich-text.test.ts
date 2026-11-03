import { describe, expect, it } from "vitest";
import { escapeHtml, renderRichText } from "../../src/lib/rich-text";

describe("rich text", () => {
  it("escapes stored HTML instead of executing it", () => {
    const html = renderRichText('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("<img");
    expect(html).toContain("&lt;img");
    expect(escapeHtml('<script>"x"</script>')).toBe(
      "&lt;script&gt;&quot;x&quot;&lt;/script&gt;",
    );
  });

  it("renders inline and display KaTeX", () => {
    const inline = renderRichText("Solve $x^2$ now");
    expect(inline).toContain("katex");
    expect(inline).toContain("Solve");
    const display = renderRichText("$$\\frac{1}{2}$$");
    expect(display).toContain("katex-display");
  });

  it("keeps line breaks and handles empty input", () => {
    expect(renderRichText("one\ntwo")).toBe("one<br />two");
    expect(renderRichText(null)).toBe("");
    expect(renderRichText("")).toBe("");
  });
});
