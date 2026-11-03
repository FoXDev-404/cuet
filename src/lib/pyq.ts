import { allOr } from "./db";
import { parseMarkingScheme } from "./content";

export type PyqPaperRow = {
  id: number;
  year: number;
  shift: string | null;
  title: string;
  source_url: string | null;
  rights_note: string | null;
  subject_id: number | null;
  subject_name: string | null;
  subject_slug: string | null;
  mock_id: number | null;
  mock_slug: string | null;
  duration_min: number | null;
  total_marks: number | null;
  marking_scheme: string | null;
  question_count: number | null;
  attempt_count: number | null;
};

const SELECT = `SELECT p.id, p.year, p.shift, p.title, p.source_url, p.rights_note, p.subject_id,
       s.name AS subject_name, s.slug AS subject_slug,
       m.id AS mock_id, m.slug AS mock_slug, v.duration_min, v.total_marks, v.marking_scheme,
       (SELECT COUNT(*) FROM mock_questions_current mq WHERE mq.mock_id = m.id) AS question_count,
       (SELECT COUNT(*) FROM attempts a WHERE a.mock_id = m.id AND a.status IN ('submitted','expired')) AS attempt_count
FROM pyq_papers p
LEFT JOIN subjects s ON s.id = p.subject_id
LEFT JOIN mock_tests m ON m.pyq_paper_id = p.id AND m.status = 'published' AND m.deleted_at IS NULL
LEFT JOIN mock_test_versions v ON v.id = m.current_version_id
WHERE p.status = 'published' AND p.deleted_at IS NULL`;

export async function listPyqPapers(filters: { year?: number; subjectId?: number } = {}): Promise<PyqPaperRow[]> {
  const clauses: string[] = [];
  const params: number[] = [];
  if (filters.year) {
    clauses.push("p.year = ?");
    params.push(filters.year);
  }
  if (filters.subjectId) {
    clauses.push("p.subject_id = ?");
    params.push(filters.subjectId);
  }
  const where = clauses.length > 0 ? ` AND ${clauses.join(" AND ")}` : "";
  return allOr<PyqPaperRow>(`${SELECT}${where} ORDER BY p.year DESC, p.shift, p.id`, [], ...params);
}

export async function listPyqYears(): Promise<{ year: number; paper_count: number; playable_count: number }[]> {
  return allOr<{ year: number; paper_count: number; playable_count: number }>(
    `SELECT p.year,
            COUNT(*) AS paper_count,
            SUM(CASE WHEN m.id IS NULL THEN 0 ELSE 1 END) AS playable_count
     FROM pyq_papers p
     LEFT JOIN mock_tests m ON m.pyq_paper_id = p.id AND m.status = 'published' AND m.deleted_at IS NULL
     WHERE p.status = 'published' AND p.deleted_at IS NULL
     GROUP BY p.year
     ORDER BY p.year DESC`,
    [],
  );
}

export function pyqMarking(row: PyqPaperRow): { correct: number; wrong: number; skipped: number } {
  return parseMarkingScheme(row.marking_scheme ?? "");
}
