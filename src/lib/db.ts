import { env } from "cloudflare:workers";

export type BindValue = string | number | null | ArrayBuffer | ArrayBufferView;

export function getDb(): D1Database {
  if (!env.DB) {
    throw new Error("D1 binding DB is not configured. Run through wrangler or apply the local D1 migrations.");
  }
  return env.DB;
}

export async function first<T>(sql: string, ...params: BindValue[]): Promise<T | null> {
  return getDb().prepare(sql).bind(...params).first<T>();
}

export async function all<T>(sql: string, ...params: BindValue[]): Promise<T[]> {
  const result = await getDb().prepare(sql).bind(...params).all<T>();
  return result.results ?? [];
}

export async function run(sql: string, ...params: BindValue[]): Promise<D1Result> {
  return getDb().prepare(sql).bind(...params).run();
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
