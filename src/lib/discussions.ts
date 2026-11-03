import { all, first, run } from "./db";

export type DiscussionRow = {
  id: number;
  mock_id: number;
  question_id: number | null;
  user_id: number;
  parent_id: number | null;
  body: string;
  status: "visible" | "pending" | "hidden";
  is_pinned: number;
  is_best_answer: number;
  upvotes: number;
  created_at: string;
  username: string;
  avatar_url: string | null;
  question_text: string | null;
  reported: number;
};

/**
 * The standalone discussion page and its reply API require a finished attempt
 * on that paper (or an admin session). Guests with a claimed attempt may read;
 * posting always needs a registered account. The inline chat below a live
 * attempt is separate and also accepts an in-progress attempt.
 */
export async function hasFinishedAttempt(
  mockId: number,
  userId: number | null,
  guestToken: string | null,
): Promise<boolean> {
  if (userId) {
    const row = await first<{ id: number }>(
      `SELECT id FROM attempts
       WHERE user_id = ? AND mock_id = ? AND status IN ('submitted', 'expired')
       LIMIT 1`,
      userId,
      mockId,
    );
    if (row) return true;
  }
  if (guestToken) {
    const row = await first<{ id: number }>(
      `SELECT id FROM attempts
       WHERE guest_token = ? AND mock_id = ? AND user_id IS NULL AND status IN ('submitted', 'expired')
       LIMIT 1`,
      guestToken,
      mockId,
    );
    if (row) return true;
  }
  return false;
}

/**
 * A student may read and post in the inline discussion below a live attempt.
 * The standalone discussion page keeps the finished-attempt gate.
 */
export async function hasLiveAttempt(mockId: number, userId: number | null): Promise<boolean> {
  if (!userId) return false;
  const row = await first<{ id: number }>(
    `SELECT id FROM attempts
     WHERE user_id = ? AND mock_id = ? AND status = 'in_progress'
     LIMIT 1`,
    userId,
    mockId,
  );
  return Boolean(row);
}

export async function loadVisibleThreads(
  mockId: number,
  questionId: number | null,
  viewerId: number | null,
): Promise<DiscussionRow[]> {
  const filter = questionId ? "AND d.question_id = ?" : "";
  const params: (string | number)[] = [mockId];
  if (questionId) params.push(questionId);

  const rows = await all<DiscussionRow>(
    `SELECT d.id, d.mock_id, d.question_id, d.user_id, d.parent_id, d.body, d.status,
            d.is_pinned, d.is_best_answer, d.upvotes, d.created_at,
            u.username, u.avatar_url, q.text AS question_text,
            CASE WHEN dr.id IS NULL THEN 0 ELSE 1 END AS reported
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     LEFT JOIN questions q ON q.id = d.question_id
     LEFT JOIN discussion_reports dr ON dr.discussion_id = d.id AND dr.user_id = ?
     WHERE d.mock_id = ? AND d.status = 'visible' ${filter}
     ORDER BY d.is_pinned DESC, d.upvotes DESC, d.created_at ASC
     LIMIT 300`,
    viewerId ?? 0,
    ...params,
  );
  return rows;
}

export async function loadOwnPending(
  mockId: number,
  userId: number,
  questionId: number | null,
): Promise<DiscussionRow[]> {
  const filter = questionId ? "AND d.question_id = ?" : "";
  const params: (string | number)[] = [mockId, userId];
  if (questionId) params.push(questionId);
  return all<DiscussionRow>(
    `SELECT d.id, d.mock_id, d.question_id, d.user_id, d.parent_id, d.body, d.status,
            d.is_pinned, d.is_best_answer, d.upvotes, d.created_at,
            u.username, u.avatar_url, q.text AS question_text, 0 AS reported
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     LEFT JOIN questions q ON q.id = d.question_id
     WHERE d.mock_id = ? AND d.user_id = ? AND d.status = 'pending' ${filter}
     ORDER BY d.created_at ASC`,
    ...params,
  );
}

export async function votedIds(discussionIds: number[], userId: number | null): Promise<Set<number>> {
  if (!userId || discussionIds.length === 0) return new Set();
  const placeholders = discussionIds.map(() => "?").join(",");
  const rows = await all<{ discussion_id: number }>(
    `SELECT discussion_id FROM discussion_votes
     WHERE user_id = ? AND discussion_id IN (${placeholders})`,
    userId,
    ...discussionIds,
  );
  return new Set(rows.map((row) => row.discussion_id));
}

export async function findDiscussion(id: number): Promise<DiscussionRow | null> {
  return first<DiscussionRow>(
    `SELECT d.id, d.mock_id, d.question_id, d.user_id, d.parent_id, d.body, d.status,
            d.is_pinned, d.is_best_answer, d.upvotes, d.created_at,
            u.username, u.avatar_url, NULL AS question_text, 0 AS reported
     FROM discussions d JOIN users u ON u.id = d.user_id
     WHERE d.id = ?`,
    id,
  );
}

export type DiscussionThread = DiscussionRow & { replies: DiscussionRow[] };

/** Group a flat visible-thread result into one level of replies. */
export function groupThreads(rows: DiscussionRow[]): DiscussionThread[] {
  const roots: DiscussionThread[] = [];
  const byId = new Map<number, DiscussionThread>();
  for (const row of rows) {
    if (row.parent_id !== null) continue;
    const thread: DiscussionThread = { ...row, replies: [] };
    byId.set(row.id, thread);
    roots.push(thread);
  }
  for (const row of rows) {
    if (row.parent_id === null) continue;
    byId.get(row.parent_id)?.replies.push(row);
  }
  return roots;
}

/**
 * Mock-level API feed: top-level comments on the paper itself (not a specific
 * question) plus their replies. Pinned comments stay first for both sorts.
 */
export async function loadMockThreadFeed(
  mockId: number,
  viewerId: number | null,
  options: { sort?: "top" | "new"; cursor?: number; limit?: number } = {},
): Promise<{ threads: DiscussionThread[]; nextCursor: number | null }> {
  const sort = options.sort === "top" ? "top" : "new";
  const limit = Math.min(Math.max(options.limit ?? 30, 1), 50);
  const cursor = options.cursor && options.cursor > 0 ? options.cursor : null;
  const cursorClause = cursor ? "AND d.id < ?" : "";
  const order =
    sort === "top"
      ? "d.is_pinned DESC, d.upvotes DESC, d.created_at DESC, d.id DESC"
      : "d.is_pinned DESC, d.created_at DESC, d.id DESC";

  const params: (number | string)[] = [viewerId ?? 0, mockId];
  if (cursor) params.push(cursor);
  params.push(limit + 1);

  const roots = await all<DiscussionRow>(
    `SELECT d.id, d.mock_id, d.question_id, d.user_id, d.parent_id, d.body, d.status,
            d.is_pinned, d.is_best_answer, d.upvotes, d.created_at,
            u.username, u.avatar_url, q.text AS question_text,
            CASE WHEN dr.id IS NULL THEN 0 ELSE 1 END AS reported
     FROM discussions d
     JOIN users u ON u.id = d.user_id
     LEFT JOIN questions q ON q.id = d.question_id
     LEFT JOIN discussion_reports dr ON dr.discussion_id = d.id AND dr.user_id = ?
     WHERE d.mock_id = ? AND d.question_id IS NULL AND d.parent_id IS NULL
       AND d.status = 'visible' ${cursorClause}
     ORDER BY ${order}
     LIMIT ?`,
    ...params,
  );

  const hasMore = roots.length > limit;
  const page = hasMore ? roots.slice(0, limit) : roots;
  const ids = page.map((row) => row.id);
  const replies =
    ids.length > 0
      ? await all<DiscussionRow>(
          `SELECT d.id, d.mock_id, d.question_id, d.user_id, d.parent_id, d.body, d.status,
                  d.is_pinned, d.is_best_answer, d.upvotes, d.created_at,
                  u.username, u.avatar_url, q.text AS question_text,
                  CASE WHEN dr.id IS NULL THEN 0 ELSE 1 END AS reported
           FROM discussions d
           JOIN users u ON u.id = d.user_id
           LEFT JOIN questions q ON q.id = d.question_id
           LEFT JOIN discussion_reports dr ON dr.discussion_id = d.id AND dr.user_id = ?
           WHERE d.parent_id IN (${ids.map(() => "?").join(",")})
             AND d.status = 'visible'
           ORDER BY d.created_at ASC, d.id ASC`,
          viewerId ?? 0,
          ...ids,
        )
      : [];

  const threads = groupThreads([...page, ...replies]);
  return { threads, nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null };
}

export async function recordApproval(discussionId: number, userId: number): Promise<void> {
  await run(
    "UPDATE users SET approved_comments = approved_comments + 1 WHERE id = ?",
    userId,
  );
  await run("UPDATE discussions SET status = 'visible' WHERE id = ?", discussionId);
}
