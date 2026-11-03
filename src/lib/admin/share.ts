import { all, first, run } from "../db";
import {
  generatePublicId,
  isPublicIdCollision,
  questionSharePath,
} from "../share/public-id";
import {
  publicRevealBlockers,
  seoBlockers,
  shareEnabledBlockers,
  type RevealPolicy,
  type ShareBlockers,
  type SharePolicyFlags,
} from "../share/policy";

export type { RevealPolicy, ShareBlockers } from "../share/policy";

export type QuestionShareRow = {
  public_id: string;
  current_question_id: number;
  share_enabled: number;
  reveal_policy: RevealPolicy;
  seo_indexable: number;
  rights_ok: number;
  created_at: string;
};

export type QuestionShareFlags = SharePolicyFlags;

export type ShareCounts = {
  total: number;
  last30Days: number;
  byContext: Record<string, number>;
  byChannel: Record<string, number>;
};

export type QuestionShareInfo = {
  publicId: string;
  path: string;
  currentQuestionId: number;
  publishedRevisionId: number | null;
  flags: QuestionShareFlags;
  isPyq: boolean;
  hasExplanation: boolean;
  inPublishedMock: boolean;
  blockers: ShareBlockers;
  counts: ShareCounts;
  createdAt: string;
};

type LineageQuestion = {
  id: number;
  supersedes_id: number | null;
  status: "draft" | "in_review" | "published";
  deleted_at: string | null;
  year: number | null;
  text: string;
  has_explanation: number;
  depth: number;
};

type Lineage = {
  rootId: number;
  head: LineageQuestion;
  published: LineageQuestion | null;
};

const EMPTY_COUNTS: ShareCounts = {
  total: 0,
  last30Days: 0,
  byContext: {},
  byChannel: {},
};

async function loadLineage(questionId: number): Promise<Lineage | null> {
  const ancestors = await all<{ id: number; supersedes_id: number | null }>(
    `WITH RECURSIVE chain(id, supersedes_id) AS (
       SELECT id, supersedes_id FROM questions WHERE id = ?
       UNION
       SELECT q.id, q.supersedes_id
       FROM questions q JOIN chain c ON q.id = c.supersedes_id
     )
     SELECT id, supersedes_id FROM chain LIMIT 500`,
    questionId,
  );
  if (ancestors.length === 0) return null;

  const root =
    ancestors.find((row) => row.supersedes_id === null) ??
    [...ancestors].sort((a, b) => a.id - b.id)[0];
  if (!root) return null;

  const rows = await all<LineageQuestion>(
    `WITH RECURSIVE chain(id, supersedes_id, status, deleted_at, year, text, has_explanation, depth) AS (
       SELECT id, supersedes_id, status, deleted_at, year, text,
              CASE WHEN explanation IS NOT NULL AND trim(explanation) <> '' THEN 1 ELSE 0 END,
              0
       FROM questions WHERE id = ?
       UNION ALL
       SELECT q.id, q.supersedes_id, q.status, q.deleted_at, q.year, q.text,
              CASE WHEN q.explanation IS NOT NULL AND trim(q.explanation) <> '' THEN 1 ELSE 0 END,
              c.depth + 1
       FROM questions q JOIN chain c ON q.supersedes_id = c.id
     )
     SELECT id, supersedes_id, status, deleted_at, year, text, has_explanation, depth
     FROM chain
     ORDER BY depth ASC, id ASC`,
    root.id,
  );

  const visible = rows.filter((row) => !row.deleted_at);
  const head = [...visible].sort((a, b) => b.depth - a.depth || b.id - a.id)[0];
  if (!head) return null;

  const published =
    [...visible]
      .filter((row) => row.status === "published")
      .sort((a, b) => b.depth - a.depth || b.id - a.id)[0] ?? null;

  return { rootId: root.id, head, published };
}

async function findMappingForLineage(rootQuestionId: number): Promise<QuestionShareRow | null> {
  return first<QuestionShareRow>(
    `WITH RECURSIVE chain(id) AS (
       SELECT id FROM questions WHERE id = ?
       UNION ALL
       SELECT q.id FROM questions q JOIN chain c ON q.supersedes_id = c.id
     )
     SELECT qpi.public_id, qpi.current_question_id, qpi.share_enabled,
            qpi.reveal_policy, qpi.seo_indexable, qpi.rights_ok, qpi.created_at
     FROM question_public_ids qpi
     WHERE qpi.current_question_id IN (SELECT id FROM chain)
     ORDER BY qpi.created_at ASC
     LIMIT 1`,
    rootQuestionId,
  );
}

async function insertMapping(
  questionId: number,
  rootQuestionId: number,
  shareEnabled: number,
): Promise<QuestionShareRow> {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const publicId = generatePublicId();
    try {
      await run(
        `INSERT INTO question_public_ids
           (public_id, current_question_id, share_enabled, reveal_policy, seo_indexable, rights_ok)
         VALUES (?, ?, ?, 'attempted_only', 0, 0)`,
        publicId,
        questionId,
        shareEnabled,
      );
      const inserted = await first<QuestionShareRow>(
        `SELECT public_id, current_question_id, share_enabled, reveal_policy,
                seo_indexable, rights_ok, created_at
         FROM question_public_ids WHERE public_id = ?`,
        publicId,
      );
      if (inserted) return inserted;
    } catch (error) {
      if (isPublicIdCollision(error)) continue;
      const message = error instanceof Error ? error.message : String(error);
      if (/UNIQUE constraint failed: question_public_ids\.current_question_id/i.test(message)) {
        const existing = await findMappingForLineage(rootQuestionId);
        if (existing) return existing;
      }
      throw error;
    }
  }
  throw new Error("Could not allocate a unique public question id.");
}

async function ensureMapping(lineage: Lineage): Promise<QuestionShareRow> {
  const existing = await findMappingForLineage(lineage.rootId);
  if (existing) {
    if (existing.current_question_id !== lineage.head.id) {
      await run(
        "UPDATE question_public_ids SET current_question_id = ? WHERE public_id = ?",
        lineage.head.id,
        existing.public_id,
      );
      return { ...existing, current_question_id: lineage.head.id };
    }
    return existing;
  }
  const isPyq = lineage.head.year !== null || (await pyqMembership(lineage.rootId));
  return insertMapping(lineage.head.id, lineage.rootId, isPyq ? 0 : 1);
}

async function loadCounts(publicId: string): Promise<ShareCounts> {
  const rows = await all<{ context: string; channel: string; count: number; recent: number }>(
    `SELECT context, channel, COUNT(*) AS count,
            SUM(CASE WHEN created_at >= datetime('now', '-30 days') THEN 1 ELSE 0 END) AS recent
     FROM share_events
     WHERE public_id = ?
     GROUP BY context, channel`,
    publicId,
  );
  if (rows.length === 0) return { ...EMPTY_COUNTS, byContext: {}, byChannel: {} };
  const counts: ShareCounts = {
    total: 0,
    last30Days: 0,
    byContext: {},
    byChannel: {},
  };
  for (const row of rows) {
    counts.total += Number(row.count);
    counts.last30Days += Number(row.recent);
    counts.byContext[row.context] = (counts.byContext[row.context] ?? 0) + Number(row.count);
    counts.byChannel[row.channel] = (counts.byChannel[row.channel] ?? 0) + Number(row.count);
  }
  return counts;
}

async function pyqMembership(rootQuestionId: number): Promise<boolean> {
  const row = await first<{ is_pyq: number }>(
    `WITH RECURSIVE chain(id) AS (
       SELECT id FROM questions WHERE id = ?
       UNION ALL
       SELECT q.id FROM questions q JOIN chain c ON q.supersedes_id = c.id
     )
     SELECT EXISTS (
       SELECT 1
       FROM mock_questions mq
       JOIN mock_test_versions v ON v.id = mq.version_id
       JOIN mock_tests m ON m.id = v.mock_id AND m.current_version_id = v.id
       WHERE mq.question_id IN (SELECT id FROM chain)
         AND m.type = 'pyq'
         AND m.deleted_at IS NULL
     ) AS is_pyq`,
    rootQuestionId,
  );
  return Number(row?.is_pyq ?? 0) === 1;
}

async function publishedMockMembership(rootQuestionId: number): Promise<boolean> {
  const row = await first<{ in_mock: number }>(
    `WITH RECURSIVE chain(id) AS (
       SELECT id FROM questions WHERE id = ?
       UNION ALL
       SELECT q.id FROM questions q JOIN chain c ON q.supersedes_id = c.id
     )
     SELECT EXISTS (
       SELECT 1
       FROM mock_questions mq
       JOIN mock_test_versions v ON v.id = mq.version_id
       JOIN mock_tests m ON m.id = v.mock_id AND m.current_version_id = v.id
       WHERE mq.question_id IN (SELECT id FROM chain)
         AND m.deleted_at IS NULL
         AND m.status = 'published'
     ) AS in_mock`,
    rootQuestionId,
  );
  return Number(row?.in_mock ?? 0) === 1;
}

export async function getQuestionShareInfo(questionId: number): Promise<QuestionShareInfo | null> {
  const lineage = await loadLineage(questionId);
  if (!lineage) return null;

  const mapping = await ensureMapping(lineage);
  const flags: QuestionShareFlags = {
    shareEnabled: Number(mapping.share_enabled) === 1,
    revealPolicy: mapping.reveal_policy,
    seoIndexable: Number(mapping.seo_indexable) === 1,
    rightsOk: Number(mapping.rights_ok) === 1,
  };

  const publishedRevisionId = lineage.published?.id ?? null;
  const [isPyqFromMock, inPublishedMock, counts] = await Promise.all([
    pyqMembership(lineage.rootId),
    publishedMockMembership(lineage.rootId),
    loadCounts(mapping.public_id),
  ]);
  const isPyq = (lineage.published ?? lineage.head).year !== null || isPyqFromMock;
  const hasExplanation = Number((lineage.published ?? lineage.head).has_explanation) === 1;

  const infoBase = {
    currentQuestionId: mapping.current_question_id,
    publishedRevisionId,
    flags,
    isPyq,
    hasExplanation,
    inPublishedMock,
  };

  return {
    ...infoBase,
    publicId: mapping.public_id,
    path: questionSharePath(mapping.public_id, (lineage.published ?? lineage.head).text),
    blockers: {
      shareEnabled: shareEnabledBlockers({ isPyq, rightsOk: flags.rightsOk }),
      publicReveal: publicRevealBlockers(infoBase),
      seoIndexable: seoBlockers(infoBase),
    },
    counts,
    createdAt: mapping.created_at,
  };
}

export type SharePatch = Partial<QuestionShareFlags>;

export type ShareUpdateResult =
  | { ok: true; info: QuestionShareInfo; changed: string[]; cleared: string[] }
  | { ok: false; status: number; error: string };

export async function updateQuestionShare(
  questionId: number,
  patch: SharePatch,
): Promise<ShareUpdateResult> {
  const info = await getQuestionShareInfo(questionId);
  if (!info) return { ok: false, status: 404, error: "Question not found." };

  const next: QuestionShareFlags = {
    shareEnabled: patch.shareEnabled ?? info.flags.shareEnabled,
    revealPolicy: patch.revealPolicy ?? info.flags.revealPolicy,
    seoIndexable: patch.seoIndexable ?? info.flags.seoIndexable,
    rightsOk: patch.rightsOk ?? info.flags.rightsOk,
  };

  // Reject an explicit enable that policy forbids. Re-submitting an existing
  // flag (the panel posts every field) must not block an unrelated change, so
  // transitions are checked rather than the final value.
  const enablingShare = patch.shareEnabled === true && !info.flags.shareEnabled;
  if (enablingShare && info.isPyq && !next.rightsOk) {
    return {
      ok: false,
      status: 422,
      error: "Confirm the PYQ rights before enabling sharing.",
    };
  }
  const makingRevealPublic =
    patch.revealPolicy === "public" && info.flags.revealPolicy !== "public";
  if (makingRevealPublic && info.blockers.publicReveal.length > 0) {
    return {
      ok: false,
      status: 422,
      error: info.blockers.publicReveal.join(" "),
    };
  }

  const eligibility = {
    publishedRevisionId: info.publishedRevisionId,
    hasExplanation: info.hasExplanation,
    inPublishedMock: info.inPublishedMock,
    flags: next,
  };
  const enablingSeo = patch.seoIndexable === true && !info.flags.seoIndexable;
  if (enablingSeo) {
    const blockers = seoBlockers(eligibility);
    if (blockers.length > 0) {
      return { ok: false, status: 422, error: blockers.join(" ") };
    }
  }

  // If a dependency was removed in this update, clear dependent flags instead
  // of leaving a state the policy forbids.
  const cleared: string[] = [];
  if (next.seoIndexable && seoBlockers(eligibility).length > 0) {
    next.seoIndexable = false;
    cleared.push("seo_indexable");
  }
  if (next.revealPolicy === "public" && info.blockers.publicReveal.length > 0) {
    next.revealPolicy = "attempted_only";
    cleared.push("reveal_policy");
  }
  if (next.shareEnabled && info.isPyq && !next.rightsOk) {
    next.shareEnabled = false;
    cleared.push("share_enabled");
  }

  const changed: string[] = [];
  if (next.shareEnabled !== info.flags.shareEnabled) changed.push("share_enabled");
  if (next.revealPolicy !== info.flags.revealPolicy) changed.push("reveal_policy");
  if (next.seoIndexable !== info.flags.seoIndexable) changed.push("seo_indexable");
  if (next.rightsOk !== info.flags.rightsOk) changed.push("rights_ok");
  if (changed.length === 0) return { ok: true, info, changed, cleared };

  await run(
    `UPDATE question_public_ids
     SET share_enabled = ?, reveal_policy = ?, seo_indexable = ?, rights_ok = ?
     WHERE public_id = ?`,
    next.shareEnabled ? 1 : 0,
    next.revealPolicy,
    next.seoIndexable ? 1 : 0,
    next.rightsOk ? 1 : 0,
    info.publicId,
  );

  const updated = await getQuestionShareInfo(questionId);
  return { ok: true, info: updated ?? info, changed, cleared };
}
