/**
 * Pure planning logic for the question public-id backfill.
 *
 * The script reads questions and mappings from D1, calls this planner, then
 * writes the resulting inserts/updates. Keeping the decisions here makes the
 * revision-chain behaviour testable without wrangler.
 */

export type BackfillQuestion = {
  id: number;
  supersedes_id: number | null;
  deleted_at: string | null;
  year: number | null;
  is_pyq?: number | null;
};

export type BackfillMapping = {
  public_id: string;
  current_question_id: number;
};

export type BackfillPlan = {
  create: Array<{
    questionId: number;
    publicId: string;
    shareEnabled: number;
  }>;
  move: Array<{
    publicId: string;
    questionId: number;
  }>;
  conflicts: string[];
};

type Lineage = {
  rootId: number;
  head: BackfillQuestion;
  depth: number;
};

function lineageRoot(id: number, byId: Map<number, BackfillQuestion>): number {
  let current = id;
  const seen = new Set<number>();
  while (true) {
    if (seen.has(current)) return current;
    seen.add(current);
    const row = byId.get(current);
    if (!row?.supersedes_id) return current;
    current = row.supersedes_id;
  }
}

function lineageDepth(id: number, byId: Map<number, BackfillQuestion>): number {
  let depth = 0;
  let current = byId.get(id);
  const seen = new Set<number>();
  while (current?.supersedes_id && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = byId.get(current.supersedes_id);
  }
  return depth;
}

/**
 * A lineage has exactly one public id. The head is the newest non-deleted row;
 * deleted revisions are never offered as public pages. If the whole lineage is
 * deleted it has no head and no id is created.
 */
function headsByRoot(
  questions: BackfillQuestion[],
  byId: Map<number, BackfillQuestion>,
): Map<number, Lineage> {
  const heads = new Map<number, Lineage>();
  for (const question of questions) {
    if (question.deleted_at) continue;
    const rootId = lineageRoot(question.id, byId);
    const depth = lineageDepth(question.id, byId);
    const current = heads.get(rootId);
    if (
      !current ||
      depth > current.depth ||
      (depth === current.depth && question.id > current.head.id)
    ) {
      heads.set(rootId, { rootId, head: question, depth });
    }
  }
  return heads;
}

export function planPublicIdBackfill(
  questions: BackfillQuestion[],
  mappings: BackfillMapping[],
  generateId: () => string,
): BackfillPlan {
  const byId = new Map(questions.map((question) => [question.id, question]));
  const heads = headsByRoot(questions, byId);
  const used = new Set(mappings.map((mapping) => mapping.public_id));
  const plan: BackfillPlan = { create: [], move: [], conflicts: [] };

  const keepByRoot = new Map<number, string>();
  for (const mapping of mappings) {
    const question = byId.get(mapping.current_question_id);
    if (!question) {
      plan.conflicts.push(
        `Public id ${mapping.public_id} points at missing question ${mapping.current_question_id}.`,
      );
      continue;
    }
    const rootId = lineageRoot(mapping.current_question_id, byId);
    const head = heads.get(rootId)?.head;
    if (!head) continue;

    const existing = keepByRoot.get(rootId);
    if (existing) {
      plan.conflicts.push(
        `Public ids ${existing} and ${mapping.public_id} both target question lineage ${rootId}.`,
      );
      continue;
    }
    keepByRoot.set(rootId, mapping.public_id);
    if (mapping.current_question_id !== head.id) {
      plan.move.push({ publicId: mapping.public_id, questionId: head.id });
    }
  }

  for (const [rootId, lineage] of heads) {
    if (keepByRoot.has(rootId)) continue;
    let publicId = "";
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const candidate = generateId();
      if (!used.has(candidate)) {
        publicId = candidate;
        break;
      }
    }
    if (!publicId) {
      throw new Error(`Could not generate a unique public id for question ${lineage.head.id}.`);
    }
    used.add(publicId);
    plan.create.push({
      questionId: lineage.head.id,
      publicId,
      shareEnabled:
        lineage.head.year !== null || Number(lineage.head.is_pyq ?? 0) === 1 ? 0 : 1,
    });
  }

  return plan;
}

/** SQL statement helpers shared by the script and tests. */
export function createStatementSql(plan: BackfillPlan): string {
  return plan.create
    .map(
      (entry) =>
        `INSERT INTO question_public_ids\n` +
        `  (public_id, current_question_id, share_enabled, reveal_policy, seo_indexable, rights_ok)\n` +
        `SELECT '${entry.publicId}', ${entry.questionId}, ${entry.shareEnabled}, 'attempted_only', 0, 0\n` +
        `WHERE NOT EXISTS (\n` +
        `  SELECT 1 FROM question_public_ids WHERE current_question_id = ${entry.questionId}\n` +
        `);`,
    )
    .join("\n");
}

export function moveStatementSql(plan: BackfillPlan): string {
  return plan.move
    .map(
      (entry) =>
        `UPDATE question_public_ids SET current_question_id = ${entry.questionId}\n` +
        `WHERE public_id = '${entry.publicId}';`,
    )
    .join("\n");
}
