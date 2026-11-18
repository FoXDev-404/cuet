import { first } from "./db";
import { orUnavailable } from "./db-resilient";

/**
 * A renamed public mock resolves either to another mock (entity_id) or to a
 * plain path such as a subject hub (target_path). Both are permanent redirects.
 */
export interface SlugRedirectTarget {
  mockSlug: string | null;
  path: string | null;
}

/**
 * Renamed public content keeps working through slug_redirects. Only published,
 * non-deleted mock targets redirect; anything else stays a genuine 404.
 *
 * A database outage must not turn a missing paper into a 500, so a failed
 * lookup is treated as "no redirect".
 */
export async function oldSlugRedirect(
  slug: string,
  entityType: "mock" = "mock",
): Promise<SlugRedirectTarget | null> {
  return orUnavailable(
    "Slug redirect lookup",
    async () => {
      const row = await first<{ entity_id: number; target_path: string | null }>(
        "SELECT entity_id, target_path FROM slug_redirects WHERE old_slug = ? AND entity_type = ?",
        slug,
        entityType,
      );
      if (!row) return null;
      if (row.target_path) return { mockSlug: null, path: row.target_path };
      const target = await first<{ slug: string }>(
        "SELECT slug FROM mock_tests WHERE id = ? AND status = 'published' AND deleted_at IS NULL",
        row.entity_id,
      );
      return target ? { mockSlug: target.slug, path: null } : null;
    },
    null,
  );
}

export function redirectTargetPath(
  target: SlugRedirectTarget,
  suffix = "",
): string {
  if (target.mockSlug) return `/mock/${target.mockSlug}${suffix}`;
  return target.path ?? "/mock-tests";
}

/**
 * An archived paper keeps its rows for audit and attempt history, but its
 * public URL belongs permanently to the replacement set. `replaced_by` stores
 * the destination path (a new set page, or a subject hub when no set could be
 * built). Exactly-50 papers are never archived.
 */
export async function archivedPaperRedirect(slug: string): Promise<string | null> {
  return orUnavailable(
    "Archived paper redirect lookup",
    async () => {
      const row = await first<{ replaced_by: string | null }>(
        `SELECT replaced_by FROM practice_papers
         WHERE slug = ? AND is_archived = 1 AND deleted_at IS NULL`,
        slug,
      );
      return row?.replaced_by?.trim() || null;
    },
    null,
  );
}
