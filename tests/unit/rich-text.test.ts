import { describe, expect, it } from "vitest";
import { escapeHtml, renderPlainText, renderRichText } from "../../src/lib/rich-text";

function withoutKatexSource(html: string): string {
  return html.replace(/<annotation[\s\S]*?<\/annotation>/g, "");
}

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
    expect(output).toContain(
      '<div class="nta-table-container" tabindex="0" role="group" aria-label="Scrollable table">',
    );
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

  it("deduplicates repeated question prompt lines and redundant numbers", () => {
    const input = "Rearrange the following phrases to form a meaningful sentence:\n\n13. Rearrange the following phrases to form a meaningful sentence.\n\n(A) most roads and routes across Delhi NCR";
    const output = renderRichText(input);
    expect(output).toContain("Rearrange the following phrases to form a meaningful sentence:");
    expect(output).toContain("(A) most roads and routes across Delhi NCR");
    // Verify it only appears once
    const occurrences = (output.match(/Rearrange the following phrases/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it("deduplicates consecutive identical sentences in question stems", () => {
    const input = "Which of the following is not a Sexually Transmitted Disease?\n\nWhich of the following is not a Sexually Transmitted Disease?";
    const output = renderRichText(input);
    const occurrences = (output.match(/Sexually Transmitted Disease/g) || []).length;
    expect(occurrences).toBe(1);
  });

  it("renders bare chemical subscripts and superscripts", () => {
    const output = renderRichText("HCl > CaCl_{2} > MgSO_{4} > NaCl, 0.55 mol kg^{-1}");
    expect(output).toContain("CaCl<sub>2</sub>");
    expect(output).toContain("MgSO<sub>4</sub>");
    expect(output).toContain("kg<sup>-1</sup>");
    expect(output).not.toContain("_{2}");
    expect(output).not.toContain("_{4}");
    expect(output).not.toContain("^{-1}");
  });

  it("renders bare LaTeX commands without dollar delimiters", () => {
    const fraction = withoutKatexSource(
      renderRichText("The value is \\frac{1}{2} of the total."),
    );
    expect(fraction).toContain("katex");
    expect(fraction).not.toContain("\\frac");

    const chemistry = withoutKatexSource(
      renderRichText("\\mathrm{CHCl}_{3} + \\mathrm{NaOH}"),
    );
    expect(chemistry).toContain("katex");
    expect(chemistry).not.toContain("\\mathrm");
    expect(chemistry).not.toContain("_{3}");
  });

  it("renders bare LaTeX environments as one math block", () => {
    const output = withoutKatexSource(
      renderRichText("\\begin{array}{c} a \\\\ b \\end{array}"),
    );
    expect(output).toContain("katex");
    expect(output).not.toContain("\\begin");
    expect(output).not.toContain("\\end");
  });

  it("renders bracket and parenthesis math delimiters", () => {
    const display = withoutKatexSource(renderRichText("\\[ \\frac{a}{b} \\]"));
    expect(display).toContain("katex-display");
    expect(display).not.toContain("\\frac");

    const inline = renderRichText("\\( x^2 + y^2 \\)");
    expect(inline).toContain("katex");
    expect(inline).not.toContain("\\(");
  });

  it("converts literal escape sequences into line breaks", () => {
    const output = renderRichText("first line\\nSecond line\\nthird");
    expect(output).toContain("first line<br />Second line<br />third");
  });

  it("renders math in prose that contains words like one =", () => {
    const output = renderRichText(
      "$x^2$\n\nHence age of the eldest one = 7+12=19 years",
    );
    expect(output).toContain("katex");
    expect(output).not.toContain("$x^2$");
  });

  it("repairs malformed math instead of showing raw LaTeX", () => {
    const transposed = withoutKatexSource(
      renderRichText("$ \\mathrm{MnO_2, SO_2, HO^- $} $"),
    );
    expect(transposed).not.toContain("\\mathrm");
    expect(transposed).not.toContain("$");

    const extraBraces = withoutKatexSource(
      renderRichText("$$ h= {\\sqrt{\\frac{175}{7}}}} $$"),
    );
    expect(extraBraces).not.toContain("\\sqrt");

    const doubleScript = withoutKatexSource(
      renderRichText("$$ \\alpha=2.22\\times10^{-3}^{\\circ}C^{-1} $$"),
    );
    expect(doubleScript).not.toContain("^{\\circ}");

    const orphanDelimiter = withoutKatexSource(
      renderRichText("$$ \\frac{(1,2 \\right) + (3,4 \\right)}{\\sqrt{3}} $$"),
    );
    expect(orphanDelimiter).not.toContain("\\right");
  });

  it("repairs text-mode math, chemfig and micro symbols", () => {
    const textMath = withoutKatexSource(
      renderRichText("$ \\underline{\\text{v_{1} < v_{2} < v_{3}}} $"),
    );
    expect(textMath).not.toContain("\\text");
    expect(textMath).not.toContain("v_{1}");

    const underscores = withoutKatexSource(
      renderRichText("$ \\underline{\\text{Option 2: (A),_(C),_(B)}} $"),
    );
    expect(underscores).not.toContain("\\text");
    expect(underscores).not.toContain("$");

    const chem = withoutKatexSource(
      renderRichText("$ \\ce{ \\chemfig{*6(=-=-=-)} -CH2-OH } $"),
    );
    expect(chem).not.toContain("\\chemfig");

    const micro = withoutKatexSource(renderRichText("$$ \\upmu_{0} $$"));
    expect(micro).not.toContain("\\upmu");
    expect(micro).toContain("katex");
  });

  it("renders environments after an unmatched bracket delimiter", () => {
    const output = withoutKatexSource(
      renderRichText("\\[\\begin{array}{l} a \\\\ b \\end{array} and x = 1"),
    );
    expect(output).not.toContain("\\[");
    expect(output).not.toContain("\\begin");
    expect(output).not.toContain("\\end");
  });

  it("drops alignment tabs outside environments", () => {
    const output = withoutKatexSource(
      renderRichText("$$ \\begin{array}{c} a \\end{array} = & 1 $$"),
    );
    expect(output).not.toContain("&");
    expect(output).toContain("katex");
  });

  it("keeps LaTeX commands that start with n", () => {
    const output = withoutKatexSource(
      renderRichText("$ a \\neq b $ and $ \\nabla f $ and $ x \\notin A $"),
    );
    expect(output).not.toContain("\\neq");
    expect(output).not.toContain("\\nabla");
    expect(output).not.toContain("\\notin");
    expect(output).not.toContain("$");
    expect(output).toContain("katex");
  });

  it("keeps prose identifiers with underscores intact", () => {
    const output = renderRichText(
      "Option_2:_(A),_(B)_and_(C)_only. ALTER_TABLE table_name referenced_table_name ________",
    );
    expect(output).not.toContain("<sub>");
    expect(output).toContain("Option_2");
    expect(output).toContain("ALTER_TABLE");
    expect(output).toContain("table_name");
    expect(output).toContain("________");
  });

  it("renders common unbraced formulas without false positives", () => {
    const output = renderRichText("C_6H_5SO_2Cl, P_total = P_1 + P_2, x^2, Ca^2+");
    expect(output).toContain("C<sub>6</sub>H<sub>5</sub>SO<sub>2</sub>Cl");
    expect(output).toContain("P<sub>total</sub>");
    expect(output).toContain("P<sub>1</sub>");
    expect(output).toContain("P<sub>2</sub>");
    expect(output).toContain("x<sup>2</sup>");
    expect(output).toContain("Ca<sup>2+</sup>");
  });
});
