import { env } from "cloudflare:workers";
import { all } from "./db";
import type { AttemptQuestion } from "./attempts";
import { parseOptions } from "./content";

const MOCK_VERSION_CACHE_PREFIX = "cache:mock_version:v1:";
const CACHE_TTL_SECONDS = 604_800; // 7 days (mock versions are immutable)
const MAX_VALUE_BYTES = 900_000;

function kvNamespace(): KVNamespace | null {
  try {
    return (env as unknown as { MEDIA_KV?: KVNamespace }).MEDIA_KV ?? null;
  } catch {
    return null;
  }
}

export function mockVersionCacheKey(versionId: number): string {
  return `${MOCK_VERSION_CACHE_PREFIX}${versionId}`;
}

/**
 * Loads mock questions for a version, served from Workers KV when cached.
 * Contains only student-facing test fields (no correct_option or explanation).
 */
export async function getMockVersionQuestions(versionId: number): Promise<AttemptQuestion[]> {
  const kv = kvNamespace();
  const key = mockVersionCacheKey(versionId);

  if (kv) {
    try {
      const cached = await kv.get(key);
      if (cached) {
        const parsed = JSON.parse(cached) as AttemptQuestion[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // Fall through to D1 on KV read error
    }
  }

  const questions = await all<AttemptQuestion>(
    `SELECT q.id, mq.section, mq.position, q.subject_id, q.text, q.text_hi, q.options,
            q.options_hi, q.image_url, q.image_alt, q.assets_json, q.passage_id,
            p.body AS passage_body, p.body_hi AS passage_body_hi,
            p.image_url AS passage_image_url, p.image_alt AS passage_image_alt
     FROM mock_questions mq
     JOIN questions q ON q.id = mq.question_id
     LEFT JOIN passages p ON p.id = q.passage_id
     WHERE mq.version_id = ?
     ORDER BY mq.position`,
    versionId,
  );

  if (kv && questions.length > 0) {
    try {
      const serialized = JSON.stringify(questions);
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
): Promise<Map<number, { id: number; optionCount: number }>> {
  const questions = await getMockVersionQuestions(versionId);
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
  if (!kv) return;
  try {
    await kv.delete(mockVersionCacheKey(versionId));
  } catch {
    // Non-fatal
  }
}
