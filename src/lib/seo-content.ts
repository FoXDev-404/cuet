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
}): string {
  return `Take the ${input.dateLabel} CUET ${input.subject} mock: ${input.questionCount} scored questions, a ${input.durationMinutes}-minute timer, leaderboard ranking and detailed post-submit review.`;
}

export function limitSeoDescription(description: string): string {
  const normalized = description.trim().replace(/\s+/g, " ");
  if (normalized.length <= 160) return normalized;

  const truncated = normalized.slice(0, 159);
  const wordBoundary = truncated.lastIndexOf(" ");
  const end = wordBoundary >= 120 ? wordBoundary : truncated.length;
  return `${truncated.slice(0, end).trimEnd()}...`;
}
