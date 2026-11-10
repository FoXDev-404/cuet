import { env } from "cloudflare:workers";
import { AsyncLocalStorage } from "node:async_hooks";
import { connect, type Connection } from "@tursodatabase/serverless";

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

type DbSession = { db?: Db };

/**
 * A per-request Turso connection. The session is created lazily so pages that
 * never touch the database do not pay for a connection or the foreign-key
 * pragma round trip.
 */
const dbSessionStorage = new AsyncLocalStorage<DbSession>();

const EMPTY_META: DbMeta = {
  changes: 0,
  last_row_id: 0,
  rows_read: 0,
  rows_written: 0,
};

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
  return dbMetricsStorage.run(metrics, () => {
    const session: DbSession = {};
    return dbSessionStorage.run(session, async () => {
      try {
        const result = await fn();
        return { result, metrics };
      } finally {
        // Workers isolates are reused across requests. A Turso connection left
        // open keeps its server-side stream alive until the isolate dies, and
        // roughly 80 open streams later every database call starts failing.
        // Release it as soon as the request no longer needs it; a failed close
        // must never turn a successful response into an error.
        try {
          await session.db?.close();
        } catch {
          // Ignore: the connection is gone either way.
        }
      }
    });
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

type TursoResultSet = {
  rows?: Array<Record<string, unknown>>;
  rowsAffected?: number;
  lastInsertRowid?: number | bigint;
  rowsRead?: number;
  rowsWritten?: number;
};

function resultFromTurso<T>(result: TursoResultSet): DbResult<T> {
  const changes = Number(result.rowsAffected ?? 0);
  const meta: DbMeta = {
    changes,
    last_row_id: Number(result.lastInsertRowid ?? 0),
    rows_read: result.rowsRead ?? 0,
    rows_written: result.rowsWritten ?? changes,
  };
  recordDbMetrics(meta);
  return { results: (result.rows ?? []) as T[], success: true, meta };
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
  constructor(
    private readonly connection: Connection,
    private readonly ready: () => Promise<void>,
  ) {}

  prepare(sql: string): DbStatement {
    return new TursoStatement(this, sql, []);
  }

  async all<T>(statement: TursoStatement): Promise<DbResult<T>> {
    await this.ready();
    const rows = (await this.connection.all(
      statement.sql,
      ...statement.params.map(toTursoValue),
    )) as T[];
    // The single-statement API returns rows only. Treat the row count as a
    // lower bound for instrumentation instead of inventing a billing figure.
    const meta: DbMeta = { ...EMPTY_META, rows_read: rows.length };
    recordDbMetrics(meta);
    return { results: rows, success: true, meta };
  }

  async run(statement: TursoStatement): Promise<DbResult> {
    await this.ready();
    const result = await this.connection.run(
      statement.sql,
      ...statement.params.map(toTursoValue),
    );
    const changes = Number(result?.changes ?? 0);
    const meta: DbMeta = {
      changes,
      last_row_id: Number(result?.lastInsertRowid ?? 0),
      rows_read: 0,
      rows_written: changes,
    };
    recordDbMetrics(meta);
    return { results: [], success: true, meta };
  }

  async batch<T>(statements: DbStatement[]): Promise<DbResult<T>[]> {
    await this.ready();
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
    const results = (await this.connection.batch(payload, "deferred")) as TursoResultSet[];
    return results.map((result) => resultFromTurso<T>(result));
  }

  async close(): Promise<void> {
    try {
      await this.connection.close();
    } catch {
      // Closing is best-effort cleanup; the session is unreachable afterwards
      // and a network error here must not fail the request that just finished.
    }
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
  const connection = connect({
    url: config.url,
    authToken: config.token || undefined,
  });

  let ready: Promise<void> | null = null;
  const ensureReady = (): Promise<void> => {
    if (!ready) {
      // SQLite/libSQL defaults foreign_keys to OFF, while D1 enforced them.
      // Enable them once per session, before the first query, so CHECK/FK
      // cascades and the immutability triggers keep their D1 behaviour.
      ready = connection.exec("PRAGMA foreign_keys = ON").then(() => undefined);
      ready.catch(() => {
        ready = null;
      });
    }
    return ready;
  };

  return new TursoAdapter(connection, ensureReady);
}

let sharedD1: { database: D1Database; adapter: Db } | null = null;
let sharedTurso: { key: string; db: Db } | null = null;

export function getDb(): Db {
  const config = getTursoConfig();
  if (config) {
    const session = dbSessionStorage.getStore();
    if (session) {
      session.db ??= createTursoDb(config);
      return session.db;
    }

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

export function getDatabaseEngine(): "turso" | "d1" | "none" {
  if (getTursoConfig()) return "turso";
  return env.DB ? "d1" : "none";
}

export async function first<T>(sql: string, ...params: BindValue[]): Promise<T | null> {
  const result = await getDb().prepare(sql).bind(...params).all<T>();
  return result.results?.[0] ?? null;
}

export async function all<T>(sql: string, ...params: BindValue[]): Promise<T[]> {
  const result = await getDb().prepare(sql).bind(...params).all<T>();
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
