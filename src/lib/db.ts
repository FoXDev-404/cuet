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
