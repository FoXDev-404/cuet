import { createClient } from "@tursodatabase/serverless/compat";

/** Shared helpers for the one-off Turso migration scripts. */

export function getTursoConfig() {
  const url = process.env.TURSO_DATABASE_URL?.trim();
  const authToken = process.env.TURSO_AUTH_TOKEN?.trim();
  if (!url) {
    throw new Error(
      "TURSO_DATABASE_URL is not set. Put it in .dev.vars or export it in the shell.",
    );
  }
  if (!authToken) {
    throw new Error(
      "TURSO_AUTH_TOKEN is not set. Create a database token in the Turso dashboard.",
    );
  }
  return { url, authToken };
}

export function createTursoClient() {
  return createClient(getTursoConfig());
}

export async function queryRows(client, sql, args = []) {
  const result = await client.execute({ sql, args });
  const columns = result.columns ?? [];
  return result.rows.map((row) =>
    Object.fromEntries(columns.map((column, index) => [column, row[index]])),
  );
}

export async function tableCount(client, table) {
  const rows = await queryRows(client, `SELECT COUNT(*) AS n FROM "${table}"`);
  return Number(rows[0]?.n ?? 0);
}
