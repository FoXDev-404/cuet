import { questionSharePath } from "./public-id";

/**
 * Pure helpers for the live-attempt question share surface. The attempt page
 * resolves one link per question server-side (public question page when the
 * lineage has an enabled mapping, the mock instructions URL otherwise); these
 * functions keep that decision, the footer text and the filename consistent
 * and unit-testable without a browser.
 */

export type AttemptShareLinkInput = {
  /** Enabled public mapping for the question's lineage, when one exists. */
  publicId: string | null;
  /** Raw question text; used to build the canonical /q/ slug. */
  questionText: string;
  /** Absolute fallback URL — the mock instructions page. */
  mockUrl: string;
  /** Absolute site origin, e.g. https://cuetfreemocktest.com. */
  siteOrigin: string;
};

export type AttemptShareLink = {
  url: string;
  publicId: string | null;
};

/**
 * The link a shared question points at. Public question pages win when the
 * question is publicly shareable; otherwise the recipient lands on the mock
 * instructions page, which works for guests and logged-in users alike.
 */
export function attemptQuestionShareUrl(input: AttemptShareLinkInput): AttemptShareLink {
  if (input.publicId) {
    return {
      url: new URL(questionSharePath(input.publicId, input.questionText), input.siteOrigin).toString(),
      publicId: input.publicId,
    };
  }
  return { url: input.mockUrl, publicId: null };
}

/** Pretty link text for the card footer: host + path, no scheme, bounded. */
export function attemptShareLinkText(url: string, maxLength = 72): string {
  let text = url.trim();
  try {
    const parsed = new URL(text);
    text = `${parsed.host}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    text = text.replace(/^https?:\/\//, "");
  }
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trimEnd()}…`;
}

/**
 * Stable PNG filename. The public id is safe to expose; questions without one
 * fall back to the mock slug plus the on-screen question number.
 */
export function attemptShareFileName(
  publicId: string | null,
  mockSlug: string,
  questionNumber: number,
): string {
  if (publicId) return `cuet-question-${publicId}.png`;
  return `cuet-${mockSlug}-q${questionNumber}.png`;
}
