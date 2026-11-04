/**
 * Pure normaliser for the refined previous-year practice library.
 *
 * This module has no imports on purpose: the same code is used by the runtime
 * D1 store, the JSON seed loader used in tests, and the import script
 * (`scripts/import-practice-library.mjs`, run through Node's type stripping).
 * Keeping one implementation is what guarantees the imported rows and the
 * original JSON bundle describe exactly the same questions.
 */

export interface RawOption {
  id?: string | null;
  text?: string | null;
  image?: string | null;
  image_url?: string | null;
}

export interface RawAsset {
  id?: string | null;
  kind?: string | null;
  path?: string | null;
  page?: number | null;
  alt?: string | null;
}

export interface RawListItem {
  label?: string | null;
  text?: string | null;
}

export interface RawMatchList {
  list_i?: RawListItem[] | null;
  list_ii?: RawListItem[] | null;
}

export interface RawQuestion {
  id?: string | null;
  sourceQuestionNo?: number | null;
  stemEn?: string | null;
  optionsEn?: RawOption[] | null;
  optionsAreImages?: boolean | null;
  correctAnswer?: string | null;
  explanationEn?: string | null;
  passageId?: string | null;
  reviewStatus?: string | null;
  reviewFlags?: string[] | null;
  sourcePages?: number[] | null;
  assets?: RawAsset[] | null;
  matchList?: RawMatchList | null;
  arrangementItems?: RawListItem[] | null;
}

export interface RawPassage {
  id?: string | null;
  title?: string | null;
  contentEn?: string | null;
}

export interface RawExam {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
  subject?: string | null;
  subjectId?: string | null;
  subjectCode?: string | null;
  year?: number | null;
  examDate?: string | null;
  shift?: string | number | null;
  sourceFile?: string | null;
  sourceMethod?: string | null;
  questionCount?: number | null;
  sourceQuestionCount?: number | null;
  publicationStatus?: string | null;
  reviewRequired?: boolean | null;
  passages?: RawPassage[] | null;
  questions?: RawQuestion[] | null;
}

export interface RawPaper {
  exam?: RawExam | null;
}

export interface RawStoredKey {
  a?: string | null;
  e?: string | null;
}

export interface RawKeyBundle {
  papers?: Record<string, Record<string, RawStoredKey>> | null;
}

export interface RawIndexPaper {
  id?: string | null;
  slug?: string | null;
  title?: string | null;
  metaDescription?: string | null;
  subject?: {
    id?: string | null;
    name?: string | null;
    slug?: string | null;
    code?: string | null;
  } | null;
  year?: number | null;
  date?: string | null;
  dateLabel?: string | null;
  shift?: string | null;
  durationMinutes?: number | null;
  sourceFile?: string | null;
  sourceMethod?: string | null;
  questionCount?: number | null;
  sourceQuestionCount?: number | null;
  scorableQuestionCount?: number | null;
  pendingReviewCount?: number | null;
  imageQuestionCount?: number | null;
  assetCount?: number | null;
  attemptCount?: number | null;
  publicationStatus?: string | null;
  reviewRequired?: boolean | null;
}

export interface RawIndex {
  papers?: RawIndexPaper[] | null;
}

export const LOCAL_LIBRARY_PATH = "/practice";
export const LOCAL_DURATION_MINUTES = 45;
export const LOCAL_MARKING_SCHEME = { correct: 5, wrong: 1, skipped: 0 } as const;
export const LOCAL_LIBRARY_ADDED_AT = "2026-10-31T00:00:00.000Z";

export const LOCAL_ENGLISH_SUBJECT = {
  id: "local-english",
  name: "English",
  slug: "english",
  code: "ENG",
} as const;

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export interface LocalSubject {
  id: string;
  name: string;
  slug: string;
  code: string;
}

export interface LocalQuestionOption {
  id: string;
  text: string;
  image_url?: string | null;
}

export interface LocalQuestionPassage {
  id: string;
  title: string;
  content: string;
}

export interface LocalQuestionAsset {
  id: string;
  kind: string;
  path: string;
  page: number | null;
  alt: string;
}

export interface LocalListPair {
  label: string;
  text: string;
}

export interface LocalMatchList {
  listI: LocalListPair[];
  listII: LocalListPair[];
}

export interface LocalNormalizedQuestion {
  id: string;
  number: number;
  stemEn: string;
  options: LocalQuestionOption[];
  optionsAreImages: boolean;
  bodyIsImage: boolean;
  correctAnswer: string | null;
  explanation: string | null;
  passage: LocalQuestionPassage | null;
  matchList: LocalMatchList | null;
  arrangementItems: LocalListPair[];
  scorable: boolean;
  reviewFlags: string[];
  assets: LocalQuestionAsset[];
}

export interface LocalPaper {
  slug: string;
  id: string;
  title: string;
  subject: LocalSubject;
  year: number;
  date: string | null;
  dateLabel: string;
  shift: string | null;
  durationMinutes: number;
  sourceFile: string | null;
  sourceMethod: string | null;
  sourceUrl?: string | null;
  sourceType?: "official_public" | "licensed" | "original" | "unknown";
  rightsStatus?: "unknown" | "cleared" | "restricted";
  rightsNote?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  publicationStatus: string;
  reviewRequired: boolean;
  sourceQuestionCount: number;
  omittedQuestionCount: number;
  scorableQuestionCount: number;
  pendingReviewCount: number;
  questions: LocalNormalizedQuestion[];
}

export interface LocalPaperSummary {
  id: string;
  slug: string;
  title: string;
  metaDescription: string;
  year: number;
  subject: LocalSubject;
  date: string | null;
  dateLabel: string;
  shift: string | null;
  durationMinutes: number;
  markingScheme: { correct: number; wrong: number; skipped: number };
  totalQuestions: number;
  sourceQuestionCount: number;
  recoveredQuestionCount: number;
  omittedQuestionCount: number;
  scorableQuestionCount: number;
  pendingReviewCount: number;
  attemptCount: number;
  imageQuestionCount: number;
  assetCount: number;
  sourceFile: string | null;
  sourceMethod: string | null;
  sourceUrl?: string | null;
  sourceType?: "official_public" | "licensed" | "original" | "unknown";
  rightsStatus?: "unknown" | "cleared" | "restricted";
  rightsNote?: string | null;
  verifiedBy?: string | null;
  verifiedAt?: string | null;
  publicationStatus: string;
  reviewRequired: boolean;
  localPaper: true;
  draft: true;
  path: string;
}

export interface LocalSubjectSummary {
  subject: LocalSubject;
  paperCount: number;
  questionCount: number;
  scorableQuestionCount: number;
  pendingReviewCount: number;
  latestYear: number;
  latestPaperPath: string;
  href: string;
}

export function cleanText(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeOptionText(value: string | null | undefined): string {
  return cleanText(value).replace(/\s+/g, " ");
}

export function displayDate(date: string | null): string {
  if (!date) return "Date not printed";
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day || month < 1 || month > 12) return date;
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

export function optionLabel(
  rawId: string | null | undefined,
  index: number,
  used: Set<string>,
): string {
  const match = cleanText(rawId).match(/([A-F])$/i);
  let label = (match?.[1] ?? String.fromCharCode(65 + index)).toUpperCase();

  if (used.has(label)) {
    for (let i = 0; i < 26; i += 1) {
      const candidate = String.fromCharCode(65 + i);
      if (!used.has(candidate)) {
        label = candidate;
        break;
      }
    }
  }

  used.add(label);
  return label;
}

export function questionAssets(rawAssets: RawAsset[] | null | undefined): LocalQuestionAsset[] {
  const assets: LocalQuestionAsset[] = [];
  for (const raw of rawAssets ?? []) {
    const path = cleanText(raw.path);
    if (!path) continue;
    assets.push({
      id: cleanText(raw.id) || path,
      kind: cleanText(raw.kind) || "image",
      path,
      page: typeof raw.page === "number" && raw.page > 0 ? raw.page : null,
      alt: cleanText(raw.alt),
    });
  }
  return assets;
}

const ROMAN_LABELS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

export function listPairs(
  rawItems: RawListItem[] | null | undefined,
  fallbackLabels: (index: number) => string,
): LocalListPair[] {
  const items: LocalListPair[] = [];
  for (const [index, raw] of (rawItems ?? []).entries()) {
    const text = cleanText(raw.text).replace(/\s+/g, " ");
    if (!text) continue;
    items.push({
      label: cleanText(raw.label) || fallbackLabels(index),
      text,
    });
  }
  return items;
}

export function questionMatchList(raw: RawMatchList | null | undefined): LocalMatchList | null {
  if (!raw) return null;
  const listI = listPairs(raw.list_i, (index) => String.fromCharCode(65 + index));
  const listII = listPairs(raw.list_ii, (index) => ROMAN_LABELS[index] ?? String(index + 1));
  if (listI.length === 0 && listII.length === 0) return null;
  return { listI, listII };
}

export function questionArrangementItems(
  rawItems: RawListItem[] | null | undefined,
): LocalListPair[] {
  return listPairs(rawItems, (index) => String.fromCharCode(65 + index));
}

export function copyMatchList(matchList: LocalMatchList | null): LocalMatchList | null {
  if (!matchList) return null;
  return {
    listI: matchList.listI.map((item) => ({ ...item })),
    listII: matchList.listII.map((item) => ({ ...item })),
  };
}

/** Builds the slug → question key → stored key lookup from keys.json. */
export function createStoredKeys(
  bundle: RawKeyBundle | null | undefined,
): Map<string, Map<string, RawStoredKey>> {
  const stored = new Map<string, Map<string, RawStoredKey>>();
  for (const [slug, entries] of Object.entries(bundle?.papers ?? {})) {
    stored.set(slug, new Map(Object.entries(entries)));
  }
  return stored;
}

export function buildQuestion(
  raw: RawQuestion,
  index: number,
  passages: Map<string, LocalQuestionPassage>,
  storedKeys: Map<string, RawStoredKey> | undefined,
): LocalNormalizedQuestion | null {
  const assets = questionAssets(raw.assets);
  const bodyIsImage = assets.some((asset) => asset.kind === "question");
  const stem = cleanText(raw.stemEn);

  const usedLabels = new Set<string>();
  const options: LocalQuestionOption[] = [];
  for (const [optionIndex, option] of (raw.optionsEn ?? []).entries()) {
    const rawImage = option.image_url || option.image;
    options.push({
      id: optionLabel(option.id, optionIndex, usedLabels),
      text: normalizeOptionText(option.text),
      ...(rawImage ? { image_url: cleanText(rawImage) } : {}),
    });
  }

  const optionsAreImages = Boolean(raw.optionsAreImages);
  const readableOptions = options.filter((option) => option.text.length > 0);
  const playable =
    options.length >= 2 &&
    (bodyIsImage || optionsAreImages || (stem.length > 0 && readableOptions.length >= 2));
  if (!playable) return null;

  const passageId = cleanText(raw.passageId);
  const questionNumber =
    typeof raw.sourceQuestionNo === "number" && raw.sourceQuestionNo > 0
      ? raw.sourceQuestionNo
      : index + 1;
  const questionId = cleanText(raw.id) || `q${String(questionNumber).padStart(2, "0")}`;
  const stored = storedKeys?.get(questionId);
  const answer = (cleanText(raw.correctAnswer) || cleanText(stored?.a)).toUpperCase();
  const hasKey = answer.length > 0 && options.some((option) => option.id === answer);

  return {
    id: questionId,
    number: questionNumber,
    stemEn: stem,
    options,
    optionsAreImages,
    bodyIsImage,
    correctAnswer: hasKey ? answer : null,
    explanation: cleanText(raw.explanationEn) || cleanText(stored?.e) || null,
    passage: passages.get(passageId) ?? null,
    matchList: questionMatchList(raw.matchList),
    arrangementItems: questionArrangementItems(raw.arrangementItems),
    scorable: hasKey,
    reviewFlags: (raw.reviewFlags ?? []).map((flag) => cleanText(flag)).filter(Boolean),
    assets,
  };
}

/** Normalised passages for one paper, preserving the printed order. */
export function buildPassages(raw: RawPaper): LocalQuestionPassage[] {
  const passages: LocalQuestionPassage[] = [];
  for (const passage of raw.exam?.passages ?? []) {
    const id = cleanText(passage.id);
    const content = cleanText(passage.contentEn);
    if (!id || !content) continue;
    passages.push({
      id,
      title: cleanText(passage.title) || "Reading passage",
      content,
    });
  }
  return passages;
}

export function buildPaper(
  raw: RawPaper,
  summary: LocalPaperSummary,
  storedKeys?: Map<string, RawStoredKey>,
): LocalPaper | null {
  const exam = raw.exam;
  if (!exam) return null;

  const passages = new Map<string, LocalQuestionPassage>();
  for (const passage of buildPassages(raw)) {
    passages.set(passage.id, passage);
  }

  const questions: LocalNormalizedQuestion[] = [];
  for (const [index, rawQuestion] of (exam.questions ?? []).entries()) {
    const question = buildQuestion(rawQuestion, index, passages, storedKeys);
    if (question) questions.push(question);
  }
  questions.sort((a, b) => a.number - b.number);
  if (questions.length === 0) return null;

  const sourceQuestionCount = Math.max(
    summary.sourceQuestionCount,
    typeof exam.sourceQuestionCount === "number" ? exam.sourceQuestionCount : 0,
    questions.length,
  );
  const scorableQuestionCount = questions.filter((question) => question.scorable).length;
  const date = cleanText(exam.examDate) || summary.date;

  return {
    slug: summary.slug,
    id: summary.id,
    title: summary.title,
    subject: { ...summary.subject },
    year: summary.year,
    date: date || null,
    dateLabel: summary.dateLabel || displayDate(date),
    shift: summary.shift,
    durationMinutes: summary.durationMinutes,
    sourceFile: cleanText(exam.sourceFile) || summary.sourceFile,
    sourceMethod: cleanText(exam.sourceMethod) || summary.sourceMethod,
    publicationStatus: summary.publicationStatus,
    reviewRequired: summary.reviewRequired,
    sourceQuestionCount,
    omittedQuestionCount: Math.max(0, sourceQuestionCount - questions.length),
    scorableQuestionCount,
    pendingReviewCount: questions.length - scorableQuestionCount,
    questions,
  };
}

export function buildSummary(raw: RawIndexPaper): LocalPaperSummary | null {
  const slug = cleanText(raw.slug);
  if (!slug) return null;
  const date = cleanText(raw.date) || null;
  const subjectName = cleanText(raw.subject?.name) || "CUET";
  const subjectSlug = cleanText(raw.subject?.slug) || "cuet";
  const questionCount = Math.max(0, raw.questionCount ?? 0);
  const scorable = Math.max(0, raw.scorableQuestionCount ?? 0);
  const sourceCount = Math.max(questionCount, raw.sourceQuestionCount ?? 0);
  const year = raw.year ?? (date ? Number(date.slice(0, 4)) : 0);
  return {
    id: cleanText(raw.id) || `local-${slug}`,
    slug,
    title: cleanText(raw.title) || slug,
    metaDescription: cleanText(raw.metaDescription),
    year,
    subject: {
      id: cleanText(raw.subject?.id) || `local-${subjectSlug}`,
      name: subjectName,
      slug: subjectSlug,
      code: cleanText(raw.subject?.code),
    },
    date,
    dateLabel: cleanText(raw.dateLabel) || displayDate(date),
    shift: cleanText(raw.shift) || null,
    durationMinutes: raw.durationMinutes ?? LOCAL_DURATION_MINUTES,
    markingScheme: { ...LOCAL_MARKING_SCHEME },
    totalQuestions: questionCount,
    sourceQuestionCount: sourceCount,
    recoveredQuestionCount: questionCount,
    omittedQuestionCount: Math.max(0, sourceCount - questionCount),
    scorableQuestionCount: scorable,
    pendingReviewCount: Math.max(0, raw.pendingReviewCount ?? questionCount - scorable),
    attemptCount: Math.max(0, raw.attemptCount ?? 0),
    imageQuestionCount: Math.max(0, raw.imageQuestionCount ?? 0),
    assetCount: Math.max(0, raw.assetCount ?? 0),
    sourceFile: cleanText(raw.sourceFile) || null,
    sourceMethod: cleanText(raw.sourceMethod) || null,
    publicationStatus: cleanText(raw.publicationStatus) || "draft",
    reviewRequired: raw.reviewRequired !== false,
    localPaper: true,
    draft: true,
    path: `${LOCAL_LIBRARY_PATH}/${slug}`,
  };
}

/** Canonical ordering used by every library listing. */
export function sortPracticeSummaries(papers: LocalPaperSummary[]): LocalPaperSummary[] {
  return [...papers].sort(
    (a, b) =>
      b.year - a.year ||
      a.subject.name.localeCompare(b.subject.name) ||
      (a.date ?? "").localeCompare(b.date ?? "") ||
      (a.shift ?? "").localeCompare(b.shift ?? ""),
  );
}

/** Subject rollup shared by the public pages and the admin overview. */
export function buildSubjectSummaries(
  papers: LocalPaperSummary[],
): Map<string, LocalSubjectSummary> {
  const bySubject = new Map<string, LocalSubjectSummary>();
  for (const paper of papers) {
    const current = bySubject.get(paper.subject.slug);
    const latest = !current || paper.year > current.latestYear;
    const entry: LocalSubjectSummary =
      current ?? {
        subject: { ...paper.subject },
        paperCount: 0,
        questionCount: 0,
        scorableQuestionCount: 0,
        pendingReviewCount: 0,
        latestYear: paper.year,
        latestPaperPath: paper.path,
        href: `/pyq/${paper.year}/${paper.subject.slug}`,
      };
    entry.paperCount += 1;
    entry.questionCount += paper.recoveredQuestionCount;
    entry.scorableQuestionCount += paper.scorableQuestionCount;
    entry.pendingReviewCount += paper.pendingReviewCount;
    if (latest) {
      entry.latestYear = paper.year;
      entry.latestPaperPath = paper.path;
      entry.href = `/pyq/${paper.year}/${paper.subject.slug}`;
    }
    bySubject.set(paper.subject.slug, entry);
  }
  return bySubject;
}
