import {
  displayDate,
  LOCAL_LIBRARY_PATH,
  LOCAL_MARKING_SCHEME,
  type LocalListPair,
  type LocalMatchList,
  type LocalNormalizedQuestion,
  type LocalPaper,
  type LocalPaperSummary,
  type LocalQuestionAsset,
  type LocalQuestionOption,
  type LocalQuestionPassage,
  type LocalSubject,
} from "./practice-normalize";
import { calculateMockDuration } from "./exam-timing";

/**
 * Row shapes and pure mappers for the D1 practice store.
 *
 * Kept free of `cloudflare:workers` so unit tests can prove that a row written
 * by the importer maps back to exactly the same normalised paper as the JSON
 * builder.
 */

export interface PaperIndexRow {
  slug: string;
  title: string;
  meta_description: string;
  year: number;
  exam_date: string | null;
  date_label: string;
  shift: string | null;
  duration_min: number;
  source_file: string | null;
  source_method: string | null;
  source_url?: string | null;
  source_type?: string | null;
  rights_status?: string | null;
  rights_note?: string | null;
  verified_by?: string | null;
  verified_at?: string | null;
  source_question_count: number;
  publication_status: string;
  review_required: number;
  subject_name: string;
  subject_slug: string;
  subject_code: string | null;
  question_count: number;
  scorable_count: number;
  image_question_count: number;
  asset_count: number;
  attempt_count?: number | null;
}

export type PaperRow = Omit<
  PaperIndexRow,
  "question_count" | "scorable_count" | "image_question_count" | "asset_count"
>;

export interface PassageRow {
  passage_key: string;
  title: string;
  body: string;
}

export interface QuestionRow {
  question_key: string;
  source_question_no: number | null;
  position: number;
  stem: string;
  options_json: string;
  options_are_images: number;
  correct_option: string | null;
  explanation: string | null;
  passage_key: string | null;
  match_list_json: string | null;
  arrangement_json: string;
  assets_json: string;
  review_flags_json: string;
}

function subject(row: {
  subject_name: string;
  subject_slug: string;
  subject_code: string | null;
}): LocalSubject {
  return {
    id: `local-${row.subject_slug}`,
    name: row.subject_name,
    slug: row.subject_slug,
    code: row.subject_code ?? "",
  };
}

export function mapIndexRow(row: PaperIndexRow): LocalPaperSummary {
  const questionCount = Number(row.question_count) || 0;
  const scorable = Math.min(Number(row.scorable_count) || 0, questionCount);
  const sourceCount = Math.max(Number(row.source_question_count) || 0, questionCount);
  return {
    id: `local-${row.slug}`,
    slug: row.slug,
    title: row.title,
    metaDescription: row.meta_description,
    year: row.year,
    subject: subject(row),
    date: row.exam_date,
    dateLabel: row.date_label || displayDate(row.exam_date),
    shift: row.shift,
    durationMinutes: calculateMockDuration(scorable || questionCount, row.subject_name).durationMinutes,
    markingScheme: { ...LOCAL_MARKING_SCHEME },
    totalQuestions: questionCount,
    sourceQuestionCount: sourceCount,
    recoveredQuestionCount: questionCount,
    omittedQuestionCount: Math.max(0, sourceCount - questionCount),
    scorableQuestionCount: scorable,
    pendingReviewCount: Math.max(0, questionCount - scorable),
    attemptCount: Math.max(0, Number(row.attempt_count) || 0),
    imageQuestionCount: Number(row.image_question_count) || 0,
    assetCount: Number(row.asset_count) || 0,
    sourceFile: row.source_file,
    sourceMethod: row.source_method,
    ...(row.rights_status !== undefined ? { rightsStatus: row.rights_status as any } : {}),
    ...(row.source_type !== undefined ? { sourceType: row.source_type as any } : {}),
    ...(row.source_url !== undefined ? { sourceUrl: row.source_url } : {}),
    ...(row.rights_note !== undefined ? { rightsNote: row.rights_note } : {}),
    ...(row.verified_by !== undefined ? { verifiedBy: row.verified_by } : {}),
    ...(row.verified_at !== undefined ? { verifiedAt: row.verified_at } : {}),
    publicationStatus: row.publication_status,
    reviewRequired: Boolean(row.review_required),
    localPaper: true,
    draft: true,
    path: `${LOCAL_LIBRARY_PATH}/${row.slug}`,
  };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function mapQuestion(
  row: QuestionRow,
  passages: Map<string, LocalQuestionPassage>,
): LocalNormalizedQuestion {
  const options = parseJson<LocalQuestionOption[]>(row.options_json, []);
  const assets = parseJson<LocalQuestionAsset[]>(row.assets_json, []);
  const answer = (row.correct_option ?? "").toUpperCase();
  const hasKey = answer.length > 0 && options.some((option) => option.id === answer);
  const passageKey = row.passage_key ?? "";
  return {
    id: row.question_key,
    number:
      row.source_question_no && row.source_question_no > 0 ? row.source_question_no : row.position,
    stemEn: row.stem,
    options,
    optionsAreImages: Boolean(row.options_are_images),
    bodyIsImage: assets.some((asset) => asset.kind === "question"),
    correctAnswer: hasKey ? answer : null,
    explanation: row.explanation,
    passage: passages.get(passageKey) ?? null,
    matchList: parseJson<LocalMatchList | null>(row.match_list_json, null),
    arrangementItems: parseJson<LocalListPair[]>(row.arrangement_json, []),
    scorable: hasKey,
    reviewFlags: parseJson<string[]>(row.review_flags_json, []),
    assets,
  };
}

export function mapPaperRow(
  row: PaperRow,
  passages: PassageRow[],
  questions: QuestionRow[],
): LocalPaper {
  const passageMap = new Map<string, LocalQuestionPassage>();
  for (const passage of passages) {
    passageMap.set(passage.passage_key, {
      id: passage.passage_key,
      title: passage.title || "Reading passage",
      content: passage.body,
    });
  }

  const normalised = questions.map((question) => mapQuestion(question, passageMap));
  normalised.sort((a, b) => a.number - b.number);

  const scorableQuestionCount = normalised.filter((question) => question.scorable).length;
  const sourceQuestionCount = Math.max(Number(row.source_question_count) || 0, normalised.length);

  return {
    slug: row.slug,
    id: `local-${row.slug}`,
    title: row.title,
    subject: subject(row),
    year: row.year,
    date: row.exam_date,
    dateLabel: row.date_label || displayDate(row.exam_date),
    shift: row.shift,
    durationMinutes: calculateMockDuration(
      scorableQuestionCount || normalised.length,
      row.subject_name,
    ).durationMinutes,
    sourceFile: row.source_file,
    sourceMethod: row.source_method,
    ...(row.rights_status !== undefined ? { rightsStatus: row.rights_status as any } : {}),
    ...(row.source_type !== undefined ? { sourceType: row.source_type as any } : {}),
    ...(row.source_url !== undefined ? { sourceUrl: row.source_url } : {}),
    ...(row.rights_note !== undefined ? { rightsNote: row.rights_note } : {}),
    ...(row.verified_by !== undefined ? { verifiedBy: row.verified_by } : {}),
    ...(row.verified_at !== undefined ? { verifiedAt: row.verified_at } : {}),
    publicationStatus: row.publication_status,
    reviewRequired: Boolean(row.review_required),
    sourceQuestionCount,
    omittedQuestionCount: Math.max(0, sourceQuestionCount - normalised.length),
    scorableQuestionCount,
    pendingReviewCount: normalised.length - scorableQuestionCount,
    questions: normalised,
  };
}
