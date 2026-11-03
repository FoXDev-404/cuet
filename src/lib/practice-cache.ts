import { env } from "cloudflare:workers";

/**
 * KV-backed cache for the previous-year practice library.
 *
 * Why this exists: D1 bills *rows read*, and the library index aggregates
 * every `practice_questions` row (5,322 across 106 papers) on every warm-up.
 * On the D1 free tier (5M rows/day) that burns the whole daily budget in a
 * few hundred page loads, which takes the entire PYQ section down with
 * `D1_ERROR: exceeded daily row read limit`.
 *
 * The mapped payload lives in Workers KV instead, so D1 is only touched when
 * the cached copy expires. The envelope keeps a stale copy for a week: when
 * D1 is unreachable (quota exhausted, database busy) the last known good
 * payload is served instead of failing the request.
 *
 * The cached paper payload is the same server-side object the D1 store
 * returns, so answer keys stay server-side exactly as before — the browser
 * still only receives what the page layer chooses to render.
 */

const CACHE_PREFIX = "cache:practice";
export const PRACTICE_INDEX_CACHE_KEY = `${CACHE_PREFIX}:index:v1`;
const PAPER_CACHE_PREFIX = `${CACHE_PREFIX}:paper:v1:`;
/** Per-subject question/mock rollups used by the syllabus and mock hubs. */
export const SUBJECT_STATS_CACHE_KEY = `${CACHE_PREFIX}:subjects:v1`;

/** How long a cached payload is served before D1 is consulted again. */
const FRESH_TTL_SECONDS = 600; // 10 minutes
/** How long an expired payload is kept around as an outage fallback. */
const STALE_RETENTION_SECONDS = 604_800; // 7 days
/** Workers KV values are capped at 1 MiB; stay clear of the limit. */
const MAX_VALUE_BYTES = 900_000;

interface CacheEnvelope<T> {
  version: 1;
  generatedAt: number;
  expiresAt: number;
  payload: T;
}

export interface CacheRead<T> {
  payload: T;
  fresh: boolean;
}

function kvNamespace(): KVNamespace | null {
  try {
    return (env as unknown as { MEDIA_KV?: KVNamespace }).MEDIA_KV ?? null;
  } catch {
    return null;
  }
}

/**
 * Reads a cached payload. `fresh` is false when the entry exists but has
 * expired, which means D1 should be retried and the payload used only as a
 * fallback if D1 fails.
 */
export async function readPracticeCache<T>(key: string): Promise<CacheRead<T> | null> {
  const namespace = kvNamespace();
  if (!namespace) return null;
  try {
    const raw = await namespace.get(key);
    if (!raw) return null;
    const envelope = JSON.parse(raw) as CacheEnvelope<T>;
    if (!envelope || envelope.version !== 1 || typeof envelope.expiresAt !== "number") {
      return null;
    }
    return { payload: envelope.payload, fresh: Date.now() < envelope.expiresAt };
  } catch {
    return null;
  }
}

/** Stores a payload with a fresh window plus a long retention window. */
export async function writePracticeCache<T>(
  key: string,
  payload: T,
  ttlSeconds: number = FRESH_TTL_SECONDS,
): Promise<void> {
  const namespace = kvNamespace();
  if (!namespace) return;
  try {
    const now = Date.now();
    const envelope: CacheEnvelope<T> = {
      version: 1,
      generatedAt: now,
      expiresAt: now + ttlSeconds * 1000,
      payload,
    };
    const serialized = JSON.stringify(envelope);
    if (new TextEncoder().encode(serialized).length > MAX_VALUE_BYTES) return;
    await namespace.put(key, serialized, { expirationTtl: STALE_RETENTION_SECONDS });
  } catch {
    // A cache write failure must never break a page render.
  }
}

export function practicePaperCacheKey(slug: string): string {
  return `${PAPER_CACHE_PREFIX}${slug}`;
}

/**
 * Drops the cached index and the cached copies of the given papers.
 *
 * Called after admin edits so a review fix shows up immediately instead of
 * after the fresh window elapses. `paperSlugs` may be empty when only the
 * index-level aggregates changed.
 */
export async function invalidatePracticeCache(paperSlugs: string[] = []): Promise<void> {
  const namespace = kvNamespace();
  if (!namespace) return;
  try {
    await namespace.delete(PRACTICE_INDEX_CACHE_KEY);
    await namespace.delete(SUBJECT_STATS_CACHE_KEY);
    for (const slug of new Set(paperSlugs)) {
      if (!slug) continue;
      await namespace.delete(practicePaperCacheKey(slug));
    }
  } catch {
    // Best effort: the fresh window bounds how stale the cache can get.
  }
}

/** Admin tables whose edits change the practice library or subject rollups. */
const PRACTICE_LIBRARY_TABLES = new Set([
  "practice_papers",
  "practice_questions",
  "practice_passages",
  "questions",
  "mock_questions",
  "mock_test_versions",
  "subjects",
  "exams",
]);

/**
 * Returns the paper slugs affected by a row change, so the right cached
 * papers can be dropped. Rows outside the library return an empty list.
 */
export function practicePaperSlugsForRow(
  table: string,
  row: Record<string, unknown> | null | undefined,
): string[] {
  if (!row) return [];
  if (table === "practice_papers") {
    return typeof row.slug === "string" ? [row.slug] : [];
  }
  if (table === "practice_questions" || table === "practice_passages") {
    return typeof row.paper_slug === "string" ? [row.paper_slug] : [];
  }
  return [];
}

/** True when a mutation on this table must invalidate the library cache. */
export function affectsPracticeLibrary(table: string): boolean {
  return PRACTICE_LIBRARY_TABLES.has(table) || table === "mock_tests";
}

/**
 * Convenience wrapper for admin write paths: invalidates the library cache
 * when the mutated table belongs to the library, using the affected rows to
 * work out which cached papers to drop.
 */
export async function invalidateAfterPracticeMutation(
  table: string,
  rows: Array<Record<string, unknown> | null | undefined>,
): Promise<void> {
  if (!affectsPracticeLibrary(table)) return;
  const slugs = rows.flatMap((row) => practicePaperSlugsForRow(table, row));
  await invalidatePracticeCache(slugs);
}
