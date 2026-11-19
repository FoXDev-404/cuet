const MIN_SEO_INTRO_WORDS = 300;

export function hasSubstantiveSeoIntro(introHtml: string | null | undefined): boolean {
  if (!introHtml) return false;
  const text = introHtml
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&(?:#\d+|#x[\da-f]+|[a-z][\da-z]+);/gi, " ");
  return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu)?.length ?? 0) >=
    MIN_SEO_INTRO_WORDS;
}

export function rankedPaperMetaDescription(input: {
  dateLabel: string;
  subject: string;
  questionCount: number;
  durationMinutes: number;
  /** "PYQ Set 15" for rebuilt sets; omitted for original single-date papers. */
  setLabel?: string | null;
}): string {
  const setLabel = input.setLabel ? ` ${input.setLabel}` : "";
  return `Take the ${input.dateLabel} CUET ${input.subject}${setLabel} mock: ${input.questionCount} scored questions, a ${input.durationMinutes}-minute timer, leaderboard ranking and detailed post-submit review.`;
}

/**
 * Set number printed in a rebuilt paper's title, e.g. "PYQ Set 15". Only
 * rebuilt sets share a subject and date range, so only they need the suffix to
 * keep titles and descriptions unique.
 */
export function paperSetLabel(input: {
  title: string;
  sourceMethod?: string | null;
}): string | null {
  if (!input.sourceMethod?.startsWith("pyq_rebuild")) return null;
  const match = input.title.match(/\bPYQ\s+Set\s+\d+\b/i);
  return match ? match[0].replace(/\s+/g, " ") : null;
}

/**
 * Unique, length-bounded search title for a paper detail page. Original papers
 * keep the date/shift title; rebuilt sets use their set number.
 */
export function paperSeoTitle(input: {
  subjectName: string;
  dateLabel: string;
  shift: string | null;
  paperTitle: string;
  sourceMethod?: string | null;
  isGeneralTest?: boolean;
}): string {
  const setLabel = paperSetLabel({ title: input.paperTitle, sourceMethod: input.sourceMethod });
  if (setLabel) {
    const suffix = ` | ${input.isGeneralTest ? "Online Test" : "CUET Mock"}`;
    const base = input.isGeneralTest
      ? `CUET UG General Test ${setLabel}`
      : `CUET ${input.subjectName} ${setLabel}`;
    const withSuffix = `${base}${suffix}`;
    if (withSuffix.length >= 35) return withSuffix.length <= 65 ? withSuffix : base;

    // Short subject names (History, Physics, ...) leave the title under the
    // 35-character search-title minimum, so add the paper's date range.
    const datedBase = input.isGeneralTest
      ? `CUET UG General Test ${input.dateLabel} ${setLabel}`
      : `CUET ${input.subjectName} ${input.dateLabel} ${setLabel}`;
    const datedWithSuffix = `${datedBase}${suffix}`;
    return datedWithSuffix.length <= 65 ? datedWithSuffix : datedBase;
  }

  if (input.isGeneralTest) {
    return `CUET UG General Test ${input.dateLabel}${input.shift ? ` ${input.shift}` : ""} PYQ | Online Test`;
  }

  const titleBase = `CUET ${input.subjectName} ${input.dateLabel}${input.shift ? ` ${input.shift}` : ""} Paper`;
  const withSuffix = `${titleBase} | CUET Mock`;
  return withSuffix.length <= 65 ? withSuffix : titleBase;
}

const TRAILING_CONNECTORS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

export function limitSeoDescription(description: string): string {
  const normalized = description.trim().replace(/\s+/g, " ");
  if (normalized.length <= 160) return normalized;

  // Reserve room for the ellipsis so the final string never exceeds 160.
  const truncated = normalized.slice(0, 157);
  const wordBoundary = truncated.lastIndexOf(" ");
  const end = wordBoundary >= 120 ? wordBoundary : truncated.length;
  let cut = truncated.slice(0, end).trimEnd().replace(/[.,;:!?]+$/, "");

  // A hard character cut can leave "and a" or "with the" dangling before the
  // ellipsis. Drop trailing connectives until the cut ends on real content.
  for (;;) {
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace <= 0) break;
    const lastWord = cut
      .slice(lastSpace + 1)
      .replace(/[.,;:!?]+$/, "")
      .toLowerCase();
    if (!TRAILING_CONNECTORS.has(lastWord)) break;
    cut = cut.slice(0, lastSpace).trimEnd().replace(/[.,;:!?]+$/, "");
  }

  return `${cut}...`;
}

/** Length-bounded search description for a mock test detail page. */
export function mockMetaDescription(input: {
  title: string;
  questionCount: number;
  durationMinutes: number;
}): string {
  return limitSeoDescription(
    `${input.title}: ${input.questionCount} questions in ${input.durationMinutes} minutes. Free server-scored CUET UG mock test with detailed solutions, instant results and a leaderboard.`,
  );
}
