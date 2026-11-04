import katex from "katex";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function decodeCommonEntities(value: string): string {
  return value
    .replace(/&#x27;|&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}

function escapeRichTextContent(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function normalizeLineForDeduplication(line: string): string {
  return line
    .replace(/^#{1,6}\s*/, "")
    .replace(/^\d+[\.\)]\s*/, "")
    .replace(/^[\u2022\u25cf\-\*]\s*/, "")
    .replace(/[:.\-–—\s]+$/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Strips consecutive duplicate lines/prompts that occurred during PDF/OCR extraction,
 * such as a section instruction followed immediately by the question prompt with a question number.
 */
function deduplicateConsecutiveLines(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      cleaned.push(line);
      continue;
    }

    let prevIdx = cleaned.length - 1;
    while (prevIdx >= 0 && !cleaned[prevIdx].trim()) {
      prevIdx -= 1;
    }

    if (prevIdx >= 0) {
      const prevLine = cleaned[prevIdx].trim();
      const normCurr = normalizeLineForDeduplication(trimmed);
      const normPrev = normalizeLineForDeduplication(prevLine);

      if (normCurr.length > 8 && normCurr === normPrev) {
        // If current line has a redundant question number (e.g. "13. Rearrange...") and previous doesn't, skip current
        if (/^\d+[\.\)]\s+/.test(trimmed) && !/^\d+[\.\)]\s+/.test(prevLine)) {
          continue;
        }
        // If previous had the number and current is clean, keep the clean one
        if (/^\d+[\.\)]\s+/.test(prevLine) && !/^\d+[\.\)]\s+/.test(trimmed)) {
          cleaned[prevIdx] = line;
          continue;
        }
        // Identical lines, skip duplicate
        continue;
      }
    }

    cleaned.push(line);
  }

  return cleaned.join("\n");
}

/**
 * Sanitizes and cleans an HTML table block for NTA questions.
 * Strips obsolete inline presentation styles and creates responsive,
 * accessible table structures.
 */
function cleanTable(rawTableHtml: string): string {
  // Strip script tags and event handlers
  let clean = rawTableHtml
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  // Normalize table opening tag with responsive CBT class
  clean = clean.replace(/<table[^>]*>/i, '<table class="nta-table">');

  // Clean tr tags: remove inline styles
  clean = clean.replace(/<tr[^>]*>/gi, "<tr>");

  // Helper to clean cells and keep valid colspan, rowspan, align
  const cleanCell = (tag: "td" | "th", attrs: string, content: string) => {
    let cleanAttrs = "";
    const colspan = attrs.match(/colspan=["']?(\d+)["']?/i);
    const rowspan = attrs.match(/rowspan=["']?(\d+)["']?/i);
    const align = attrs.match(/align=["']?(center|left|right|justify)["']?/i);
    if (colspan) cleanAttrs += ` colspan="${colspan[1]}"`;
    if (rowspan) cleanAttrs += ` rowspan="${rowspan[1]}"`;
    if (align) cleanAttrs += ` align="${align[1]}"`;

    let formattedContent = content
      .replace(/\*\*([^\*\n]+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^\*\n]+?)\*/g, "<em>$1</em>");

    return `<${tag}${cleanAttrs}>${formattedContent.trim()}</${tag}>`;
  };

  clean = clean.replace(/<td([^>]*)>([\s\S]*?)<\/td>/gi, (_, attrs, content) =>
    cleanCell("td", attrs, content)
  );

  clean = clean.replace(/<th([^>]*)>([\s\S]*?)<\/th>/gi, (_, attrs, content) =>
    cleanCell("th", attrs, content)
  );

  // If the first row contains List-I / List-II or headers, promote <td> to <th> for accessibility
  clean = clean.replace(/<tr>(\s*<td[^>]*>[\s\S]*?List[\s\S]*?<\/td>\s*<td[^>]*>[\s\S]*?List[\s\S]*?<\/td>\s*)<\/tr>/i, (match) => {
    return match.replace(/<td/g, "<th").replace(/<\/td>/g, "</th>");
  });

  return `<div class="nta-table-container">${clean}</div>`;
}

/**
 * Question content is authored by admins and extracted from official NTA papers.
 * Renders LaTeX math with KaTeX, formats tables, safe figures, markdown headings,
 * and markdown bold/italics, while keeping stored XSS impossible.
 */
export function renderRichText(value: string | null | undefined): string {
  if (!value) return "";
  let source = String(value);

  // If input contains script injection or event handlers, escape entirely
  if (/<script/i.test(source) || /\son\w+\s*=/i.test(source)) {
    return escapeHtml(source).replace(/\n/g, "<br />");
  }

  // 1. Normalize line breaks and decode common entities like &#x27; -> '
  source = source.replace(/\r\n/g, "\n");
  source = decodeCommonEntities(source);
  source = deduplicateConsecutiveLines(source);

  // 2. Extract and render KaTeX math ($...$ or $$...$$)
  const mathBlocks: string[] = [];
  const mathPattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  source = source.replace(mathPattern, (match, displayExpr, inlineExpr) => {
    const expression = (displayExpr ?? inlineExpr ?? "").trim();
    const isDisplay = Boolean(displayExpr);
    try {
      const rendered = katex.renderToString(expression, {
        displayMode: isDisplay,
        throwOnError: false,
        strict: "ignore",
        output: "htmlAndMathml",
      });
      mathBlocks.push(rendered);
    } catch {
      mathBlocks.push(escapeHtml(match));
    }
    return `\u0000MATH_${mathBlocks.length - 1}\u0000`;
  });

  // 3. Extract and sanitize HTML tables
  const tableBlocks: string[] = [];
  const tablePattern = /<table[\s\S]*?<\/table>/gi;
  source = source.replace(tablePattern, (tableHtml) => {
    tableBlocks.push(cleanTable(tableHtml));
    return `\n\u0000TABLE_${tableBlocks.length - 1}\u0000\n`;
  });

  // 4. Extract safe figure / image elements
  const figureBlocks: string[] = [];
  const figurePattern = /<(?:div|p)[^>]*>\s*<img\s+([^>]+?)\/?>\s*<\/(?:div|p)>|<img\s+([^>]+?)\/?>/gi;
  source = source.replace(figurePattern, (match, attrs1, attrs2) => {
    const attrs = attrs1 || attrs2 || "";
    const srcMatch = attrs.match(/src=["']([^"']+)["']/i);
    const altMatch = attrs.match(/alt=["']([^"']*)["']/i);
    const src = srcMatch ? srcMatch[1] : "";
    const alt = altMatch ? altMatch[1] : "";

    // Only allow safe local asset paths or safe https URLs
    if (/^(\/(?:local-papers|assets|images)\/[a-zA-Z0-9_\-\.\/]+|https:\/\/[a-zA-Z0-9_\-\.\/]+)/.test(src) && !/\son\w+\s*=/i.test(attrs)) {
      const safeAlt = escapeHtml(alt);
      figureBlocks.push(
        `<figure class="nta-figure"><img src="${escapeHtml(src)}" alt="${safeAlt}" class="nta-image" loading="lazy" /></figure>`
      );
      return `\n\u0000FIG_${figureBlocks.length - 1}\u0000\n`;
    }
    return escapeHtml(match);
  });

  // 5. Parse Markdown Headings: lines starting with #
  source = source.replace(/^(#{1,6})\s+(.+)$/gm, (_, _hashes, headingText) => {
    const text = headingText.trim();
    if (/^Choose the (?:correct|most appropriate) answer/i.test(text) || /^Sub questions/i.test(text)) {
      return `<div class="nta-instruction">${escapeHtml(text)}</div>`;
    }
    return `<div class="nta-heading">${escapeHtml(text)}</div>`;
  });

  // 6. Parse Markdown Bold & Italic
  source = source.replace(/\*\*([^\*\n]+?)\*\*/g, "<strong>$1</strong>");
  source = source.replace(/\*([^\*\n]+?)\*/g, "<em>$1</em>");

  // 7. Escape all remaining raw text outside placeholders and tags
  const tokenPattern = /(\u0000(?:MATH|TABLE|FIG)_\d+\u0000|<div[^>]*>|<\/div>|<figure[^>]*>|<\/figure>|<table[^>]*>|<\/table>|<tr[^>]*>|<\/tr>|<td[^>]*>|<\/td>|<th[^>]*>|<\/th>|<strong[^>]*>|<\/strong>|<em[^>]*>|<\/em>|<p[^>]*>|<\/p>|<br\s*\/?>)/g;
  const parts = source.split(tokenPattern);

  let result = "";
  for (const part of parts) {
    if (!part) continue;
    if (tokenPattern.test(part)) {
      result += part;
    } else {
      result += escapeRichTextContent(part).replace(/\n/g, "<br />");
    }
  }

  // 8. Clean up excess <br /> around block elements
  result = result
    .replace(/(?:<br \/>\s*){3,}/g, "<br /><br />")
    .replace(/(?:<br \/>\s*)+<div/g, "<div")
    .replace(/<\/div>(?:\s*<br \/>)+/g, "</div>")
    .replace(/(?:<br \/>\s*)+\u0000TABLE_/g, "\u0000TABLE_")
    .replace(/\u0000TABLE_(\d+)\u0000(?:\s*<br \/>)+/g, "\u0000TABLE_$1\u0000")
    .replace(/(?:<br \/>\s*)+\u0000FIG_/g, "\u0000FIG_")
    .replace(/\u0000FIG_(\d+)\u0000(?:\s*<br \/>)+/g, "\u0000FIG_$1\u0000");

  // 9. Restore placeholders in reverse order (FIGURE, TABLE, then MATH)
  result = result.replace(/\u0000FIG_(\d+)\u0000/g, (_, idx) => figureBlocks[Number(idx)] ?? "");
  result = result.replace(/\u0000TABLE_(\d+)\u0000/g, (_, idx) => tableBlocks[Number(idx)] ?? "");
  result = result.replace(/\u0000MATH_(\d+)\u0000/g, (_, idx) => mathBlocks[Number(idx)] ?? "");

  return result;
}

export function renderPlainText(value: string | null | undefined): string {
  return escapeHtml(value ?? "");
}
