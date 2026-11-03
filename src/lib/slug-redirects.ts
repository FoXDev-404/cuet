import { first } from "./db";

/**
 * Renamed public content keeps working through slug_redirects. Only published,
 * non-deleted targets redirect; anything else stays a genuine 404.
 */
export async function oldSlugRedirect(
  slug: string,
  entityType: "mock" = "mock",
): Promise<string | null> {
  const row = await first<{ entity_id: number }>(
    "SELECT entity_id FROM slug_redirects WHERE old_slug = ? AND entity_type = ?",
    slug,
    entityType,
  );
  if (!row) return null;
  const target = await first<{ slug: string }>(
    "SELECT slug FROM mock_tests WHERE id = ? AND status = 'published' AND deleted_at IS NULL",
    row.entity_id,
  );
  return target?.slug ?? null;
}
