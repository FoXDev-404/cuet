import { isSafeInternalPath } from "./site-presentation";

export type InformationalPageId = "about" | "contact";

export type InformationalPageBlock =
  | { type: "heading"; level: "h2" | "h3"; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[] }
  | { type: "callout"; tone: "neutral" | "warning"; title: string; text: string }
  | { type: "image"; assetId: string; alt: string }
  | { type: "internal_link"; label: string; href: string };

export const INFORMATIONAL_PAGE_SETTING_KEYS: Record<InformationalPageId, string> = {
  about: "page_about_blocks",
  contact: "page_contact_blocks",
};

export const INFORMATIONAL_PAGE_BLOCK_TYPES: Record<
  InformationalPageId,
  InformationalPageBlock["type"][]
> = {
  about: ["heading", "paragraph", "list", "callout", "image", "internal_link"],
  contact: ["heading", "paragraph", "list", "callout", "image"],
};

export const INFORMATIONAL_PAGE_DEFAULTS: Record<
  InformationalPageId,
  InformationalPageBlock[]
> = {
  about: [
    { type: "heading", level: "h2", text: "Why this exists" },
    {
      type: "paragraph",
      text: "Mock tests are only useful if the attempt is honest. If the answer key is one scroll away, or the timer pauses when the tab closes, the score tells you nothing. So the first design decision here was simple: correct answers and explanations are never sent to the browser before submit, and the deadline is stored on the server.",
    },
    {
      type: "paragraph",
      text: "The second decision was to keep the result useful after the score. Every submitted attempt opens a section analysis and a question-by-question solution page. A wrong answer is not just marked red; the explanation shows the reasoning and the report link lets you flag a genuine error.",
    },
    { type: "heading", level: "h2", text: "What you get for free" },
    {
      type: "list",
      items: [
        "Timed CUET UG mock tests with a question palette, mark-for-review and clear response.",
        "Server-side scoring using each paper's own marking scheme.",
        "Written solutions with KaTeX formulas and diagrams where needed.",
        "A private dashboard with attempt history, accuracy and subject performance.",
        "A first-attempt-only leaderboard so retakes cannot farm a rank.",
        "Post-submission discussions, moderated so answer keys do not leak before a test.",
      ],
    },
    {
      type: "paragraph",
      text: "There is no paid tier to unlock these features. If advertising is introduced later, it will be disclosed on the privacy page before it goes live, and it will never appear inside the test screen.",
    },
    { type: "heading", level: "h2", text: "Editorial standards" },
    {
      type: "list",
      items: [
        "No invented exam facts. Dates, marking rules and syllabus scope belong to the official NTA bulletin. When an official summary has been verified, it is shown with a source link and review date. When it has not, the page says so instead of guessing.",
        "No answer-key leaks. The attempt API returns questions without the correct option or explanation. A result is available only after submit or an expired deadline.",
        "Frozen history. Published papers are not silently edited. A new version is a new paper, so an old attempt is always scored with the rules that were shown when it started.",
        "Original explanations. Solutions are written for this site. Images are redrawn or licensed; copied coaching material is not published.",
        "Corrections are welcome. A report from the solutions page creates a moderation item. If a key or explanation is wrong, the paper can be corrected without changing historical scores.",
      ],
    },
    { type: "heading", level: "h2", text: "Independence" },
    {
      type: "paragraph",
      text: "CUET Free Mock Test is not affiliated with the National Testing Agency, any university, or any coaching institute. CUET is conducted by NTA. Score, rank and percentile on this site are practice indicators among its own users, not official results.",
    },
    {
      type: "paragraph",
      text: "The site is built to run on free-tier infrastructure, which keeps the operating cost low enough to keep practice free. That constraint shapes the product: server-rendered pages, a small client bundle, and no unnecessary third-party scripts.",
    },
    {
      type: "callout",
      tone: "neutral",
      title: "Get in touch",
      text: "Questions, corrections and partnership enquiries are welcome. Visit the contact page or read the privacy policy.",
    },
    { type: "internal_link", label: "Contact page", href: "/contact" },
    { type: "internal_link", label: "Privacy policy", href: "/privacy-policy" },
  ],
  contact: [
    { type: "heading", level: "h2", text: "What to include" },
    {
      type: "list",
      items: [
        "The page URL and, for a question, the paper name and question number.",
        "A clear description of the problem and any evidence you can share.",
        "For account issues, the email used to sign in with Google. Never send a Google password or session cookie.",
        "For copyright, the specific material and the basis of the request.",
      ],
    },
    {
      type: "callout",
      tone: "warning",
      title: "What we cannot help with",
      text: "We cannot change an official NTA date, recover an NTA application, confirm a university cut-off or provide an official rank. Those matters belong to NTA and the admitting university. For exam dates and admit cards, use the official NTA CUET portal.",
    },
  ],
};

const MAX_BLOCKS = 20;
const MAX_SERIALIZED_LENGTH = 24_000;

function record(value: unknown, index: number): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Content block ${index + 1} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(
  value: Record<string, unknown>,
  keys: string[],
  index: number,
): void {
  const actual = Object.keys(value);
  if (actual.length !== keys.length || actual.some((key) => !keys.includes(key))) {
    throw new Error(`Content block ${index + 1} has unsupported fields.`);
  }
}

function plainText(
  value: unknown,
  label: string,
  maximum: number,
  allowNewlines = true,
): string {
  if (typeof value !== "string") throw new Error(`${label} must be plain text.`);
  const text = value.trim();
  if (
    text.length < 1 ||
    text.length > maximum ||
    /[<>]/.test(text) ||
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(text) ||
    (!allowNewlines && /[\r\n]/.test(text))
  ) {
    throw new Error(`${label} must be 1-${maximum} plain-text characters.`);
  }
  return text;
}

function normalizeBlock(value: unknown, page: InformationalPageId, index: number): InformationalPageBlock {
  const block = record(value, index);
  if (
    typeof block.type !== "string" ||
    !INFORMATIONAL_PAGE_BLOCK_TYPES[page].includes(
      block.type as InformationalPageBlock["type"],
    )
  ) {
    throw new Error(`Content block ${index + 1} uses a block type not allowed on this page.`);
  }

  switch (block.type) {
    case "heading":
      exactKeys(block, ["type", "level", "text"], index);
      if (block.level !== "h2" && block.level !== "h3") {
        throw new Error(`Content block ${index + 1} heading level must be h2 or h3.`);
      }
      return {
        type: "heading",
        level: block.level,
        text: plainText(block.text, `Content block ${index + 1} heading`, 100, false),
      };
    case "paragraph":
      exactKeys(block, ["type", "text"], index);
      return {
        type: "paragraph",
        text: plainText(block.text, `Content block ${index + 1} paragraph`, 1_500),
      };
    case "list": {
      exactKeys(block, ["type", "items"], index);
      if (!Array.isArray(block.items) || block.items.length < 1 || block.items.length > 10) {
        throw new Error(`Content block ${index + 1} list must contain 1-10 items.`);
      }
      return {
        type: "list",
        items: block.items.map((item, itemIndex) =>
          plainText(item, `Content block ${index + 1} list item ${itemIndex + 1}`, 600, false),
        ),
      };
    }
    case "callout":
      exactKeys(block, ["type", "tone", "title", "text"], index);
      if (block.tone !== "neutral" && block.tone !== "warning") {
        throw new Error(`Content block ${index + 1} has an unsupported callout tone.`);
      }
      return {
        type: "callout",
        tone: block.tone,
        title: plainText(block.title, `Content block ${index + 1} callout title`, 100, false),
        text: plainText(block.text, `Content block ${index + 1} callout text`, 1_000),
      };
    case "image":
      exactKeys(block, ["type", "assetId", "alt"], index);
      if (typeof block.assetId !== "string" || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(block.assetId)) {
        throw new Error(`Content block ${index + 1} must select an uploaded media asset.`);
      }
      return {
        type: "image",
        assetId: block.assetId.toLowerCase(),
        alt: plainText(block.alt, `Content block ${index + 1} image alt text`, 300, false),
      };
    case "internal_link":
      exactKeys(block, ["type", "label", "href"], index);
      if (typeof block.href !== "string" || !isSafeInternalPath(block.href)) {
        throw new Error(`Content block ${index + 1} link must use a same-site path.`);
      }
      return {
        type: "internal_link",
        label: plainText(block.label, `Content block ${index + 1} link label`, 80, false),
        href: block.href.trim(),
      };
    default:
      throw new Error(`Content block ${index + 1} has an unsupported block type.`);
  }
}

export function normalizeInformationalPageBlocks(
  value: unknown,
  page: InformationalPageId,
): InformationalPageBlock[] {
  let parsed = value;
  if (typeof value === "string") {
    if (value.length > MAX_SERIALIZED_LENGTH) {
      throw new Error("Informational page content is too large.");
    }
    try {
      parsed = JSON.parse(value);
    } catch {
      throw new Error("Informational page blocks must be valid JSON.");
    }
  }
  if (!Array.isArray(parsed) || parsed.length < 1 || parsed.length > MAX_BLOCKS) {
    throw new Error(`The ${page} page must contain 1-${MAX_BLOCKS} content blocks.`);
  }
  return parsed.map((block, index) => normalizeBlock(block, page, index));
}

export function parseInformationalPageBlocks(
  value: string | undefined,
  page: InformationalPageId,
): InformationalPageBlock[] {
  if (value === undefined || value === "") return INFORMATIONAL_PAGE_DEFAULTS[page];
  return normalizeInformationalPageBlocks(value, page);
}
