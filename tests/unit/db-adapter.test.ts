import { beforeEach, describe, expect, it, vi } from "vitest";

const { env, client, createClientMock, d1 } = vi.hoisted(() => {
  const env: Record<string, unknown> = {};
  const client = {
    execute: vi.fn(),
    batch: vi.fn(),
    close: vi.fn(),
  };
  const createClientMock = vi.fn(() => client);
  const d1 = {
    prepare: vi.fn(),
    batch: vi.fn(),
  };
  return { env, client, createClientMock, d1 };
});

vi.mock("cloudflare:workers", () => ({ env }));
vi.mock("@libsql/client", () => ({ createClient: createClientMock }));

import { all, batch, getDatabaseEngine, getDb, resetDbConnections, run, trackDbMetrics } from "../../src/lib/db";

function resultSet(
  columns: string[],
  rows: unknown[][],
  extra: { rowsAffected?: number; lastInsertRowid?: number | bigint } = {},
) {
  return {
    columns,
    columnTypes: columns.map(() => "TEXT"),
    rows,
    rowsAffected: extra.rowsAffected ?? 0,
    lastInsertRowid: extra.lastInsertRowid ?? 0,
  };
}

describe("database adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetDbConnections();
    env.TURSO_DATABASE_URL = "libsql://cuet-test.turso.io";
    env.TURSO_AUTH_TOKEN = "test-token";
    env.DB = undefined;
    client.execute.mockResolvedValue(resultSet([], []));
    client.batch.mockResolvedValue([]);
    client.close.mockResolvedValue(undefined);
  });

  it("uses Turso when its URL is configured", () => {
    expect(getDatabaseEngine()).toBe("turso");
    getDb();
    expect(createClientMock).toHaveBeenCalledWith({
      url: "libsql://cuet-test.turso.io",
      authToken: "test-token",
      concurrency: 1000,
    });
  });

  it("maps positional Turso rows to objects keyed by column name", async () => {
    client.execute.mockResolvedValue(
      resultSet(["id", "title"], [[1, "Grammar"], [2, "Maths"]]),
    );

    await expect(all("SELECT id, title FROM mock_tests")).resolves.toEqual([
      { id: 1, title: "Grammar" },
      { id: 2, title: "Maths" },
    ]);
  });

  it("sends bound parameters to the stateless HTTP client", async () => {
    client.execute.mockResolvedValue(resultSet(["id"], [[2]]));

    await all("SELECT id FROM mock_tests WHERE id = ?", 2);

    expect(client.execute).toHaveBeenCalledWith({
      sql: "SELECT id FROM mock_tests WHERE id = ?",
      args: [2],
    });
  });

  it("maps insert metadata to D1 field names", async () => {
    client.execute.mockResolvedValue(
      resultSet([], [], { rowsAffected: 2, lastInsertRowid: 9n }),
    );

    const result = await run("UPDATE questions SET status = ? WHERE id = ?", "published", 9);

    expect(result.meta).toEqual({
      changes: 2,
      last_row_id: 9,
      rows_read: 0,
      rows_written: 2,
    });
  });

  it("runs batches atomically and preserves per-statement results", async () => {
    client.batch.mockResolvedValue([
      resultSet(["count"], [[1]]),
      resultSet([], [], { rowsAffected: 2, lastInsertRowid: 7n }),
    ]);
    const db = getDb();

    const results = await db.batch([
      db.prepare("SELECT COUNT(*) AS count FROM questions"),
      db.prepare("INSERT INTO questions (text) VALUES (?)").bind("Question"),
    ]);

    expect(client.batch).toHaveBeenCalledWith(
      [
        { sql: "SELECT COUNT(*) AS count FROM questions", args: [] },
        { sql: "INSERT INTO questions (text) VALUES (?)", args: ["Question"] },
      ],
      "deferred",
    );
    expect(results[0].results).toEqual([{ count: 1 }]);
    expect(results[0].meta.rows_read).toBe(1);
    expect(results[1].meta).toMatchObject({ changes: 2, last_row_id: 7, rows_written: 2 });
  });

  it("records request metrics across single queries and batches", async () => {
    client.execute
      .mockResolvedValueOnce(resultSet(["id"], [[1], [2]]))
      .mockResolvedValueOnce(resultSet([], [], { rowsAffected: 1, lastInsertRowid: 3n }));
    client.batch.mockResolvedValue([resultSet([], [], { rowsAffected: 1 })]);

    const { metrics } = await trackDbMetrics(async () => {
      await all("SELECT * FROM questions");
      await run("UPDATE questions SET text = ? WHERE id = ?", "x", 1);
      const db = getDb();
      await db.batch([db.prepare("INSERT INTO questions (text) VALUES (?)").bind("y")]);
    }, "/test");

    expect(metrics).toMatchObject({
      endpoint: "/test",
      rowsRead: 2,
      rowsWritten: 1 + 1,
      queryCount: 3,
    });
  });

  it("reuses one stateless client across requests in the same isolate", async () => {
    await trackDbMetrics(async () => {
      await all("SELECT 1");
    });
    await trackDbMetrics(async () => {
      await all("SELECT 2");
    });

    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(client.close).not.toHaveBeenCalled();
  });

  it("does not open a client for requests that never query", async () => {
    await trackDbMetrics(async () => "cached");

    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("retries a transient Turso read on a fresh HTTP request", async () => {
    client.execute
      .mockRejectedValueOnce(new Error("fetch failed"))
      .mockResolvedValueOnce(resultSet(["id"], [[1]]));

    const { result } = await trackDbMetrics(() =>
      all<{ id: number }>("SELECT 1"),
    );

    expect(result).toEqual([{ id: 1 }]);
    expect(createClientMock).toHaveBeenCalledTimes(1);
    expect(client.execute).toHaveBeenCalledTimes(2);
  });

  it("does not retry a deterministic query error", async () => {
    client.execute.mockRejectedValueOnce(
      new Error("SQLite error: no such column: nope"),
    );

    await expect(trackDbMetrics(() => all("SELECT nope"))).rejects.toThrow(
      "no such column",
    );

    expect(client.execute).toHaveBeenCalledTimes(1);
  });

  it("falls back to D1 when Turso is not configured", async () => {
    env.TURSO_DATABASE_URL = "";
    env.TURSO_AUTH_TOKEN = "";
    const statement = {
      bind: vi.fn(function (this: unknown) {
        return statement;
      }),
      all: vi.fn(async () => ({
        results: [{ id: 1 }],
        success: true,
        meta: { changes: 0, last_row_id: 0, rows_read: 1, rows_written: 0 },
      })),
      run: vi.fn(),
    };
    d1.prepare.mockReturnValue(statement);
    env.DB = d1;

    expect(getDatabaseEngine()).toBe("d1");
    expect(await getDb().prepare("SELECT 1").bind().all()).toEqual({
      results: [{ id: 1 }],
      success: true,
      meta: { changes: 0, last_row_id: 0, rows_read: 1, rows_written: 0 },
    });
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("rejects mixing statements from different engines in one batch", async () => {
    const db = getDb();
    const foreignStatement = {
      bind: vi.fn(),
      all: vi.fn(),
      run: vi.fn(),
    };

    await expect(batch([db.prepare("SELECT 1"), foreignStatement])).rejects.toThrow(
      "Cannot mix D1 and Turso statements in one batch.",
    );
  });
});
