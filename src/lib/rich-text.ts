import katex from "katex";
import "katex/contrib/mhchem";

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

  return `<div class="nta-table-container" tabindex="0" role="group" aria-label="Scrollable table">${clean}</div>`;
}

const HTML_TOKEN_SOURCE =
  "</?(?:a|b|blockquote|br|caption|code|div|em|figcaption|figure|h[1-6]|i|img|li|ol|p|pre|span|strong|sub|sup|table|tbody|td|tfoot|th|thead|tr|u|ul)\\b[^>]*>";
const HTML_TOKEN_PATTERN = new RegExp(`^(?:${HTML_TOKEN_SOURCE})$`, "i");
const PLACEHOLDER_TOKEN_PATTERN = /^\u0000(?:MATH|TABLE|FIG)_\d+\u0000$/;
const TEXT_TOKEN_SPLIT_PATTERN = new RegExp(
  `(${HTML_TOKEN_SOURCE}|\u0000(?:MATH|TABLE|FIG)_\\d+\u0000)`,
  "gi",
);
const LATEX_COMMAND_PATTERN = /\\[a-zA-Z]+|\\[^a-zA-Z0-9\s]/;

/**
 * Converts literal escape sequences that survived PDF/OCR extraction, such as
 * "\n" stored as two characters instead of a real line break.
 */
const LATEX_N_COMMANDS = new Set([
  "nabla",
  "natural",
  "ncong",
  "ne",
  "nearrow",
  "neg",
  "neq",
  "nexists",
  "ngeq",
  "ngtr",
  "ni",
  "nleftarrow",
  "nLeftarrow",
  "nleftrightarrow",
  "nLeftrightarrow",
  "nleq",
  "nless",
  "nmid",
  "nolimits",
  "nonumber",
  "normalsize",
  "not",
  "notin",
  "nparallel",
  "nrightarrow",
  "nRightarrow",
  "nshortmid",
  "nshortparallel",
  "nsim",
  "nsubseteq",
  "nsupseteq",
  "nu",
  "nvDash",
  "nvdash",
  "nVDash",
  "nVdash",
  "nwarrow",
  "newline",
]);

function normalizeLiteralEscapes(value: string): string {
  return value
    .replace(
      /(\\+)(n)([a-zA-Z]*)/g,
      (match, slashes: string, _escape: string, word: string) => {
        // An even number of slashes is an escaped backslash, not an escape sequence.
        if (slashes.length % 2 === 0) return match;
        // Keep real LaTeX commands such as \neq, \nabla and \notin. The regex
        // captures the part after the "n", so check the full command name.
        if (LATEX_N_COMMANDS.has(`n${word}`)) return match;
        return `${"\\".repeat(slashes.length - 1)}\n${word}`;
      },
    )
    .replace(
      /(\\+)([rt])(?![a-z])/g,
      (match, slashes: string, escape: string) => {
        if (slashes.length % 2 === 0) return match;
        const prefix = "\\".repeat(slashes.length - 1);
        return `${prefix}${escape === "t" ? " " : "\n"}`;
      },
    );
}

/**
 * Applies a transform only to text nodes, leaving HTML tags and rendered math
 * placeholders untouched.
 */
function mapTextSegments(value: string, transform: (text: string) => string): string {
  return value
    .split(TEXT_TOKEN_SPLIT_PATTERN)
    .map((part) => {
      if (!part) return "";
      if (PLACEHOLDER_TOKEN_PATTERN.test(part) || HTML_TOKEN_PATTERN.test(part)) {
        return part;
      }
      return transform(part);
    })
    .join("");
}

function renderKatexBlock(
  expression: string,
  displayMode: boolean,
  mathBlocks: string[],
  throwOnError: boolean,
): string | null {
  try {
    const rendered = katex.renderToString(expression, {
      displayMode,
      throwOnError,
      strict: "ignore",
      output: "htmlAndMathml",
    });
    // Display equations are horizontally scrollable on narrow screens. A
    // scrollable region must be keyboard reachable, so make the KaTeX display
    // wrapper focusable and give it an accessible name.
    let accessible = rendered;
    if (displayMode) {
      accessible = rendered.replace(
        '<span class="katex-display">',
        '<span class="katex-display" tabindex="0" role="group" aria-label="Scrollable equation">',
      );
    } else if (expression.length > 40) {
      // A long formula stored without display delimiters still overflows a
      // phone. Give it its own scroll container and keyboard focus target.
      accessible = rendered.replace(
        '<span class="katex">',
        '<span class="katex katex-scroll" tabindex="0" role="group" aria-label="Scrollable equation">',
      );
    }
    mathBlocks.push(accessible);
    return `\u0000MATH_${mathBlocks.length - 1}\u0000`;
  } catch {
    return null;
  }
}

function renderMathChunk(chunk: string, mathBlocks: string[]): string {
  if (!LATEX_COMMAND_PATTERN.test(chunk)) return chunk;
  return renderMathWithRepair(chunk, false, mathBlocks) ?? chunk;
}

/**
 * Splits a line into whitespace-delimited chunks while keeping whitespace that
 * appears inside LaTeX groups. Each chunk that contains a LaTeX command is
 * rendered as math, which covers bare expressions like \frac{1}{2} and
 * \mathrm{CHCl}_{3}.
 */
function renderMathChunks(value: string, mathBlocks: string[]): string {
  let output = "";
  let start = 0;
  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\u0000") {
      const placeholder = /^\u0000(?:MATH|TABLE|FIG)_\d+\u0000/.exec(value.slice(index));
      if (placeholder) {
        output += renderMathChunk(value.slice(start, index), mathBlocks);
        output += placeholder[0];
        index += placeholder[0].length - 1;
        start = index + 1;
        continue;
      }
    }
    if (char === "\\") {
      index += 1;
      continue;
    }
    if (char === "{") {
      depth += 1;
    } else if (char === "}") {
      depth = Math.max(0, depth - 1);
    } else if (depth === 0 && /\s/.test(char)) {
      output += renderMathChunk(value.slice(start, index), mathBlocks);
      output += char;
      start = index + 1;
    }
  }

  return output + renderMathChunk(value.slice(start), mathBlocks);
}

function findLatexCommand(value: string, command: string, from: number): number {
  const pattern = new RegExp(`\\\\${command}(?![a-zA-Z])`, "g");
  pattern.lastIndex = from;
  const match = pattern.exec(value);
  return match ? match.index : -1;
}

function extendRightDelimiter(value: string, rightIndex: number): number {
  let end = rightIndex + "\\right".length;

  if (value[end] === "\\") {
    const delimiter = /^\\[a-zA-Z]+|^\\[^a-zA-Z]/.exec(value.slice(end));
    end += delimiter ? delimiter[0].length : 1;
  } else if (end < value.length) {
    end += 1;
  }

  // Keep exponents/subscripts attached to the closing delimiter, e.g. \right)^{2}
  while (end < value.length && (value[end] === "_" || value[end] === "^")) {
    end += 1;
    if (value[end] === "{") {
      let depth = 1;
      end += 1;
      while (end < value.length && depth > 0) {
        if (value[end] === "{") depth += 1;
        else if (value[end] === "}") depth -= 1;
        end += 1;
      }
    } else {
      end += 1;
    }
  }

  return end;
}

/**
 * Keeps balanced \left ... \right expressions (including their delimiters and
 * any environments inside) together so KaTeX can parse them as one unit.
 */
function renderLeftRightSpans(value: string, mathBlocks: string[]): string {
  let output = "";
  let cursor = 0;

  while (cursor < value.length) {
    const start = findLatexCommand(value, "left", cursor);
    if (start === -1) {
      output += value.slice(cursor);
      break;
    }

    let depth = 1;
    let scan = start + "\\left".length;
    let end = -1;

    while (scan < value.length) {
      const nextLeft = findLatexCommand(value, "left", scan);
      const nextRight = findLatexCommand(value, "right", scan);
      if (nextRight === -1) break;

      if (nextLeft !== -1 && nextLeft < nextRight) {
        depth += 1;
        scan = nextLeft + "\\left".length;
      } else {
        depth -= 1;
        scan = nextRight + "\\right".length;
        if (depth === 0) {
          end = extendRightDelimiter(value, nextRight);
          break;
        }
      }
    }

    if (end === -1) {
      output += value.slice(cursor);
      break;
    }

    output += value.slice(cursor, start);
    const span = value.slice(start, end);
    const spanDisplay = /\\begin\{/.test(span) || span.length > 140;
    output += renderKatexBlock(span, spanDisplay, mathBlocks, true) ?? span;
    cursor = end;
  }

  return output;
}

function renderEnvironmentSpans(value: string, mathBlocks: string[]): string {
  return value.replace(
    /\\begin\{([a-zA-Z*]+)\}[\s\S]*?\\end\{\1\}/g,
    (match) => renderKatexBlock(match, true, mathBlocks, true) ?? match,
  );
}

/**
 * Removes a LaTeX command together with its braced argument while respecting
 * nested braces. Used for commands KaTeX does not implement (e.g. \chemfig).
 */
function removeCommandWithArgument(value: string, command: string): string {
  const pattern = new RegExp(`\\\\${command}\\s*\\{`, "g");
  let output = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const start = match.index;
    let depth = 1;
    let end = start + match[0].length;

    while (end < value.length && depth > 0) {
      if (value[end] === "\\") {
        end += 2;
        continue;
      }
      if (value[end] === "{") depth += 1;
      else if (value[end] === "}") depth -= 1;
      end += 1;
    }

    output += value.slice(cursor, start);
    cursor = end;
    pattern.lastIndex = end;
  }

  return output + value.slice(cursor);
}

/**
 * Applies a transform to the braced argument of every occurrence of a command,
 * respecting nested braces.
 */
function transformCommandArguments(
  value: string,
  command: string,
  transform: (content: string) => string,
): string {
  const pattern = new RegExp(`\\\\${command}\\s*\\{`, "g");
  let output = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    const start = match.index;
    let depth = 1;
    let end = start + match[0].length;

    while (end < value.length && depth > 0) {
      if (value[end] === "\\") {
        end += 2;
        continue;
      }
      if (value[end] === "{") depth += 1;
      else if (value[end] === "}") depth -= 1;
      end += 1;
    }

    output += value.slice(cursor, start);
    output += transform(value.slice(start + match[0].length, end - 1));
    cursor = end;
    pattern.lastIndex = end;
  }

  return output + value.slice(cursor);
}

/**
 * \text{} is text mode in KaTeX, so scripts and math commands inside it fail.
 * When the body actually contains math, switch to \mathrm{}; otherwise escape
 * the literal underscores/carets that made text mode invalid.
 */
function repairTextCommands(value: string): string {
  return transformCommandArguments(value, "text", (content) => {
    if (/[_^](?:\{|[A-Za-z0-9])|\\[a-zA-Z]/.test(content)) {
      return `\\mathrm{${content}}`;
    }
    return `\\text{${content.replace(/_/g, "\\_").replace(/\^/g, "\\^")}}`;
  });
}

/**
 * Drops alignment tabs that sit outside any environment (KaTeX errors on them)
 * and stray math delimiters left inside an expression by extraction glitches.
 */
function removeLooseAlignmentTabs(value: string): string {
  let output = "";
  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    if (value[index] === "\\") {
      const environment = /^\\(begin|end)\{([a-zA-Z*]+)\}/.exec(value.slice(index));
      if (environment) {
        depth = Math.max(0, depth + (environment[1] === "begin" ? 1 : -1));
        output += environment[0];
        index += environment[0].length - 1;
        continue;
      }
      output += value[index];
      if (index + 1 < value.length) {
        output += value[index + 1];
        index += 1;
      }
      continue;
    }
    if (value[index] === "&" && depth === 0) continue;
    output += value[index];
  }

  return output;
}

/**
 * Removes closing braces that never had a matching opening brace and closes
 * groups left open by truncated OCR content, so KaTeX can still parse the rest.
 */
function balanceBraces(value: string): string {
  let output = "";
  let depth = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === "\\") {
      output += char;
      if (index + 1 < value.length) {
        output += value[index + 1];
        index += 1;
      }
      continue;
    }
    if (char === "{") {
      depth += 1;
      output += char;
    } else if (char === "}") {
      if (depth > 0) {
        depth -= 1;
        output += char;
      }
    } else {
      output += char;
    }
  }

  return depth > 0 ? output + "}".repeat(depth) : output;
}

/**
 * TeX allows only one superscript and one subscript per atom. Content extracted
 * from PDFs sometimes repeats them (e.g. 10^{-3}^{\circ}); an empty group
 * between the scripts keeps the same visual meaning and makes it valid.
 */
function separateDuplicateScripts(value: string): string {
  return value
    .replace(/\^(\{[^{}]*\}|\\[a-zA-Z]+|[A-Za-z0-9])(?=\s*\^)/g, "^$1{}")
    .replace(/_(\{[^{}]*\}|\\[a-zA-Z]+|[A-Za-z0-9])(?=\s*_)/g, "_$1{}");
}

/**
 * Replaces \left / \right that have no counterpart with their plain delimiter,
 * which happens when PDF extraction drops one side of a pair.
 */
function fixOrphanDelimiters(value: string): string {
  const pattern = /\\left|\\right/g;
  const stack: number[] = [];
  const orphan = new Set<number>();
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(value)) !== null) {
    if (match[0] === "\\left") stack.push(match.index);
    else if (stack.length > 0) stack.pop();
    else orphan.add(match.index);
  }
  for (const index of stack) orphan.add(index);
  if (orphan.size === 0) return value;

  let output = "";
  let cursor = 0;
  for (const index of [...orphan].sort((a, b) => a - b)) {
    if (index < cursor) continue;
    output += value.slice(cursor, index);
    let end = index + (value.startsWith("\\left", index) ? "\\left".length : "\\right".length);
    if (value[end] === ".") end += 1;
    cursor = end;
  }

  return output + value.slice(cursor);
}

/**
 * Best-effort cleanup for malformed math so minor extraction damage (unbalanced
 * braces, duplicated scripts, orphan delimiters) does not surface raw LaTeX.
 */
function repairMathExpression(expression: string): string {
  let value = expression;
  value = value.replace(/\\(?:boldmath|unboldmath)(?![a-zA-Z])/g, "");
  value = value.replace(/\\upmu(?![a-zA-Z])/g, "\\mu");
  value = value.replace(/\\\?/g, "?");
  value = removeCommandWithArgument(value, "chemfig");
  value = repairTextCommands(value);
  // A closing brace and dollar are sometimes transposed: "... HO^- $} $".
  value = value.replace(/\$\}\s*\$/g, "}$");
  value = fixOrphanDelimiters(value);
  value = separateDuplicateScripts(value);
  value = removeLooseAlignmentTabs(value);
  value = value.replace(/(?<!\\)\\[()[\]]/g, "");
  value = balanceBraces(value);
  return value;
}

function renderFailedMathFallback(expression: string): string {
  let html = escapeHtml(repairMathExpression(expression));
  html = html.replace(/_\{([^{}\n]+)\}/g, "<sub>$1</sub>");
  html = html.replace(/\^\{([^{}\n]+)\}/g, "<sup>$1</sup>");
  return html;
}

/**
 * Renders a math expression, retrying after repairing common extraction damage.
 */
function renderMathWithRepair(
  expression: string,
  displayMode: boolean,
  mathBlocks: string[],
): string | null {
  // A long or environment-based formula cannot fit on a phone as inline math.
  // Promote it to display mode so the scroll container and focus target apply
  // instead of widening the page.
  const effectiveDisplay =
    displayMode || /\\begin\{/.test(expression) || expression.length > 140;
  const direct = renderKatexBlock(expression, effectiveDisplay, mathBlocks, true);
  if (direct) return direct;

  const repaired = repairMathExpression(expression);
  if (repaired !== expression) {
    return renderKatexBlock(repaired, effectiveDisplay, mathBlocks, true);
  }
  return null;
}

/**
 * Renders bare LaTeX commands and environments that were stored without
 * $...$ delimiters. Complete environments are kept together so KaTeX can
 * parse matrices and arrays; other command chunks are rendered individually.
 */
function renderBareLatex(value: string, mathBlocks: string[]): string {
  if (!/\\[a-zA-Z]/.test(value)) return value;

  return mapTextSegments(value, (text) => {
    if (!/\\[a-zA-Z]/.test(text)) return text;
    const withDelimiters = renderLeftRightSpans(text, mathBlocks);
    const withEnvironments = renderEnvironmentSpans(withDelimiters, mathBlocks);
    return renderMathChunks(withEnvironments, mathBlocks);
  });
}

/**
 * Converts bare subscripts/superscripts (CaCl_{2}, kg^{-1}, x^2) into real
 * sub/sup elements. Unbraced scripts are only converted when they look like
 * formulas, so prose identifiers such as Option_2 or table_name stay intact.
 */
function renderBareScripts(value: string): string {
  return mapTextSegments(value, (text) => {
    let output = text.replace(/\{\}(?=[_^])/g, "");

    output = output.replace(/_\{([^{}\n]+)\}/g, "<sub>$1</sub>");
    output = output.replace(/\^\{([^{}\n]+)\}/g, "<sup>$1</sup>");

    output = output.replace(
      /([A-Za-z][A-Za-z0-9]{0,3})_(\d{1,3})(?![a-z0-9])/g,
      (match, token: string, digits: string) =>
        /[A-Z]/.test(token) ? `${token}<sub>${digits}</sub>` : match,
    );

    output = output.replace(
      /(^|[^A-Za-z])([A-Za-z])_([a-z]{1,12}|[A-Z])(?![A-Za-z])/g,
      (_match, prefix: string, token: string, script: string) =>
        `${prefix}${token}<sub>${script}</sub>`,
    );

    return output.replace(
      /\^([+-]?\d{1,3}[+-]?|[A-Za-z])(?![A-Za-z0-9])/g,
      "<sup>$1</sup>",
    );
  });
}

/**
 * Question content is authored by admins and extracted from official NTA papers.
 * Renders LaTeX math with KaTeX, formats tables, safe figures, markdown headings,
 * and markdown bold/italics, while keeping stored XSS impossible.
 */
export function renderRichText(value: string | null | undefined): string {
  if (!value) return "";
  let source = String(value);

  // If input contains script injection or event handlers inside a tag, escape entirely
  if (/<script/i.test(source) || /<[^>]*\son\w+\s*=/i.test(source)) {
    return escapeHtml(source).replace(/\n/g, "<br />");
  }

  // 1. Normalize line breaks and decode common entities like &#x27; -> '
  source = source.replace(/\r\n/g, "\n");
  source = decodeCommonEntities(source);
  source = normalizeLiteralEscapes(source);
  source = deduplicateConsecutiveLines(source);
  // A closing brace and dollar are sometimes transposed during extraction:
  // "... HO^- $} $" should be "... HO^- }$".
  source = source.replace(/\$\}\s*\$/g, "}$");

  // 2. Extract and render KaTeX math ($...$, $$...$$, \(...\) or \[...\])
  const mathBlocks: string[] = [];
  const mathPattern =
    /\\\[([\s\S]+?)\\\]|\\\(([\s\S]+?)\\\)|\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  source = source.replace(
    mathPattern,
    (_match, bracketExpr, parenExpr, displayExpr, inlineExpr) => {
      const expression = (bracketExpr ?? parenExpr ?? displayExpr ?? inlineExpr ?? "").trim();
      const isDisplay = bracketExpr !== undefined || displayExpr !== undefined;
      const placeholder = renderMathWithRepair(expression, isDisplay, mathBlocks);
      if (placeholder) return placeholder;
      mathBlocks.push(renderFailedMathFallback(expression));
      return `\u0000MATH_${mathBlocks.length - 1}\u0000`;
    },
  );

  // Remove bracket/parenthesis math delimiters that were never closed. They
  // otherwise block the bare-LaTeX pass from rendering the content after them.
  source = source.replace(/(?<!\\)\\[()[\]]/g, "");

  // 3. Parse Markdown Headings: lines starting with #
  source = source.replace(/^(#{1,6})\s+(.+)$/gm, (_, _hashes, headingText) => {
    const text = headingText.trim();
    if (/^Choose the (?:correct|most appropriate) answer/i.test(text) || /^Sub questions/i.test(text)) {
      return `<div class="nta-instruction">${escapeHtml(text)}</div>`;
    }
    return `<div class="nta-heading">${escapeHtml(text)}</div>`;
  });

  // 4. Parse Markdown Bold & Italic
  source = source.replace(/\*\*([^\*\n]+?)\*\*/g, "<strong>$1</strong>");
  source = source.replace(/\*([^\*\n]+?)\*/g, "<em>$1</em>");

  // 5. Render bare LaTeX commands and complete environments
  source = renderBareLatex(source, mathBlocks);

  // 6. Convert bare subscripts and superscripts
  source = renderBareScripts(source);

  // 7. Extract and sanitize HTML tables
  const tableBlocks: string[] = [];
  const tablePattern = /<table[\s\S]*?<\/table>/gi;
  source = source.replace(tablePattern, (tableHtml) => {
    tableBlocks.push(cleanTable(tableHtml));
    return `\n\u0000TABLE_${tableBlocks.length - 1}\u0000\n`;
  });

  // 8. Extract safe figure / image elements
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

  // 9. Escape all remaining raw text outside placeholders and tags
  const tokenSource = [
    "\u0000(?:MATH|TABLE|FIG)_\\d+\u0000",
    "<div[^>]*>", "<\\/div>",
    "<figure[^>]*>", "<\\/figure>",
    "<table[^>]*>", "<\\/table>",
    "<thead[^>]*>", "<\\/thead>",
    "<tbody[^>]*>", "<\\/tbody>",
    "<tr[^>]*>", "<\\/tr>",
    "<td[^>]*>", "<\\/td>",
    "<th[^>]*>", "<\\/th>",
    "<strong[^>]*>", "<\\/strong>",
    "<em[^>]*>", "<\\/em>",
    "<p[^>]*>", "<\\/p>",
    "<br\\s*\\/?>",
    "<sub>", "<\\/sub>",
    "<sup>", "<\\/sup>",
  ].join("|");
  const tokenSplitPattern = new RegExp(`(${tokenSource})`, "g");
  const tokenTestPattern = new RegExp(`^(?:${tokenSource})$`);
  const parts = source.split(tokenSplitPattern);

  let result = "";
  for (const part of parts) {
    if (!part) continue;
    if (tokenTestPattern.test(part)) {
      result += part;
    } else {
      result += escapeRichTextContent(part).replace(/\n/g, "<br />");
    }
  }

  // 10. Clean up excess <br /> around block elements
  result = result
    .replace(/(?:<br \/>\s*){3,}/g, "<br /><br />")
    .replace(/(?:<br \/>\s*)+<div/g, "<div")
    .replace(/<\/div>(?:\s*<br \/>)+/g, "</div>")
    .replace(/(?:<br \/>\s*)+\u0000TABLE_/g, "\u0000TABLE_")
    .replace(/\u0000TABLE_(\d+)\u0000(?:\s*<br \/>)+/g, "\u0000TABLE_$1\u0000")
    .replace(/(?:<br \/>\s*)+\u0000FIG_/g, "\u0000FIG_")
    .replace(/\u0000FIG_(\d+)\u0000(?:\s*<br \/>)+/g, "\u0000FIG_$1\u0000");

  // 11. Restore placeholders in reverse order (FIGURE, TABLE, then MATH)
  result = result.replace(/\u0000FIG_(\d+)\u0000/g, (_, idx) => figureBlocks[Number(idx)] ?? "");
  result = result.replace(/\u0000TABLE_(\d+)\u0000/g, (_, idx) => tableBlocks[Number(idx)] ?? "");
  result = result.replace(/\u0000MATH_(\d+)\u0000/g, (_, idx) => mathBlocks[Number(idx)] ?? "");

  return result;
}

export function renderPlainText(value: string | null | undefined): string {
  return escapeHtml(value ?? "");
}
