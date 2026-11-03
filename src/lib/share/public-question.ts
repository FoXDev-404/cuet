import { parseOptions, type QuestionOption } from "../content";
import type { RevealPolicy } from "./policy";

/**
 * Pure public-question view helpers shared by the `/q` page and the public
 * JSON API. The resolver in `public-question-store.ts` owns the database work;
 * nothing here can accidentally serialize a correct option or explanation.
 */

export const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F"] as const;

export type PublicQuestionOption = {
  letter: string;
  text: string;
  imageUrl: string | null;
  alt: string | null;
};

export type PublicQuestionPassage = {
  body: string;
  bodyHi: string | null;
  imageUrl: string | null;
  imageAlt: string | null;
};

export type PublicQuestionView = {
  publicId: string;
  path: string;
  canCheck: boolean;
  seoEligible: boolean;
  revealPolicy: RevealPolicy;
  text: string;
  textHi: string | null;
  options: PublicQuestionOption[];
  optionsHi: PublicQuestionOption[] | null;
  imageUrl: string | null;
  imageAlt: string | null;
  passage: PublicQuestionPassage | null;
  subject: { name: string; slug: string };
  topic: { name: string; slug: string } | null;
  year: number | null;
  difficulty: string | null;
  relatedMocks: Array<{ title: string; slug: string }>;
};

export function optionsForPublic(raw: string | null | undefined): PublicQuestionOption[] {
  return parseOptions(raw).map((option: QuestionOption, index: number) => ({
    letter: OPTION_LETTERS[index] ?? String(index + 1),
    text: option.text,
    imageUrl: option.image_url,
    alt: option.alt,
  }));
}

export function optionsForPublicHindi(
  raw: string | null | undefined,
): PublicQuestionOption[] | null {
  if (!raw || !raw.trim()) return null;
  const options = optionsForPublic(raw);
  return options.length > 0 ? options : null;
}

/**
 * Indexing requires every documented condition. The stored flag is only one of
 * them; membership in a published ranked mock can change after an admin sets
 * the flag, so the public page re-evaluates the rule on every request.
 */
export function isSeoEligible(input: {
  published: boolean;
  seoIndexable: boolean;
  revealPolicy: RevealPolicy;
  rightsOk: boolean;
  hasExplanation: boolean;
  inPublishedMock: boolean;
}): boolean {
  return (
    input.published &&
    input.seoIndexable &&
    input.revealPolicy === "public" &&
    input.rightsOk &&
    input.hasExplanation &&
    !input.inPublishedMock
  );
}

/**
 * `public` reveal is limited to practice-only questions and is disabled if the
 * question later appears in a published ranked mock. Attempted-only viewers
 * need a submitted attempt containing a revision of this lineage.
 */
export function canViewerCheck(input: {
  revealPolicy: RevealPolicy;
  inPublishedMock: boolean;
  hasSubmittedAttempt: boolean;
}): boolean {
  if (input.revealPolicy === "public") return !input.inPublishedMock;
  return input.hasSubmittedAttempt;
}

/** Short, readable text for titles, descriptions and link previews. */
export function plainExcerpt(value: string | null | undefined, max = 155): string {
  if (!value) return "";
  const normalized = value
    .replace(/\$\$?/g, "")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= max) return normalized;
  const clipped = normalized.slice(0, Math.max(1, max - 1));
  const lastSpace = clipped.lastIndexOf(" ");
  return `${clipped.slice(0, lastSpace > 40 ? lastSpace : clipped.length).trimEnd()}…`;
}

export function publicQuestionTitle(input: {
  text: string;
  subjectName: string;
  seoEligible: boolean;
}): string {
  const excerpt = plainExcerpt(input.text, 70);
  if (input.seoEligible) {
    return `${excerpt} — CUET ${input.subjectName} Practice Question`;
  }
  return `${excerpt || "CUET practice question"} — CUET ${input.subjectName}`;
}

export function publicQuestionDescription(input: {
  text: string;
  subjectName: string;
  seoEligible: boolean;
}): string {
  const excerpt = plainExcerpt(input.text, 100);
  const description = input.seoEligible
    ? `Practice this CUET ${input.subjectName} question with a worked explanation. ${excerpt}`
    : `Practise this CUET ${input.subjectName} question and attempt the full mock to see the solution. ${excerpt}`;
  return plainExcerpt(description, 158);
}

/**
 * Social image for an indexable shared question. The PNG is generated offline
 * from the question row; the Worker never renders an image at request time.
 */
export function questionOgImagePath(publicId: string): string {
  return `/og/questions/${encodeURIComponent(publicId)}.png`;
}
