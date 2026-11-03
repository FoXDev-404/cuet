import { escapeHtml } from "./rich-text";

export type BlogPostRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  status: "draft" | "published";
  published_at: string | null;
  created_at: string;
  updated_at: string | null;
};

/**
 * A deliberately small Markdown subset for editorial guides: headings, lists,
 * blockquotes, fenced code, bold, inline code and http(s)/relative links.
 * Everything is escaped first, so stored post bodies cannot inject HTML.
 */
function inline(value: string): string {
  let html = escapeHtml(value);
  html = html.replace(/`([^`]+)`/g, "<code class=\"rounded bg-neutral-100 px-1 py-0.5 text-[0.9em] dark:bg-neutral-800\">$1</code>");
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (match, label: string, rawUrl: string) => {
    const url = rawUrl.replace(/&amp;/g, "&");
    if (!url.startsWith("https://") && !url.startsWith("http://") && !url.startsWith("/")) {
      return match;
    }
    const external = url.startsWith("http");
    return `<a class="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800 dark:text-brand-300" href="${rawUrl}"${external ? ' rel="noopener noreferrer" target="_blank"' : ""}>${label}</a>`;
  });
  return html;
}

export function renderArticleBody(value: string | null | undefined): string {
  if (!value) return "";
  const lines = String(value).replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let paragraph: string[] = [];
  let list: "ul" | "ol" | null = null;
  let quote: string[] = [];
  let code: string[] | null = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    out.push(`<p>${paragraph.map(inline).join("<br />")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (!list) return;
    out.push(`</${list}>`);
    list = null;
  };
  const flushQuote = () => {
    if (quote.length === 0) return;
    out.push(`<blockquote>${quote.map(inline).join("<br />")}</blockquote>`);
    quote = [];
  };
  const flushAll = () => {
    flushParagraph();
    flushList();
    flushQuote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.trim().startsWith("```")) {
      flushAll();
      if (code === null) {
        code = [];
      } else {
        out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
        code = null;
      }
      continue;
    }
    if (code !== null) {
      code.push(rawLine);
      continue;
    }

    if (line.trim() === "") {
      flushAll();
      continue;
    }

    const heading = line.match(/^(#{2,4})\s+(.+)$/);
    if (heading) {
      flushAll();
      const level = Math.min(4, heading[1].length);
      out.push(`<h${level}>${inline(heading[2])}</h${level}>`);
      continue;
    }

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      quote.push(line.slice(2));
      continue;
    }
    flushQuote();

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const ordered = line.match(/^\d+\.\s+(.+)$/);
    if (unordered || ordered) {
      flushParagraph();
      const kind = unordered ? "ul" : "ol";
      if (list !== kind) {
        flushList();
        out.push(`<${kind}>`);
        list = kind;
      }
      out.push(`<li>${inline((unordered ?? ordered)![1])}</li>`);
      continue;
    }
    flushList();
    paragraph.push(line);
  }

  if (code !== null) out.push(`<pre><code>${escapeHtml(code.join("\n"))}</code></pre>`);
  flushAll();
  return out.join("\n");
}

export function estimateReadingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}
