import { beforeEach, describe, expect, it, vi } from "vitest";

const { env, connection, connectMock, d1 } = vi.hoisted(() => {
  const env: Record<string, unknown> = {};
  const connection = {
    all: vi.fn(),
    run: vi.fn(),
    batch: vi.fn(),
    exec: vi.fn(),
  };
  const connectMock = vi.fn(() => connection);
  const d1 = {
    prepare: vi.fn(),
    batch: vi.fn(),
  };
  return { env, connection, connectMock, d1 };
});

vi.mock("cloudflare:workers", () => ({ env }));
vi.mock("@tursodatabase/serverless", () => ({ connect: connectMock }));

import { all, batch, getDatabaseEngine, getDb, run, trackDbMetrics } from "../../src/lib/db";

describe("database adapter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    env.TURSO_DATABASE_URL = "libsql://cuet-test.turso.io";
    env.TURSO_AUTH_TOKEN = "test-token";
    env.DB = undefined;
    connection.exec.mockResolvedValue({});
    connection.all.mockResolvedValue([]);
    connection.run.mockResolvedValue({ changes: 0, lastInsertRowid: 0 });
    connection.batch.mockResolvedValue([]);
  });

  it("uses Turso when its URL is configured", () => {
    expect(getDatabaseEngine()).toBe("turso");
    getDb();
    expect(connectMock).toHaveBeenCalledWith({
      url: "libsql://cuet-test.turso.io",
      authToken: "test-token",
    });
  });

  it("enables foreign keys once per connection before querying", async () => {
    connection.all.mockResolvedValue([{ id: 1 }]);

    await trackDbMetrics(async () => {
      expect(await all<{ id: number }>("SELECT * FROM questions WHERE id = ?", 1)).toEqual([
        { id: 1 },
      ]);
      await all("SELECT * FROM questions WHERE id = ?", 2);
    });

    expect(connection.exec).toHaveBeenCalledTimes(1);
    expect(connection.exec).toHaveBeenCalledWith("PRAGMA foreign_keys = ON");
    expect(connection.all).toHaveBeenLastCalledWith(
      "SELECT * FROM questions WHERE id = ?",
      2,
    );
  });

  it("maps insert metadata to D1 field names", async () => {
    connection.run.mockResolvedValue({ changes: 2, lastInsertRowid: 9 });

    const result = await run("UPDATE questions SET status = ? WHERE id = ?", "published", 9);

    expect(result.meta).toEqual({
      changes: 2,
      last_row_id: 9,
      rows_read: 0,
      rows_written: 2,
    });
  });

  it("runs batches atomically and preserves per-statement results", async () => {
    connection.batch.mockResolvedValue([
      { rows: [{ count: 1 }], rowsAffected: 0, rowsRead: 5, rowsWritten: 0 },
      { rows: [], rowsAffected: 2, rowsRead: 0, rowsWritten: 2, lastInsertRowid: 7 },
    ]);
    const db = getDb();

    const results = await db.batch([
      db.prepare("SELECT COUNT(*) AS count FROM questions"),
      db.prepare("INSERT INTO questions (text) VALUES (?)").bind("Question"),
    ]);

    expect(connection.batch).toHaveBeenCalledWith(
      [
        { sql: "SELECT COUNT(*) AS count FROM questions", args: [] },
        { sql: "INSERT INTO questions (text) VALUES (?)", args: ["Question"] },
      ],
      "deferred",
    );
    expect(results[0].results).toEqual([{ count: 1 }]);
    expect(results[0].meta.rows_read).toBe(5);
    expect(results[1].meta).toMatchObject({ changes: 2, last_row_id: 7, rows_written: 2 });
  });

  it("records request metrics across single queries and batches", async () => {
    connection.all.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    connection.run.mockResolvedValue({ changes: 1, lastInsertRowid: 3 });
    connection.batch.mockResolvedValue([
      { rows: [], rowsAffected: 1, rowsRead: 4, rowsWritten: 1, lastInsertRowid: 4 },
    ]);

    const { metrics } = await trackDbMetrics(async () => {
      await all("SELECT * FROM questions");
      await run("UPDATE questions SET text = ? WHERE id = ?", "x", 1);
      const db = getDb();
      await db.batch([db.prepare("INSERT INTO questions (text) VALUES (?)").bind("y")]);
    }, "/test");

    expect(metrics).toMatchObject({
      endpoint: "/test",
      rowsRead: 2 + 4,
      rowsWritten: 1 + 1,
      queryCount: 3,
    });
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
    expect(connectMock).not.toHaveBeenCalled();
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
