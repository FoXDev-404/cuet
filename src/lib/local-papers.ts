import {
  copyMatchList,
  LOCAL_LIBRARY_PATH,
  LOCAL_MARKING_SCHEME,
  type LocalListPair,
  type LocalMatchList,
  type LocalPaper,
  type LocalPaperSummary,
  type LocalQuestionAsset,
  type LocalQuestionOption,
  type LocalQuestionPassage,
  type LocalSubject,
  type LocalSubjectSummary,
} from "./practice-normalize";
import { getConfiguredStore, getPracticeSnapshot } from "./practice-library";

/**
 * Repo-backed previous-year practice papers.
 *
 * The library is imported into D1 (see `migrations/0010_practice_library.sql`
 * and `scripts/import-practice-library.mjs`). Middleware warms a compact index
 * snapshot; full papers are read from D1 on demand, so answer keys never reach
 * the browser before submission and the question bank does not inflate the
 * Worker bundle.
 *
 * Scanned papers are represented by exact crops of the printed page. A key is
 * used for scoring only when it matches one of the printed option labels;
 * unresolved rows stay playable but unscored.
 */

export {
  LOCAL_DURATION_MINUTES,
  LOCAL_ENGLISH_SUBJECT,
  LOCAL_LIBRARY_ADDED_AT,
  LOCAL_LIBRARY_PATH,
  LOCAL_MARKING_SCHEME,
} from "./practice-normalize";
export type {
  LocalListPair,
  LocalMatchList,
  LocalNormalizedQuestion,
  LocalPaper,
  LocalPaperSummary,
  LocalQuestionAsset,
  LocalQuestionOption,
  LocalQuestionPassage,
  LocalSubject,
  LocalSubjectSummary,
} from "./practice-normalize";

export interface LocalPaperTakeQuestion {
  id: string;
  number: number;
  stemEn: string;
  options: LocalQuestionOption[];
  optionsAreImages: boolean;
  bodyIsImage: boolean;
  passage: LocalQuestionPassage | null;
  matchList: LocalMatchList | null;
  arrangementItems: LocalListPair[];
  scorable: boolean;
  assets: LocalQuestionAsset[];
}

export interface LocalPaperTakeData {
  slug: string;
  title: string;
  year: number;
  subject: LocalSubject;
  dateLabel: string;
  durationMinutes: number;
  markingScheme: { correct: number; wrong: number; skipped: number };
  draft: true;
  sourceQuestionCount: number;
  recoveredQuestionCount: number;
  omittedQuestionCount: number;
  scorableQuestionCount: number;
  pendingReviewCount: number;
  sourceFile: string | null;
  sourceMethod: string | null;
  questions: LocalPaperTakeQuestion[];
}

export interface LocalAttemptAnswer {
  questionId: string;
  selectedOption: string | null;
}

export interface LocalReviewItem {
  questionId: string;
  number: number;
  stemEn: string;
  options: LocalQuestionOption[];
  optionsAreImages: boolean;
  bodyIsImage: boolean;
  selectedOption: string | null;
  isCorrect: boolean | null;
  status: "correct" | "incorrect" | "unattempted" | "pending";
  correctOption: string | null;
  correctOptionText: string | null;
  explanation: string | null;
  passage: LocalQuestionPassage | null;
  matchList: LocalMatchList | null;
  arrangementItems: LocalListPair[];
  scorable: boolean;
  assets: LocalQuestionAsset[];
}

export interface LocalSubmitResult {
  attemptId: string;
  slug: string;
  title: string;
  localOnly: true;
  ranked: false;
  durationMinutes: number;
  score: number;
  maxScore: number;
  accuracy: number;
  percentage: number;
  correct: number;
  incorrect: number;
  attempted: number;
  unattempted: number;
  pending: number;
  total: number;
  review: LocalReviewItem[];
}

/** Kept for call-site compatibility; D1 reads no longer need the assets binding. */
export interface LocalPaperAssetsBinding {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

export interface LocalPaperRuntime {
  env?: { ASSETS?: LocalPaperAssetsBinding } | null;
  url?: URL | null;
}

function copySummary(paper: LocalPaperSummary): LocalPaperSummary {
  return {
    ...paper,
    subject: { ...paper.subject },
    markingScheme: { ...paper.markingScheme },
  };
}

export function localPaperPath(slug: string): string {
  return `${LOCAL_LIBRARY_PATH}/${slug}`;
}

export function isLocalPaperSlug(slug: string): boolean {
  return getPracticeSnapshot().papersBySlug.has(slug);
}

export function getLocalPapers(): LocalPaperSummary[] {
  return getPracticeSnapshot().papers.map(copySummary);
}

/**
 * Homepage "most popular" selection. Papers with the most submitted attempts
 * come first; ties fall back to fully keyed papers, then the newest and deepest
 * paper. The selection is deterministic so the same papers appear in the hero
 * and library cards.
 */
export function getPopularLocalPapers(limit = 6): LocalPaperSummary[] {
  return [...getPracticeSnapshot().papers]
    .sort(
      (a, b) =>
        b.attemptCount - a.attemptCount ||
        Number(a.pendingReviewCount > 0) - Number(b.pendingReviewCount > 0) ||
        b.year - a.year ||
        b.scorableQuestionCount - a.scorableQuestionCount ||
        a.subject.name.localeCompare(b.subject.name) ||
        (b.date ?? "").localeCompare(a.date ?? "") ||
        a.title.localeCompare(b.title),
    )
    .slice(0, Math.max(0, limit))
    .map(copySummary);
}

function copySubjectSummary(summary: LocalSubjectSummary): LocalSubjectSummary {
  return { ...summary, subject: { ...summary.subject } };
}

export function getLocalSubjectSummaries(): LocalSubjectSummary[] {
  return [...getPracticeSnapshot().subjectSummaries.values()]
    .sort(
      (a, b) =>
        b.paperCount - a.paperCount ||
        b.questionCount - a.questionCount ||
        a.subject.name.localeCompare(b.subject.name),
    )
    .map(copySubjectSummary);
}

/** Rollup for one subject, or null when the library has no paper for it. */
export function getLocalSubjectSummary(subjectSlug: string): LocalSubjectSummary | null {
  const summary = getPracticeSnapshot().subjectSummaries.get(subjectSlug);
  return summary ? copySubjectSummary(summary) : null;
}

export function getLocalPaperSummaries(): LocalPaperSummary[] {
  return getLocalPapers();
}

export function getLocalPaperSummary(slug: string): LocalPaperSummary | null {
  return getPracticeSnapshot().papersBySlug.get(slug) ?? null;
}

export function getLocalPapersForYear(year: number): LocalPaperSummary[] {
  return getLocalPapers().filter((paper) => paper.year === year);
}

export function getLocalPapersForSubject(subjectSlug: string): LocalPaperSummary[] {
  return getLocalPapers().filter((paper) => paper.subject.slug === subjectSlug);
}

export function getLocalPaperYears(): { year: number; paper_count: number; playable_count: number }[] {
  const years = new Map<number, { year: number; paper_count: number; playable_count: number }>();
  for (const paper of getLocalPapers()) {
    const entry = years.get(paper.year) ?? {
      year: paper.year,
      paper_count: 0,
      playable_count: 0,
    };
    entry.paper_count += 1;
    if (paper.recoveredQuestionCount > 0) entry.playable_count += 1;
    years.set(paper.year, entry);
  }
  return [...years.values()].sort((a, b) => b.year - a.year);
}

/** Full paper with keys. Server-only: never return this to the browser. */
export async function getLocalPaper(
  slug: string,
  _runtime?: LocalPaperRuntime,
): Promise<LocalPaper | null> {
  if (!getPracticeSnapshot().papersBySlug.has(slug)) return null;
  const store = getConfiguredStore();
  if (!store) {
    throw new Error("Practice library store is not configured.");
  }
  return store.loadPaper(slug);
}

/**
 * Keyless payload for the take screen. This deliberately maps only fields the
 * browser needs: correct answers and explanations never cross this boundary.
 */
export async function getLocalPaperTakeData(
  slug: string,
  runtime?: LocalPaperRuntime,
): Promise<LocalPaperTakeData | null> {
  const paper = await getLocalPaper(slug, runtime);
  if (!paper) return null;

  return {
    slug: paper.slug,
    title: paper.title,
    year: paper.year,
    subject: { ...paper.subject },
    dateLabel: paper.dateLabel,
    durationMinutes: paper.durationMinutes,
    markingScheme: { ...LOCAL_MARKING_SCHEME },
    draft: true,
    sourceQuestionCount: paper.sourceQuestionCount,
    recoveredQuestionCount: paper.questions.length,
    omittedQuestionCount: paper.omittedQuestionCount,
    scorableQuestionCount: paper.scorableQuestionCount,
    pendingReviewCount: paper.pendingReviewCount,
    sourceFile: paper.sourceFile,
    sourceMethod: paper.sourceMethod,
    questions: paper.questions.map((question) => ({
      id: question.id,
      number: question.number,
      stemEn: question.stemEn,
      options: question.options.map((option) => ({ id: option.id, text: option.text })),
      optionsAreImages: question.optionsAreImages,
      bodyIsImage: question.bodyIsImage,
      passage: question.passage ? { ...question.passage } : null,
      matchList: copyMatchList(question.matchList),
      arrangementItems: question.arrangementItems.map((item) => ({ ...item })),
      scorable: question.scorable,
      assets: question.assets.map((asset) => ({ ...asset })),
    })),
  };
}

/**
 * Scores a practice paper in memory. Nothing is written to D1: the result is
 * explicitly unranked and local to the browser session.
 */
export async function gradeLocalPaper(
  slug: string,
  submittedAnswers: LocalAttemptAnswer[],
  runtime?: LocalPaperRuntime,
): Promise<LocalSubmitResult | null> {
  const paper = await getLocalPaper(slug, runtime);
  if (!paper) return null;

  const submitted = new Map<string, string | null>();
  for (const answer of submittedAnswers) {
    if (typeof answer.questionId === "string") {
      submitted.set(answer.questionId, answer.selectedOption);
    }
  }

  let correct = 0;
  let incorrect = 0;
  let attempted = 0;
  let pending = 0;
  let score = 0;

  const review: LocalReviewItem[] = paper.questions.map((question) => {
    const rawSelected = submitted.get(question.id) ?? null;
    const selected =
      rawSelected && question.options.some((option) => option.id === rawSelected)
        ? rawSelected
        : null;

    if (selected !== null) attempted += 1;

    const base = {
      questionId: question.id,
      number: question.number,
      stemEn: question.stemEn,
      options: question.options.map((option) => ({ ...option })),
      optionsAreImages: question.optionsAreImages,
      bodyIsImage: question.bodyIsImage,
      selectedOption: selected,
      explanation: question.explanation,
      passage: question.passage ? { ...question.passage } : null,
      matchList: copyMatchList(question.matchList),
      arrangementItems: question.arrangementItems.map((item) => ({ ...item })),
      assets: question.assets.map((asset) => ({ ...asset })),
    };

    if (!question.scorable || !question.correctAnswer) {
      pending += 1;
      return {
        ...base,
        isCorrect: null,
        status: "pending" as const,
        correctOption: null,
        correctOptionText: null,
        scorable: false,
      };
    }

    if (selected === null) {
      return {
        ...base,
        isCorrect: false,
        status: "unattempted" as const,
        correctOption: question.correctAnswer,
        correctOptionText:
          question.options.find((option) => option.id === question.correctAnswer)?.text ?? null,
        scorable: true,
      };
    }

    const isCorrect = selected === question.correctAnswer;
    if (isCorrect) {
      correct += 1;
      score += LOCAL_MARKING_SCHEME.correct;
    } else {
      incorrect += 1;
      score -= LOCAL_MARKING_SCHEME.wrong;
    }

    return {
      ...base,
      isCorrect,
      status: isCorrect ? ("correct" as const) : ("incorrect" as const),
      correctOption: question.correctAnswer,
      correctOptionText:
        question.options.find((option) => option.id === question.correctAnswer)?.text ?? null,
      scorable: true,
    };
  });

  const maxScore = paper.scorableQuestionCount * LOCAL_MARKING_SCHEME.correct;
  const scoredAttempts = correct + incorrect;

  return {
    attemptId: `local-${paper.slug}`,
    slug: paper.slug,
    title: paper.title,
    localOnly: true,
    ranked: false,
    durationMinutes: paper.durationMinutes,
    score,
    maxScore,
    accuracy: scoredAttempts === 0 ? 0 : Number(((correct / scoredAttempts) * 100).toFixed(1)),
    percentage: maxScore === 0 ? 0 : Number(((score / maxScore) * 100).toFixed(1)),
    correct,
    incorrect,
    attempted,
    unattempted: paper.questions.length - attempted,
    pending,
    total: paper.questions.length,
    review,
  };
}
