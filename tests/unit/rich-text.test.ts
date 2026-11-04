import { describe, expect, it } from "vitest";
import { escapeHtml, renderPlainText, renderRichText } from "../../src/lib/rich-text";

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

  it("renders plain text safely", () => {
    expect(renderPlainText("Hello <world> & 'test'")).toBe(
      "Hello &lt;world&gt; &amp; &#39;test&#39;",
    );
  });

  it("renders HTML tables cleanly and strips inline style clutter", () => {
    const input = `<table border=1 style='margin: auto; word-wrap: break-word;'><tr><td style='text-align: center; word-wrap: break-word;'>List-I</td><td style='text-align: center; word-wrap: break-word;'>List-II</td></tr><tr><td style='text-align: center; word-wrap: break-word;'>(A) Sentence</td><td style='text-align: center; word-wrap: break-word;'>(I) Meaning</td></tr></table>`;
    const output = renderRichText(input);
    expect(output).toContain('<div class="nta-table-container">');
    expect(output).toContain('<table class="nta-table">');
    expect(output).toContain("<th>List-I</th>");
    expect(output).toContain("<th>List-II</th>");
    expect(output).toContain("<td>(A) Sentence</td>");
    expect(output).toContain("<td>(I) Meaning</td>");
    expect(output).not.toContain("word-wrap: break-word");
    expect(output).not.toContain("border=1");
  });

  it("renders KaTeX math inside table cells", () => {
    const input = `<table border=1><tr><td>List-I</td><td>List-II</td></tr><tr><td>(A) Rate</td><td>$k = A e^{-E_a / RT}$</td></tr></table>`;
    const output = renderRichText(input);
    expect(output).toContain('<table class="nta-table">');
    expect(output).toContain("katex");
    expect(output).toContain("Rate");
  });

  it("decodes HTML entities like &#x27; in stems and tables", () => {
    const input = "emergency don&#x27;t disturb me and grease someone&#x27;s palm";
    const output = renderRichText(input);
    expect(output).toContain("don't disturb me");
    expect(output).toContain("someone's palm");
    expect(output).not.toContain("&#x27;");
  });

  it("decodes &amp; in LaTeX matrices so columns align properly", () => {
    const input = "Solve $ \\left|\\begin{matrix}6&amp;2\\\\ 4&amp;3\\end{matrix}\\right|= $";
    const output = renderRichText(input);
    expect(output).toContain("katex");
    expect(output).not.toContain("ParseError");
  });

  it("renders markdown headings as semantic stylized divs", () => {
    const input = "Choose opposite:\n\n#### Redress\n\n(A) set right";
    const output = renderRichText(input);
    expect(output).toContain('<div class="nta-heading">Redress</div>');
    expect(output).not.toContain("####");
  });

  it("renders instruction headings cleanly", () => {
    const input = "##### Choose the correct answer from the options given below:";
    const output = renderRichText(input);
    expect(output).toContain('<div class="nta-instruction">Choose the correct answer from the options given below:</div>');
    expect(output).not.toContain("#####");
  });

  it("renders safe images from local-papers assets", () => {
    const input = '<div style="text-align: center;">\n<img src="/local-papers/assets/chemistry-2026-06-06-shift-1/q49-figure-1.jpg" alt="Figure 1" />\n</div>';
    const output = renderRichText(input);
    expect(output).toContain('<figure class="nta-figure">');
    expect(output).toContain('src="/local-papers/assets/chemistry-2026-06-06-shift-1/q49-figure-1.jpg"');
    expect(output).toContain('alt="Figure 1"');
    expect(output).toContain('loading="lazy"');
  });

  it("renders markdown bold and italic in explanations", () => {
    const input = "**Key Concept:** This is *critical* for tests.";
    const output = renderRichText(input);
    expect(output).toContain("<strong>Key Concept:</strong>");
    expect(output).toContain("<em>critical</em>");
  });
});
