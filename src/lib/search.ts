import { all } from "./db";
import { getRepoGuides } from "./guides";

export type SearchResults = {
  query: string;
  mocks: { id: number; title: string; slug: string; type: string; subject_name: string | null }[];
  subjects: { name: string; slug: string; type: string }[];
  topics: { name: string; slug: string; subject_name: string; subject_slug: string }[];
  pyq: { id: number; title: string; year: number; shift: string | null; mock_slug: string | null }[];
  posts: { title: string; slug: string; description: string }[];
};

const EMPTY: SearchResults = { query: "", mocks: [], subjects: [], topics: [], pyq: [], posts: [] };

function likeTerm(query: string): string {
  return `%${query.replace(/[%_]/g, " ").trim()}%`;
}

/**
 * Repository guides are bundled with the Worker, so they must be searchable
 * even when D1 is unavailable. Matching runs over title, description and body.
 */
function searchRepoGuides(query: string): SearchResults["posts"] {
  const needle = query.toLowerCase();
  return getRepoGuides()
    .filter((guide) =>
      `${guide.title}\n${guide.description}\n${guide.body}`.toLowerCase().includes(needle),
    )
    .slice(0, 10)
    .map((guide) => ({
      title: guide.title,
      slug: guide.slug,
      description: guide.description,
    }));
}

export async function searchSite(rawQuery: string): Promise<SearchResults> {
  const query = rawQuery.trim().slice(0, 80);
  if (query.length < 2) return { ...EMPTY, query };
  const term = likeTerm(query);
  const repoPosts = searchRepoGuides(query);

  try {
    const [mocks, subjects, topics, pyq, posts] = await Promise.all([
      all<SearchResults["mocks"][number]>(
        `SELECT m.id, m.title, m.slug, m.type, s.name AS subject_name
         FROM mock_tests m
         LEFT JOIN subjects s ON s.id = m.subject_id
         WHERE m.status = 'published' AND m.deleted_at IS NULL
           AND m.practice_paper_slug IS NULL
           AND m.slug NOT LIKE 'e2e-%'
           AND m.slug NOT LIKE '%fixture%'
           AND m.slug NOT LIKE '%publish-check%'
           AND m.slug NOT LIKE 'slow-network-%'
           AND LOWER(m.title) NOT LIKE '%fixture%'
           AND (m.title LIKE ? OR COALESCE(s.name, '') LIKE ?)
         ORDER BY m.published_at DESC, m.id DESC LIMIT 10`,
        term,
        term,
      ),
      all<SearchResults["subjects"][number]>(
        `SELECT s.name, s.slug, s.type FROM subjects s
         JOIN exams e ON e.id = s.exam_id
         WHERE e.slug = 'cuet-ug' AND e.is_active = 1 AND s.is_active = 1 AND s.name LIKE ?
         ORDER BY s.name LIMIT 10`,
        term,
      ),
      all<SearchResults["topics"][number]>(
        `SELECT t.name, t.slug, s.name AS subject_name, s.slug AS subject_slug
         FROM topics t JOIN subjects s ON s.id = t.subject_id
         JOIN exams e ON e.id = s.exam_id
         WHERE e.slug = 'cuet-ug' AND e.is_active = 1 AND s.is_active = 1 AND t.name LIKE ?
         ORDER BY s.name, t.name LIMIT 10`,
        term,
      ),
      all<SearchResults["pyq"][number]>(
        `SELECT p.id, p.title, p.year, p.shift, m.slug AS mock_slug
         FROM pyq_papers p
         LEFT JOIN mock_tests m ON m.pyq_paper_id = p.id AND m.status = 'published' AND m.deleted_at IS NULL
         WHERE p.status = 'published' AND p.deleted_at IS NULL
           AND (p.title LIKE ? OR COALESCE(p.shift, '') LIKE ?)
         ORDER BY p.year DESC, p.id DESC LIMIT 10`,
        term,
        term,
      ),
      all<SearchResults["posts"][number]>(
        `SELECT title, slug, description FROM blog_posts
         WHERE status = 'published' AND published_at IS NOT NULL AND deleted_at IS NULL
           AND length(body) >= 400
           AND (title LIKE ? OR description LIKE ?)
         ORDER BY published_at DESC, id DESC LIMIT 10`,
        term,
        term,
      ),
    ]);
    const repoSlugs = new Set(repoPosts.map((post) => post.slug));
    const mergedPosts = [...repoPosts, ...posts.filter((post) => !repoSlugs.has(post.slug))].slice(
      0,
      10,
    );
    return { query, mocks, subjects, topics, pyq, posts: mergedPosts };
  } catch (error) {
    console.error("search failed", error);
    return { ...EMPTY, query, posts: repoPosts };
  }
}

export function searchTotal(results: SearchResults): number {
  return (
    results.mocks.length +
    results.subjects.length +
    results.topics.length +
    results.pyq.length +
    results.posts.length
  );
}
