import { all } from "../db";
import { readPracticeCache, writePracticeCache } from "../practice-cache";

/**
 * KV-backed cache for admin aggregate queries.
 *
 * The admin screens are low-traffic but expensive: the data manager runs one
 * `COUNT(*)` per table (about 48k rows on production) and the dashboard used
 * to count the whole question bank twice. D1 bills rows read, so a handful of
 * dashboard refreshes could eat the same daily budget that serves students.
 *
 * These aggregates tolerate a minute of staleness, so each one is cached in
 * Workers KV with a 60-second fresh window. Lists and edit forms keep reading
 * D1 directly, which means a new or deleted row is visible immediately even
 * while the counters catch up. When D1 is unavailable the last known payload
 * is served instead of failing the admin page.
 */

export const ADMIN_STATS_TTL_SECONDS = 60;
export const ADMIN_FILTER_STATS_TTL_SECONDS = 60 * 60;

export async function cachedAdminStats<T>(
  key: string,
  load: () => Promise<T>,
  ttlSeconds: number = ADMIN_STATS_TTL_SECONDS,
): Promise<T> {
  const cached = await readPracticeCache<T>(key);
  if (cached?.fresh) return cached.payload;

  try {
    const payload = await load();
    await writePracticeCache(key, payload, ttlSeconds);
    return payload;
  } catch (error) {
    if (cached) {
      console.error(`Admin stats ${key} refresh failed; serving cached copy.`, error);
      return cached.payload;
    }
    throw error;
  }
}

export type AdminMockCounts = {
  /** question count keyed by mock id, read from the current version */
  questions: Record<string, number>;
  /** attempt count keyed by mock id */
  attempts: Record<string, number>;
};

/**
 * Both counts scan their source table once and are shared by the mock list and
 * the dashboard. New mocks simply miss the map and render as zero until the
 * next refresh, which is preferable to a stale list that hides them.
 */
export function getAdminMockCounts(): Promise<AdminMockCounts> {
  return cachedAdminStats<AdminMockCounts>("cache:admin:mock-counts:v1", async () => {
    const [questionRows, attemptRows] = await Promise.all([
      all<{ mock_id: number; count: number }>(
        `SELECT mock_id, COUNT(*) AS count FROM mock_questions_current GROUP BY mock_id`,
      ),
      all<{ mock_id: number; count: number }>(
        `SELECT mock_id, COUNT(*) AS count FROM attempts GROUP BY mock_id`,
      ),
    ]);
    const toMap = (rows: { mock_id: number; count: number }[]) =>
      Object.fromEntries(rows.map((row) => [String(row.mock_id), Number(row.count)]));
    return {
      questions: toMap(questionRows),
      attempts: toMap(attemptRows),
    };
  });
}
