import { env } from "cloudflare:workers";
import { AsyncLocalStorage } from "node:async_hooks";
import { createClient, type Client, type ResultSet } from "@libsql/client";

export type BindValue = string | number | null | ArrayBuffer | ArrayBufferView;

export type DbMetrics = {
  endpoint?: string;
  rowsRead: number;
  rowsWritten: number;
  queryCount: number;
};

/**
 * Result metadata shaped like D1's so existing call sites keep working while
 * the storage engine changes. Turso's single-statement API does not report
 * server-side row counters; `rows_read` then falls back to the returned row
 * count and the Turso dashboard remains the billing source of truth.
 */
export type DbMeta = {
  changes: number;
  last_row_id: number;
  rows_read: number;
  rows_written: number;
};

export type DbResult<T = Record<string, unknown>> = {
  results: T[];
  success: true;
  meta: DbMeta;
};

export interface DbStatement {
  bind(...values: BindValue[]): DbStatement;
  all<T = Record<string, unknown>>(): Promise<DbResult<T>>;
  run(): Promise<DbResult>;
}

export interface Db {
  prepare(sql: string): DbStatement;
  batch<T = Record<string, unknown>>(statements: DbStatement[]): Promise<DbResult<T>[]>;
  close(): Promise<void>;
}

export const dbMetricsStorage = new AsyncLocalStorage<DbMetrics>();


export function recordDbMetrics(
  meta?: { rows_read?: number; rows_written?: number } | null,
): void {
  if (!meta) return;
  const store = dbMetricsStorage.getStore();
  if (store) {
    store.rowsRead += meta.rows_read ?? 0;
    store.rowsWritten += meta.rows_written ?? 0;
    store.queryCount += 1;
  }
}

export function getDbMetrics(): DbMetrics | null {
  return dbMetricsStorage.getStore() ?? null;
}

export function trackDbMetrics<T>(
  fn: () => Promise<T>,
  endpoint?: string,
): Promise<{ result: T; metrics: DbMetrics }> {
  const metrics: DbMetrics = {
    endpoint,
    rowsRead: 0,
    rowsWritten: 0,
    queryCount: 0,
  };
  return dbMetricsStorage.run(metrics, async () => {
    const result = await fn();
    return { result, metrics };
  });
}

type RawD1Meta =
  | {
      changes?: number | null;
      last_row_id?: number | null;
      rows_read?: number | null;
      rows_written?: number | null;
    }
  | null
  | undefined;

function metaFromD1(meta: RawD1Meta): DbMeta {
  return {
    changes: meta?.changes ?? 0,
    last_row_id: Number(meta?.last_row_id ?? 0),
    rows_read: meta?.rows_read ?? 0,
    rows_written: meta?.rows_written ?? 0,
  };
}

function resultFromD1<T>(result: {
  results?: T[] | null;
  meta?: RawD1Meta;
}): DbResult<T> {
  const meta = metaFromD1(result.meta);
  recordDbMetrics(meta);
  return { results: result.results ?? [], success: true, meta };
}

/**
 * libSQL returns rows as hybrid arrays: positional values plus named
 * properties. D1 call sites expect a plain object keyed by column name.
 */
function tursoRows<T>(result: ResultSet): T[] {
  const columns = result.columns;
  return result.rows.map((row) => {
    const record: Record<string, unknown> = {};
    for (let index = 0; index < columns.length; index += 1) {
      record[columns[index]] = row[index];
    }
    return record as T;
  });
}

function resultFromTurso<T>(result: ResultSet): DbResult<T> {
  const changes = Number(result.rowsAffected ?? 0);
  const rows = tursoRows<T>(result);
  const meta: DbMeta = {
    changes,
    last_row_id: Number(result.lastInsertRowid ?? 0),
    // The stateless HTTP API does not report server-side row counters; the
    // returned row count is a lower bound used only for instrumentation.
    rows_read: rows.length,
    rows_written: changes,
  };
  recordDbMetrics(meta);
  return { results: rows, success: true, meta };
}

function toTursoValue(value: BindValue): string | number | null | ArrayBuffer | Uint8Array {
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return value;
}

class D1Statement implements DbStatement {
  constructor(
    private readonly adapter: D1Adapter,
    readonly sql: string,
    readonly params: BindValue[],
    readonly native: D1PreparedStatement,
  ) {}

  bind(...values: BindValue[]): DbStatement {
    return new D1Statement(this.adapter, this.sql, values, this.native.bind(...values));
  }

  all<T = Record<string, unknown>>(): Promise<DbResult<T>> {
    return this.adapter.all<T>(this);
  }

  run(): Promise<DbResult> {
    return this.adapter.run(this);
  }
}

class D1Adapter implements Db {
  constructor(private readonly db: D1Database) {}

  prepare(sql: string): DbStatement {
    return new D1Statement(this, sql, [], this.db.prepare(sql));
  }

  async all<T>(statement: D1Statement): Promise<DbResult<T>> {
    return resultFromD1(await statement.native.all<T>());
  }

  async run(statement: D1Statement): Promise<DbResult> {
    return resultFromD1(await statement.native.run());
  }

  async batch<T>(statements: DbStatement[]): Promise<DbResult<T>[]> {
    const natives = statements.map((statement) => {
      if (!(statement instanceof D1Statement)) {
        throw new Error("Cannot mix D1 and Turso statements in one batch.");
      }
      return statement.native;
    });
    const results = await this.db.batch<T>(natives);
    return results.map((result) => resultFromD1<T>(result));
  }

  async close(): Promise<void> {
    // D1 bindings are managed by the platform; nothing to release.
  }
}

class TursoStatement implements DbStatement {
  constructor(
    private readonly adapter: TursoAdapter,
    readonly sql: string,
    readonly params: BindValue[],
  ) {}

  bind(...values: BindValue[]): DbStatement {
    return new TursoStatement(this.adapter, this.sql, values);
  }

  all<T = Record<string, unknown>>(): Promise<DbResult<T>> {
    return this.adapter.all<T>(this);
  }

  run(): Promise<DbResult> {
    return this.adapter.run(this);
  }
}

class TursoAdapter implements Db {
  constructor(private readonly client: Client) {}

  prepare(sql: string): DbStatement {
    return new TursoStatement(this, sql, []);
  }

  async all<T>(statement: TursoStatement): Promise<DbResult<T>> {
    const result = await this.client.execute({
      sql: statement.sql,
      args: statement.params.map(toTursoValue),
    });
    return resultFromTurso<T>(result);
  }

  async run(statement: TursoStatement): Promise<DbResult> {
    const result = await this.client.execute({
      sql: statement.sql,
      args: statement.params.map(toTursoValue),
    });
    return resultFromTurso(result);
  }

  async batch<T = Record<string, unknown>>(statements: DbStatement[]): Promise<DbResult<T>[]> {
    const payload = statements.map((statement) => {
      if (!(statement instanceof TursoStatement)) {
        throw new Error("Cannot mix D1 and Turso statements in one batch.");
      }
      return {
        sql: statement.sql,
        args: statement.params.map(toTursoValue),
      };
    });
    // `deferred` wraps the batch in BEGIN/COMMIT, matching D1's atomic batch
    // contract. Without a mode Turso executes each statement in autocommit.
    const results = await this.client.batch(payload, "deferred");
    return results.map((result) => resultFromTurso<T>(result));
  }

  async close(): Promise<void> {
    // The stateless HTTP client holds no session between calls.
  }
}

type TursoConfig = { url: string; token: string };

function getTursoConfig(): TursoConfig | null {
  const url = typeof env.TURSO_DATABASE_URL === "string" ? env.TURSO_DATABASE_URL.trim() : "";
  if (!url) return null;
  const token = typeof env.TURSO_AUTH_TOKEN === "string" ? env.TURSO_AUTH_TOKEN.trim() : "";
  return { url, token };
}

function createTursoDb(config: TursoConfig): Db {
  // The web/HTTP client opens a stream, runs the statement and closes it again
  // inside a single `fetch`, so it keeps no server-side session between calls.
  // That is what makes it safe to share across requests in a Worker isolate:
  // the previous driver kept a "baton" alive per connection and exhausted
  // Turso's connection limit. Concurrency is bounded by the runtime instead of
  // a client-side queue, which must never span request contexts.
  const client = createClient({
    url: config.url,
    authToken: config.token || undefined,
    concurrency: 1000,
  });
  return new TursoAdapter(client);
}

let sharedD1: { database: D1Database; adapter: Db } | null = null;
let sharedTurso: { key: string; db: Db } | null = null;

/**
 * One Turso client per Worker isolate.
 *
 * The client is stateless per query (each call is one HTTP request), so unlike
 * a persistent connection it can be shared without leaking sessions or waiting
 * on locks owned by another request.
 */
export function getDb(): Db {
  const config = getTursoConfig();
  if (config) {
    const key = `${config.url}\n${config.token}`;
    if (!sharedTurso || sharedTurso.key !== key) {
      sharedTurso = { key, db: createTursoDb(config) };
    }
    return sharedTurso.db;
  }

  if (env.DB) {
    if (!sharedD1 || sharedD1.database !== env.DB) {
      sharedD1 = { database: env.DB, adapter: new D1Adapter(env.DB) };
    }
    return sharedD1.adapter;
  }

  throw new Error(
    "No database configured. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN, or bind D1 as DB.",
  );
}

/** Test-only: forget the cached isolate connections. */
export function resetDbConnections(): void {
  sharedD1 = null;
  sharedTurso = null;
}

export function getDatabaseEngine(): "turso" | "d1" | "none" {
  if (getTursoConfig()) return "turso";
  return env.DB ? "d1" : "none";
}

/**
 * A Turso HTTP call can fail in transit (fetch error, proxy 502, or a database
 * briefly at its connection limit). Reads are safe to retry once; a second
 * attempt is a fresh HTTP request because the client keeps no session state.
 * Writes never go through this path.
 */
const TRANSIENT_READ_ERROR =
  /fetch failed|network|connection|socket|stream|timed? ?out|timeout|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|SQLITE_BUSY|database is locked|HTTP (?:status )?(?:502|503|504)|status (?:code )?(?:502|503|504)/i;

function isTransientReadError(error: unknown): boolean {
  if (getDatabaseEngine() !== "turso") return false;
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return TRANSIENT_READ_ERROR.test(message);
}

async function readWithRetry<T>(reader: () => Promise<T>): Promise<T> {
  try {
    return await reader();
  } catch (error) {
    if (!isTransientReadError(error)) throw error;
    console.warn("Retrying a Turso read after a transient failure.", error);
    return reader();
  }
}

export async function first<T>(sql: string, ...params: BindValue[]): Promise<T | null> {
  const result = await readWithRetry(() => getDb().prepare(sql).bind(...params).all<T>());
  return result.results?.[0] ?? null;
}

export async function all<T>(sql: string, ...params: BindValue[]): Promise<T[]> {
  const result = await readWithRetry(() => getDb().prepare(sql).bind(...params).all<T>());
  return result.results ?? [];
}

export async function run(sql: string, ...params: BindValue[]): Promise<DbResult> {
  return getDb().prepare(sql).bind(...params).run();
}

export async function batch(statements: DbStatement[]): Promise<DbResult[]> {
  return getDb().batch(statements);
}

/**
 * Runs a query and falls back to `fallback` when the database cannot answer it.
 *
 * A database outage, an exhausted provider quota or a busy database should not
 * take a public listing page down, so optional reads go through this helper
 * instead of throwing.
 */
export async function allOr<T>(sql: string, fallback: T[], ...params: BindValue[]): Promise<T[]> {
  try {
    return await all<T>(sql, ...params);
  } catch (error) {
    console.error("Database query failed; serving the fallback value.", error);
    return fallback;
  }
}

/** Single-row variant of {@link allOr}. */
export async function firstOr<T>(
  sql: string,
  fallback: T | null,
  ...params: BindValue[]
): Promise<T | null> {
  try {
    return await first<T>(sql, ...params);
  } catch (error) {
    console.error("Database query failed; serving the fallback value.", error);
    return fallback;
  }
}
