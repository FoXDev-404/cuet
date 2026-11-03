import { all, first, run } from "../db";

export type PassageRow = {
  id: number;
  subject_id: number;
  subject_name: string;
  body: string;
  body_hi: string | null;
  image_url: string | null;
  image_alt: string | null;
  question_count: number;
  deleted_at: string | null;
};

export const PASSAGE_LIMITS = {
  body: 60_000,
  bodyHi: 60_000,
  imageUrl: 2_000,
  imageAlt: 300,
} as const;

export async function listPassages(query: string, subjectId: number, includeDeleted = false): Promise<PassageRow[]> {
  const where = [includeDeleted ? "1 = 1" : "p.deleted_at IS NULL"];
  const params: (string | number)[] = [];
  const term = query.trim().slice(0, 100);
  if (term) {
    where.push("(p.body LIKE ? OR p.body_hi LIKE ?)");
    params.push(`%${term}%`, `%${term}%`);
  }
  if (Number.isInteger(subjectId) && subjectId > 0) {
    where.push("p.subject_id = ?");
    params.push(subjectId);
  }
  return all<PassageRow>(
    `SELECT p.id, p.subject_id, s.name AS subject_name, p.body, p.body_hi,
            p.image_url, p.image_alt, p.deleted_at,
            (SELECT COUNT(*) FROM questions q WHERE q.passage_id = p.id AND q.deleted_at IS NULL) AS question_count
     FROM passages p JOIN subjects s ON s.id = p.subject_id
     WHERE ${where.join(" AND ")}
     ORDER BY p.id DESC LIMIT 200`,
    ...params,
  );
}

export async function findPassage(id: number): Promise<PassageRow | null> {
  return first<PassageRow>(
    `SELECT p.id, p.subject_id, s.name AS subject_name, p.body, p.body_hi,
            p.image_url, p.image_alt, p.deleted_at,
            (SELECT COUNT(*) FROM questions q WHERE q.passage_id = p.id AND q.deleted_at IS NULL) AS question_count
     FROM passages p JOIN subjects s ON s.id = p.subject_id
     WHERE p.id = ?`,
    id,
  );
}

export type PassageInput = {
  subject_id: number;
  body: string;
  body_hi: string | null;
  image_url: string | null;
  image_alt: string | null;
};

export function parsePassageInput(
  body: Record<string, unknown>,
): { input: PassageInput } | { error: string } {
  const subjectId = Number(body.subject_id);
  if (!Number.isInteger(subjectId) || subjectId <= 0) return { error: "Choose a subject." };

  const text = String(body.body ?? "").trim();
  if (!text) return { error: "Passage text is required." };
  if (text.length > PASSAGE_LIMITS.body) return { error: "Passage text is too long." };

  const textHi = String(body.body_hi ?? "").trim() || null;
  if (textHi && textHi.length > PASSAGE_LIMITS.bodyHi) return { error: "Hindi passage text is too long." };

  const imageUrl = String(body.image_url ?? "").trim() || null;
  if (imageUrl && !/^\/|^https?:\/\//.test(imageUrl)) {
    return { error: "Image URL must be a site path or an https URL." };
  }
  const imageAlt = String(body.image_alt ?? "").trim() || null;
  if (imageUrl && !imageAlt) return { error: "Alt text is required when a passage image is present." };
  if (imageAlt && imageAlt.length > PASSAGE_LIMITS.imageAlt) return { error: "Alt text is too long." };

  return { input: { subject_id: subjectId, body: text, body_hi: textHi, image_url: imageUrl, image_alt: imageAlt } };
}

export async function createPassage(input: PassageInput): Promise<number> {
  const result = await run(
    `INSERT INTO passages (subject_id, body, body_hi, image_url, image_alt)
     VALUES (?, ?, ?, ?, ?)`,
    input.subject_id,
    input.body,
    input.body_hi,
    input.image_url,
    input.image_alt,
  );
  return Number(result.meta.last_row_id);
}

export async function updatePassage(id: number, input: PassageInput): Promise<void> {
  await run(
    `UPDATE passages SET subject_id = ?, body = ?, body_hi = ?, image_url = ?, image_alt = ?
     WHERE id = ?`,
    input.subject_id,
    input.body,
    input.body_hi,
    input.image_url,
    input.image_alt,
    id,
  );
}

export async function softDeletePassage(id: number): Promise<void> {
  await run(
    "UPDATE passages SET deleted_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now') WHERE id = ?",
    id,
  );
}
