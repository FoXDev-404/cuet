import { all, first } from "../db";
import { isValidPublicId, questionSharePath } from "./public-id";
import type { RevealPolicy } from "./policy";
import {
  canViewerCheck,
  isSeoEligible,
  optionsForPublic,
  optionsForPublicHindi,
  type PublicQuestionPassage,
  type PublicQuestionView,
} from "./public-question";

/**
 * Server-side resolution for shared questions.
 *
 * The mapping points at the current lineage head, which may be a draft. Public
 * readers get the newest published revision in that lineage. The DB id is kept
 * only in this server object so the check endpoint can grade an answer; the
 * returned view and every JSON payload omit it.
 */

type MappingRow = {
  public_id: string;
  current_question_id: number;
  share_enabled: number;
  reveal_policy: RevealPolicy;
  seo_indexable: number;
  rights_ok: number;
};

type LineageRow = {
  id: number;
  text: string;
  text_hi: string | null;
  options: string;
  options_hi: string | null;
  correct_option: number;
  explanation: string | null;
  explanation_hi: string | null;
  image_url: string | null;
  image_alt: string | null;
  explanation_image_url: string | null;
  explanation_image_alt: string | null;
  difficulty: string | null;
  year: number | null;
  status: "draft" | "in_review" | "published";
  deleted_at: string | null;
  passage_id: number | null;
  updated_at: string | null;
  created_at: string;
  depth: number;
  subject_name: string;
  subject_slug: string;
  topic_name: string | null;
  topic_slug: string | null;
  passage_body: string | null;
  passage_body_hi: string | null;
  passage_image_url: string | null;
  passage_image_alt: string | null;
};

type MockMembershipRow = {
  title: string;
  slug: string;
  type: string;
  status: string;
  published_at: string | null;
};

export type ResolvedPublicQuestion = {
  view: PublicQuestionView;
  /** Internal only: used by the check endpoint, never serialized. */
  question: {
    id: number;
    correctOption: number;
    explanation: string | null;
    explanationHi: string | null;
    explanationImageUrl: string | null;
    explanationImageAlt: string | null;
  };
  lineageIds: number[];
  path: string;
  canCheck: boolean;
  /** Last content change of the published revision, for sitemap `lastmod`. */
  lastmod: string;
};

const LINEAGE_SQL = `
  WITH RECURSIVE chain(
    id, text, text_hi, options, options_hi, correct_option, explanation,
    explanation_hi, image_url, image_alt, explanation_image_url,
    explanation_image_alt, difficulty, year, status, deleted_at, passage_id,
    subject_id, topic_id, supersedes_id, updated_at, created_at, depth
  ) AS (
    SELECT q.id, q.text, q.text_hi, q.options, q.options_hi, q.correct_option,
           q.explanation, q.explanation_hi, q.image_url, q.image_alt,
           q.explanation_image_url, q.explanation_image_alt, q.difficulty,
           q.year, q.status, q.deleted_at, q.passage_id, q.subject_id,
           q.topic_id, q.supersedes_id, q.updated_at, q.created_at, 0
    FROM questions q
    WHERE q.id = ?
    UNION ALL
    SELECT q.id, q.text, q.text_hi, q.options, q.options_hi, q.correct_option,
           q.explanation, q.explanation_hi, q.image_url, q.image_alt,
           q.explanation_image_url, q.explanation_image_alt, q.difficulty,
           q.year, q.status, q.deleted_at, q.passage_id, q.subject_id,
           q.topic_id, q.supersedes_id, q.updated_at, q.created_at, c.depth + 1
    FROM questions q
    JOIN chain c ON q.id = c.supersedes_id
  )
  SELECT chain.*, s.name AS subject_name, s.slug AS subject_slug,
         t.name AS topic_name, t.slug AS topic_slug,
         p.body AS passage_body, p.body_hi AS passage_body_hi,
         p.image_url AS passage_image_url, p.image_alt AS passage_image_alt
  FROM chain
  JOIN subjects s ON s.id = chain.subject_id
  LEFT JOIN topics t ON t.id = chain.topic_id
  LEFT JOIN passages p ON p.id = chain.passage_id
  ORDER BY chain.depth ASC
`;

function inClause(values: number[]): { sql: string; params: number[] } {
  return { sql: values.map(() => "?").join(", "), params: values };
}

async function hasSubmittedAttempt(
  userId: number,
  lineageIds: number[],
): Promise<boolean> {
  const clause = inClause(lineageIds);
  const row = await first<{ eligible: number }>(
    `SELECT EXISTS (
       SELECT 1
       FROM attempts a
       JOIN attempt_answers aa ON aa.attempt_id = a.id
       WHERE a.user_id = ? AND a.status = 'submitted'
         AND aa.question_id IN (${clause.sql})
     ) AS eligible`,
    userId,
    ...clause.params,
  );
  return Number(row?.eligible ?? 0) === 1;
}

async function loadMockMembership(lineageIds: number[]): Promise<MockMembershipRow[]> {
  const clause = inClause(lineageIds);
  return all<MockMembershipRow>(
    // Start from the question-id index instead of scanning every mock. The
    // view `mock_questions_current` is convenient but its join order makes the
    // planner walk all mocks; this equivalent join keeps the lookup bounded.
    `SELECT DISTINCT m.title, m.slug, m.type, m.status, m.published_at
     FROM mock_questions mq
     JOIN mock_test_versions v ON v.id = mq.version_id
     JOIN mock_tests m ON m.id = v.mock_id AND m.current_version_id = v.id
     WHERE mq.question_id IN (${clause.sql}) AND m.deleted_at IS NULL
     ORDER BY m.published_at DESC, m.id DESC`,
    ...clause.params,
  );
}

export async function resolvePublicQuestion(
  publicId: string,
  viewerUserId: number | null,
): Promise<ResolvedPublicQuestion | null> {
  if (!isValidPublicId(publicId)) return null;

  const mapping = await first<MappingRow>(
    `SELECT public_id, current_question_id, share_enabled, reveal_policy,
            seo_indexable, rights_ok
     FROM question_public_ids
     WHERE public_id = ?`,
    publicId,
  );
  if (!mapping || Number(mapping.share_enabled) !== 1) return null;

  const rows = await all<LineageRow>(LINEAGE_SQL, mapping.current_question_id);
  const current = rows[0];
  if (!current || current.deleted_at) return null;

  // The pointer always names the current head, but a draft head is not public.
  const published = rows.find(
    (row) => row.status === "published" && !row.deleted_at,
  );
  if (!published) return null;

  const lineageIds = rows.map((row) => row.id);
  const memberships = await loadMockMembership(lineageIds);
  const inPublishedMock = memberships.some((mock) => mock.status === "published");
  const isPyq =
    published.year !== null || memberships.some((mock) => mock.type === "pyq");
  const rightsOk = Number(mapping.rights_ok) === 1;

  // A revoked rights confirmation must stop already-shared PYQ links too.
  if (isPyq && !rightsOk) return null;

  const revealPolicy = mapping.reveal_policy;
  const submitted =
    viewerUserId !== null && revealPolicy === "attempted_only"
      ? await hasSubmittedAttempt(viewerUserId, lineageIds)
      : false;
  const canCheck = canViewerCheck({
    revealPolicy,
    inPublishedMock,
    hasSubmittedAttempt: submitted,
  });

  const seoEligible = isSeoEligible({
    published: true,
    seoIndexable: Number(mapping.seo_indexable) === 1,
    revealPolicy,
    rightsOk,
    hasExplanation: Boolean(published.explanation?.trim()),
    inPublishedMock,
  });

  const relatedMocks = memberships
    .filter((mock) => mock.status === "published")
    .filter(
      (mock, index, list) =>
        list.findIndex((candidate) => candidate.slug === mock.slug) === index,
    )
    .slice(0, 3)
    .map((mock) => ({ title: mock.title, slug: mock.slug }));

  const passage: PublicQuestionPassage | null = published.passage_id
    ? {
        body: published.passage_body ?? "",
        bodyHi: published.passage_body_hi,
        imageUrl: published.passage_image_url,
        imageAlt: published.passage_image_alt,
      }
    : null;

  const path = questionSharePath(publicId, published.text);

  return {
    view: {
      publicId,
      path,
      canCheck,
      seoEligible,
      revealPolicy,
      text: published.text,
      textHi: published.text_hi,
      options: optionsForPublic(published.options),
      optionsHi: optionsForPublicHindi(published.options_hi),
      imageUrl: published.image_url,
      imageAlt: published.image_alt,
      passage,
      subject: { name: published.subject_name, slug: published.subject_slug },
      topic:
        published.topic_name && published.topic_slug
          ? { name: published.topic_name, slug: published.topic_slug }
          : null,
      year: published.year,
      difficulty: published.difficulty,
      relatedMocks,
    },
    question: {
      id: published.id,
      correctOption: published.correct_option,
      explanation: published.explanation,
      explanationHi: published.explanation_hi,
      explanationImageUrl: published.explanation_image_url,
      explanationImageAlt: published.explanation_image_alt,
    },
    lineageIds,
    path,
    canCheck,
    lastmod: published.updated_at ?? published.created_at,
  };
}

export type ShareMapping = {
  publicId: string;
  shareEnabled: boolean;
  revealPolicy: RevealPolicy;
};

/**
 * Batch-resolve the public mapping for solution rows.
 *
 * A frozen mock version may point at an older revision, so the recursive walk
 * follows `supersedes_id` forward until it finds the lineage's current head.
 * Sharing is only offered when the mapping is enabled. One query is used for
 * the whole solutions page instead of one lookup per question.
 */
export async function shareMappingsForQuestionIds(
  questionIds: number[],
): Promise<Map<number, ShareMapping>> {
  const ids = [...new Set(questionIds.filter((id) => Number.isInteger(id) && id > 0))];
  if (ids.length === 0) return new Map();

  const rows = await all<{
    question_id: number;
    public_id: string;
    share_enabled: number;
    reveal_policy: RevealPolicy;
  }>(
    `WITH RECURSIVE chain(start_id, id) AS (
       SELECT id, id FROM questions WHERE id IN (${inClause(ids).sql})
       UNION
       SELECT c.start_id, q.id
       FROM questions q JOIN chain c ON q.supersedes_id = c.id
     )
     SELECT c.start_id AS question_id, qpi.public_id,
            qpi.share_enabled, qpi.reveal_policy
     FROM chain c
     JOIN question_public_ids qpi ON qpi.current_question_id = c.id
     WHERE qpi.share_enabled = 1`,
    ...ids,
  );

  return new Map(
    rows.map((row) => [
      Number(row.question_id),
      {
        publicId: row.public_id,
        shareEnabled: Number(row.share_enabled) === 1,
        revealPolicy: row.reveal_policy,
      },
    ]),
  );
}

export type SeoIndexableQuestion = {
  publicId: string;
  path: string;
  lastmod: string;
};

/**
 * Resolve the shared questions that may appear in the sitemap.
 *
 * The mapping flags are only a cheap pre-filter: `resolvePublicQuestion` is the
 * single source of truth for `seoEligible`, so a question hidden by a published
 * mock, a soft-deleted lineage, revoked rights or a missing explanation is
 * excluded here exactly as it is on the page itself.
 */
export async function listSeoIndexableQuestions(): Promise<SeoIndexableQuestion[]> {
  const candidates = await all<{ public_id: string }>(
    `SELECT public_id
     FROM question_public_ids
     WHERE share_enabled = 1
       AND seo_indexable = 1
       AND reveal_policy = 'public'
       AND rights_ok = 1
     ORDER BY public_id`,
  );

  const questions: SeoIndexableQuestion[] = [];
  for (const candidate of candidates) {
    const resolved = await resolvePublicQuestion(candidate.public_id, null);
    if (!resolved?.view.seoEligible) continue;
    questions.push({
      publicId: candidate.public_id,
      path: resolved.path,
      lastmod: resolved.lastmod,
    });
  }
  return questions;
}

export type CheckResult =
  | {
      ok: true;
      correct: boolean;
      correctOption: number;
      explanationHtml: string;
      explanationHiHtml: string;
      explanationImageUrl: string | null;
      explanationImageAlt: string | null;
    }
  | { ok: false; status: 400 | 403 | 404; error: string; cta: { href: string; label: string } | null };

export async function checkPublicQuestion(
  publicId: string,
  option: number,
  viewerUserId: number | null,
): Promise<CheckResult> {
  const resolved = await resolvePublicQuestion(publicId, viewerUserId);
  if (!resolved) {
    return { ok: false, status: 404, error: "Question not found.", cta: null };
  }
  if (!resolved.canCheck) {
    const mock = resolved.view.relatedMocks[0];
    return {
      ok: false,
      status: 403,
      error: "Attempt the full mock to see the solution.",
      cta: mock
        ? { href: `/mock/${mock.slug}/instructions`, label: "Attempt this mock" }
        : { href: "/mock-tests", label: "Browse CUET mock tests" },
    };
  }
  if (!Number.isInteger(option) || option < 0 || option >= resolved.view.options.length) {
    return {
      ok: false,
      status: 400,
      error: "Choose one of the available options.",
      cta: null,
    };
  }

  const { renderRichText } = await import("../rich-text");
  return {
    ok: true,
    correct: option === resolved.question.correctOption,
    correctOption: resolved.question.correctOption,
    explanationHtml: renderRichText(resolved.question.explanation),
    explanationHiHtml: renderRichText(resolved.question.explanationHi),
    explanationImageUrl: resolved.question.explanationImageUrl,
    explanationImageAlt: resolved.question.explanationImageAlt,
  };
}
