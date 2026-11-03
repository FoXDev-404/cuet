/**
 * Pure merge logic behind {@link getSubjectStats}.
 *
 * Kept in its own module so it can be unit-tested without loading the D1 /
 * Workers KV bindings that `subject-stats.ts` needs.
 */

export interface SubjectStatRow {
  id: number;
  name: string;
  slug: string;
  type: string;
  exam_name: string;
  exam_slug: string;
  /** Every published question for the subject, attached to a mock or not. */
  published_question_count: number;
  /** Questions attached to a published, non-practice mock. */
  bank_question_count: number;
  /** Questions attached to any published mock (practice papers included). */
  all_mock_question_count: number;
  /** Published non-practice mocks with at least one question of this subject. */
  question_mock_count: number;
  /** Published non-practice mocks that point at this subject directly. */
  direct_mock_count: number;
  /** Distinct published non-practice mocks covering the subject. */
  mock_count: number;
  /** Distinct published mocks covering the subject, practice papers included. */
  all_mock_count: number;
}

export interface SubjectRow {
  id: number;
  name: string;
  slug: string;
  type: string;
  exam_name: string;
  exam_slug: string;
}

export interface QuestionCountRow {
  subject_id: number;
  question_count: number;
}

export interface MockQuestionRow {
  mock_id: number;
  question_id: number;
  subject_id: number;
  practice: number;
}

export interface MockRow {
  id: number;
  subject_id: number | null;
  practice: number;
}

function addToSet<K, V>(map: Map<K, Set<V>>, key: K, value: V): void {
  const set = map.get(key);
  if (set) set.add(value);
  else map.set(key, new Set([value]));
}

/** Combines the four flat query results into one row per subject. */
export function buildSubjectStats(
  subjects: SubjectRow[],
  publishedQuestions: QuestionCountRow[],
  mockQuestions: MockQuestionRow[],
  mocks: MockRow[],
): SubjectStatRow[] {
  const published = new Map(
    publishedQuestions.map((row) => [row.subject_id, Number(row.question_count)]),
  );
  const allMockQuestions = new Map<number, Set<number>>();
  const bankQuestions = new Map<number, Set<number>>();
  const allMocks = new Map<number, Set<number>>();
  const bankMocks = new Map<number, Set<number>>();
  const questionMocks = new Map<number, Set<number>>();
  const directMocks = new Map<number, Set<number>>();

  for (const row of mockQuestions) {
    addToSet(allMocks, row.subject_id, row.mock_id);
    addToSet(allMockQuestions, row.subject_id, row.question_id);
    if (row.practice) continue;
    addToSet(bankMocks, row.subject_id, row.mock_id);
    addToSet(bankQuestions, row.subject_id, row.question_id);
    addToSet(questionMocks, row.subject_id, row.mock_id);
  }

  for (const mock of mocks) {
    if (mock.subject_id == null) continue;
    addToSet(allMocks, mock.subject_id, mock.id);
    if (mock.practice) continue;
    addToSet(bankMocks, mock.subject_id, mock.id);
    addToSet(directMocks, mock.subject_id, mock.id);
  }

  return subjects.map((subject) => ({
    ...subject,
    published_question_count: published.get(subject.id) ?? 0,
    bank_question_count: bankQuestions.get(subject.id)?.size ?? 0,
    all_mock_question_count: allMockQuestions.get(subject.id)?.size ?? 0,
    question_mock_count: questionMocks.get(subject.id)?.size ?? 0,
    direct_mock_count: directMocks.get(subject.id)?.size ?? 0,
    mock_count: bankMocks.get(subject.id)?.size ?? 0,
    all_mock_count: allMocks.get(subject.id)?.size ?? 0,
  }));
}
