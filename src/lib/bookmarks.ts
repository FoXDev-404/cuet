import { all, first, run } from "./db";

export type BookmarkRow = {
  question_id: number;
  note: string | null;
  created_at: string;
  text: string;
  subject_name: string;
  subject_slug: string;
  topic_name: string | null;
};

export async function listBookmarks(userId: number, limit = 200): Promise<BookmarkRow[]> {
  return all<BookmarkRow>(
    `SELECT b.question_id, b.note, b.created_at, q.text,
            s.name AS subject_name, s.slug AS subject_slug, t.name AS topic_name
     FROM bookmarks b
     JOIN questions q ON q.id = b.question_id
     JOIN subjects s ON s.id = q.subject_id
     LEFT JOIN topics t ON t.id = q.topic_id
     WHERE b.user_id = ? AND q.deleted_at IS NULL
     ORDER BY b.created_at DESC
     LIMIT ?`,
    userId,
    Math.min(Math.max(limit, 1), 500),
  );
}

export async function addBookmark(
  userId: number,
  questionId: number,
  note: string,
): Promise<void> {
  await run(
    `INSERT INTO bookmarks (user_id, question_id, note) VALUES (?, ?, ?)
     ON CONFLICT(user_id, question_id) DO UPDATE SET note = excluded.note`,
    userId,
    questionId,
    note || null,
  );
}

export async function removeBookmark(userId: number, questionId: number): Promise<void> {
  await run("DELETE FROM bookmarks WHERE user_id = ? AND question_id = ?", userId, questionId);
}

export async function isBookmarked(userId: number, questionId: number): Promise<boolean> {
  const row = await first<{ question_id: number }>(
    "SELECT question_id FROM bookmarks WHERE user_id = ? AND question_id = ?",
    userId,
    questionId,
  );
  return Boolean(row);
}

export async function findPublishedQuestion(questionId: number): Promise<{ id: number } | null> {
  return first<{ id: number }>(
    "SELECT id FROM questions WHERE id = ? AND status = 'published' AND deleted_at IS NULL",
    questionId,
  );
}
