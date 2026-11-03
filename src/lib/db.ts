import { env } from "cloudflare:workers";
import { AsyncLocalStorage } from "node:async_hooks";

export type BindValue = string | number | null | ArrayBuffer | ArrayBufferView;

export type D1Metrics = {
  endpoint?: string;
  rowsRead: number;
  rowsWritten: number;
  queryCount: number;
};

export const d1MetricsStorage = new AsyncLocalStorage<D1Metrics>();

export function recordD1Metrics(meta?: { rows_read?: number; rows_written?: number } | null): void {
  if (!meta) return;
  const store = d1MetricsStorage.getStore();
  if (store) {
    store.rowsRead += meta.rows_read ?? 0;
    store.rowsWritten += meta.rows_written ?? 0;
    store.queryCount += 1;
  }
}

export function getD1Metrics(): D1Metrics | null {
  return d1MetricsStorage.getStore() ?? null;
}

export function trackD1Metrics<T>(
  fn: () => Promise<T>,
  endpoint?: string,
): Promise<{ result: T; metrics: D1Metrics }> {
  const metrics: D1Metrics = {
    endpoint,
    rowsRead: 0,
    rowsWritten: 0,
    queryCount: 0,
  };
  return d1MetricsStorage.run(metrics, async () => {
    const result = await fn();
    return { result, metrics };
  });
}

export function getDb(): D1Database {
  if (!env.DB) {
    throw new Error("D1 binding DB is not configured. Run through wrangler or apply the local D1 migrations.");
  }
  return env.DB;
}

export async function first<T>(sql: string, ...params: BindValue[]): Promise<T | null> {
  const result = await getDb().prepare(sql).bind(...params).all<T>();
  recordD1Metrics(result.meta);
  return result.results?.[0] ?? null;
}

export async function all<T>(sql: string, ...params: BindValue[]): Promise<T[]> {
  const result = await getDb().prepare(sql).bind(...params).all<T>();
  recordD1Metrics(result.meta);
  return result.results ?? [];
}

export async function run(sql: string, ...params: BindValue[]): Promise<D1Result> {
  const result = await getDb().prepare(sql).bind(...params).run();
  recordD1Metrics(result.meta);
  return result;
}

export async function batch(statements: D1PreparedStatement[]): Promise<D1Result[]> {
  const results = await getDb().batch(statements);
  for (const r of results) {
    recordD1Metrics(r.meta);
  }
  return results;
}

/**
 * Runs a query and falls back to `fallback` when D1 cannot answer it.
 *
 * D1 rejects queries when the account's daily row-read quota is exhausted or
 * the database is busy. A public listing page should still render in that
 * case, so optional reads go through this helper instead of throwing.
 */
export async function allOr<T>(sql: string, fallback: T[], ...params: BindValue[]): Promise<T[]> {
  try {
    return await all<T>(sql, ...params);
  } catch (error) {
    console.error("D1 query failed; serving the fallback value.", error);
    return fallback;
  }
}

/** Single-row variant of {@link allOr}. */
export async function firstOr<T>(sql: string, fallback: T | null, ...params: BindValue[]): Promise<T | null> {
  try {
    return await first<T>(sql, ...params);
  } catch (error) {
    console.error("D1 query failed; serving the fallback value.", error);
    return fallback;
  }
}
