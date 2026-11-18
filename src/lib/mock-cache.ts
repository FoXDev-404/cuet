import { env } from "cloudflare:workers";
import { all, first } from "./db";
import type { AttemptQuestion } from "./attempts";
import { parseOptions } from "./content";

const MOCK_VERSION_CACHE_PREFIX = "cache:mock_version:v4:";
const CACHE_TTL_SECONDS = 3_600;
const MAX_VALUE_BYTES = 900_000;

function kvNamespace(): KVNamespace | null {
  try {
    return (env as unknown as { MEDIA_KV?: KVNamespace }).MEDIA_KV ?? null;
  } catch {
    return null;
  }
}

export function mockVersionCacheKey(versionId: number, identity?: string): string {
  const suffix = identity ? `:${encodeURIComponent(identity)}` : "";
  return `${MOCK_VERSION_CACHE_PREFIX}${versionId}${suffix}`;
}

type CachedMockVersion = {
  /** Mock the cached questions belong to; null for legacy entries. */
  mockId: number | null;
  questions: AttemptQuestion[];
};

/**
 * Loads mock questions for a version, served from Workers KV when cached.
 * Contains only student-facing test fields (no correct_option or explanation).
 *
 * The cache identity includes the owning mock's unique slug and creation time
 * as well as the version creation time. D1 restore/re-import can reuse both
 * numeric IDs while KV still contains rows from the previous database state.
 */
export async function getMockVersionQuestions(
  versionId: number,
  expectedMockId?: number,
): Promise<AttemptQuestion[]> {
  const kv = kvNamespace();
  const identityRow = kv && expectedMockId != null
    ? await first<{
        slug: string;
        mock_created_at: string;
        version_created_at: string;
      }>(
        `SELECT m.slug, m.created_at AS mock_created_at,
                v.created_at AS version_created_at
         FROM mock_test_versions v
         JOIN mock_tests m ON m.id = v.mock_id
         WHERE v.id = ? AND m.id = ?`,
        versionId,
        expectedMockId,
      )
    : null;
  const identity = identityRow
    ? `${identityRow.slug}:${identityRow.mock_created_at}:${identityRow.version_created_at}`
    : null;
  const key = identity ? mockVersionCacheKey(versionId, identity) : null;

  if (kv && key) {
    try {
      const cached = await kv.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as Partial<CachedMockVersion> | AttemptQuestion[];
        const questions = Array.isArray(parsed) ? parsed : parsed.questions;
        const cachedMockId = Array.isArray(parsed) ? null : (parsed.mockId ?? null);
        const mockIdMatches =
          cachedMockId == null ||
          expectedMockId == null ||
          cachedMockId === expectedMockId;
        if (Array.isArray(questions) && questions.length > 0 && mockIdMatches) {
          return questions;
        }
      }
    } catch {
      // Fall through to D1 on KV read error
    }
  }

  const questions = await all<AttemptQuestion>(
    `SELECT q.id, mq.section, mq.position, q.subject_id, q.text, q.text_hi, q.options,
            q.options_hi, q.image_url, q.image_alt, q.assets_json, q.passage_id,
            q.source_year, q.source_date, q.source_shift,
            p.body AS passage_body, p.body_hi AS passage_body_hi,
            p.image_url AS passage_image_url, p.image_alt AS passage_image_alt
     FROM mock_questions mq
     JOIN questions q ON q.id = mq.question_id
     LEFT JOIN passages p ON p.id = q.passage_id
     WHERE mq.version_id = ?
     ORDER BY mq.position`,
    versionId,
  );

  if (kv && key && questions.length > 0) {
    try {
      const payload: CachedMockVersion = { mockId: expectedMockId ?? null, questions };
      const serialized = JSON.stringify(payload);
      if (new TextEncoder().encode(serialized).length <= MAX_VALUE_BYTES) {
        await kv.put(key, serialized, { expirationTtl: CACHE_TTL_SECONDS });
      }
    } catch {
      // Cache write failure must not break request
    }
  }

  return questions;
}

/**
 * Returns question option counts for lightweight answer validation.
 */
export async function getMockVersionQuestionMeta(
  versionId: number,
  expectedMockId?: number,
): Promise<Map<number, { id: number; optionCount: number }>> {
  const questions = await getMockVersionQuestions(versionId, expectedMockId);
  const map = new Map<number, { id: number; optionCount: number }>();
  for (const q of questions) {
    map.set(q.id, {
      id: q.id,
      optionCount: parseOptions(q.options).length,
    });
  }
  return map;
}

/**
 * Invalidates the KV cache entry for a mock version when updated or superseded.
 */
export async function invalidateMockVersionCache(versionId: number): Promise<void> {
  const kv = kvNamespace();
  if (kv) {
    try {
      const prefix = `${MOCK_VERSION_CACHE_PREFIX}${versionId}:`;
      let cursor: string | undefined;
      do {
        const page = await kv.list({ prefix, cursor });
        await Promise.all(page.keys.map((entry) => kv.delete(entry.name)));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      await kv.delete(mockVersionCacheKey(versionId));
    } catch {
      // Non-fatal
    }
  }
}
