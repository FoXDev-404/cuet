import { allOr, first } from "./db";
import {
  GUIDE_CATEGORY_META,
  GUIDE_CATEGORY_ORDER,
  STATIC_GUIDES,
  type GuideCategory,
  type StaticGuide,
} from "../content/guides";

/**
 * Unified guide library.
 *
 * Repository guides are always available: they are bundled with the Worker, so
 * /blog and the sitemap keep working when D1 is at its daily row-read limit.
 * Database posts created in /admin/blog are merged in as additional guides.
 *
 * A repository guide and a database row may share a slug. The repository copy
 * wins because it is the reviewed, deployable version; this also prevents a
 * stale seeded row from shadowing an updated in-repo guide.
 */

export type GuidePost = {
  id: number | null;
  slug: string;
  title: string;
  description: string;
  body: string;
  category: GuideCategory;
  publishedAt: string;
  updatedAt: string | null;
  source: "repo" | "database";
};

type DbGuideRow = {
  id: number;
  slug: string;
  title: string;
  description: string;
  body: string;
  published_at: string | null;
  updated_at: string | null;
};

function fromStatic(guide: StaticGuide): GuidePost {
  return {
    id: null,
    slug: guide.slug,
    title: guide.title,
    description: guide.description,
    body: guide.body,
    category: guide.category,
    publishedAt: guide.publishedAt,
    updatedAt: guide.updatedAt ?? guide.publishedAt,
    source: "repo",
  };
}

function categoryForTitle(slug: string, title: string): GuideCategory {
  const haystack = `${slug} ${title}`.toLowerCase();
  if (/exam[- ]day|exam[- ]hall|admit[- ]card|mistake/.test(haystack)) return "exam-day";
  if (
    /english|physics|chemistry|biology|mathematics|accountancy|business|economics|history|geography|psychology|sociology|political|general[- ]test|hindi|computer|legal/.test(
      haystack,
    )
  ) {
    return "subject-strategy";
  }
  if (/mock|previous[- ]year|paper|revision|percentile|rank|practice/.test(haystack)) {
    return "practice";
  }
  return "exam-basics";
}

function fromDb(row: DbGuideRow): GuidePost {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    body: row.body,
    category: categoryForTitle(row.slug, row.title),
    publishedAt: row.published_at ?? row.updated_at ?? new Date(0).toISOString(),
    updatedAt: row.updated_at ?? row.published_at,
    source: "database",
  };
}

const STATIC_BY_SLUG = new Map(STATIC_GUIDES.map((guide) => [guide.slug, guide]));

/** Synchronous, D1-free guide list. Used by the sitemap and offline builds. */
export function getRepoGuides(): GuidePost[] {
  return STATIC_GUIDES.map(fromStatic);
}

/** Resolve a repository guide without touching D1. */
export function getRepoGuide(slug: string): GuidePost | null {
  const guide = STATIC_BY_SLUG.get(slug);
  return guide ? fromStatic(guide) : null;
}

/** All published guides: repository first, then database-only posts. */
export async function getAllGuides(): Promise<GuidePost[]> {
  const repo = getRepoGuides();
  const rows = await allOr<DbGuideRow>(
    `SELECT id, slug, title, description, body, published_at, updated_at
     FROM blog_posts
     WHERE status = 'published' AND published_at IS NOT NULL AND deleted_at IS NULL
       AND length(body) >= 400
     ORDER BY published_at DESC, id DESC
     LIMIT 100`,
    [],
  );
  const repoSlugs = new Set(repo.map((guide) => guide.slug));
  const databasePosts = rows
    .filter((row) => !repoSlugs.has(row.slug))
    .map(fromDb);
  return [...repo, ...databasePosts].sort(
    (a, b) => b.publishedAt.localeCompare(a.publishedAt) || a.slug.localeCompare(b.slug),
  );
}

/** Resolve one guide. Repository guides never wait on D1. */
export async function getGuide(slug: string): Promise<GuidePost | null> {
  const repo = getRepoGuide(slug);
  if (repo) return repo;
  const row = await first<DbGuideRow>(
    `SELECT id, slug, title, description, body, published_at, updated_at
     FROM blog_posts
     WHERE slug = ? AND status = 'published' AND published_at IS NOT NULL AND deleted_at IS NULL
       AND length(body) >= 400`,
    slug,
  );
  return row ? fromDb(row) : null;
}

/** Same-category guides first, then the most recent guides from other topics. */
export function getRelatedGuides(
  current: GuidePost,
  guides: GuidePost[],
  limit = 3,
): GuidePost[] {
  const others = guides.filter((guide) => guide.slug !== current.slug);
  const sameCategory = others.filter((guide) => guide.category === current.category);
  const rest = others.filter((guide) => guide.category !== current.category);
  return [...sameCategory, ...rest].slice(0, Math.max(0, limit));
}

/** Group guides for the index page, preserving the editorial category order. */
export function groupGuidesByCategory(
  guides: GuidePost[],
): { key: GuideCategory; label: string; blurb: string; guides: GuidePost[] }[] {
  return GUIDE_CATEGORY_ORDER.map((key) => ({
    key,
    label: GUIDE_CATEGORY_META[key].label,
    blurb: GUIDE_CATEGORY_META[key].blurb,
    guides: guides.filter((guide) => guide.category === key),
  })).filter((group) => group.guides.length > 0);
}

export function guidePath(slug: string): string {
  return `/blog/${slug}`;
}
