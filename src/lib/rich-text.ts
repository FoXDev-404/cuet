import katex from "katex";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Question content is authored by admins and stored as plain text. HTML is
 * escaped, then $...$ / $$...$$ segments are rendered with KaTeX. This keeps
 * stored XSS impossible while still giving sharp, dark-mode friendly formulas.
 */
export function renderRichText(value: string | null | undefined): string {
  if (!value) return "";
  const source = String(value);
  const mathPattern = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g;
  let html = "";
  let cursor = 0;
  let match: RegExpExecArray | null;

  while ((match = mathPattern.exec(source))) {
    html += escapeHtml(source.slice(cursor, match.index)).replace(/\n/g, "<br />");
    const expression = (match[1] ?? match[2] ?? "").trim();
    try {
      html += katex.renderToString(expression, {
        displayMode: Boolean(match[1]),
        throwOnError: false,
        strict: "ignore",
        output: "htmlAndMathml",
      });
    } catch {
      html += escapeHtml(match[0]);
    }
    cursor = match.index + match[0].length;
  }

  html += escapeHtml(source.slice(cursor)).replace(/\n/g, "<br />");
  return html;
}

export function renderPlainText(value: string | null | undefined): string {
  return escapeHtml(value ?? "");
}
