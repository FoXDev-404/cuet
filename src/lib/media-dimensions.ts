import { all } from "./db";

export type ImageDimensions = { width: number; height: number };

const MEDIA_URL = /^\/api\/media\/([0-9a-fA-F-]{36})(?:[?#].*)?$/;

/**
 * Uploaded media is served as /api/media/{id}. media_assets already stores the
 * intrinsic dimensions, so public pages can emit explicit width/height
 * attributes without duplicating them in every question row.
 */
export function mediaIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = MEDIA_URL.exec(url.trim());
  return match ? match[1] : null;
}

export async function imageDimensionsForUrls(
  urls: (string | null | undefined)[],
): Promise<Map<string, ImageDimensions>> {
  const result = new Map<string, ImageDimensions>();
  const idsByUrl = new Map<string, string>();
  for (const url of urls) {
    if (!url) continue;
    const id = mediaIdFromUrl(url);
    if (id) idsByUrl.set(url, id);
  }
  const ids = [...new Set(idsByUrl.values())];
  if (ids.length === 0) return result;

  const rowsById = new Map<string, ImageDimensions>();
  try {
    // D1 caps bound parameters per statement; 50 keeps plenty of headroom.
    for (let offset = 0; offset < ids.length; offset += 50) {
      const chunk = ids.slice(offset, offset + 50);
      const placeholders = chunk.map(() => "?").join(",");
      const rows = await all<{ id: string; width: number | null; height: number | null }>(
        `SELECT id, width, height FROM media_assets WHERE id IN (${placeholders})`,
        ...chunk,
      );
      for (const row of rows) {
        if (row.width && row.height) {
          rowsById.set(row.id, { width: row.width, height: row.height });
        }
      }
    }
  } catch {
    return result;
  }

  for (const [url, id] of idsByUrl) {
    const dimensions = rowsById.get(id);
    if (dimensions) result.set(url, dimensions);
  }
  return result;
}

/** Merge dimensions into an option-like object for render-only use. */
export function withImageDimensions<T extends { image_url: string | null }>(
  item: T,
  dimensions: Map<string, ImageDimensions>,
): T & { image_width: number | null; image_height: number | null } {
  const size = item.image_url ? dimensions.get(item.image_url) : undefined;
  return {
    ...item,
    image_width: size?.width ?? null,
    image_height: size?.height ?? null,
  };
}
