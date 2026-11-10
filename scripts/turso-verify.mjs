#!/usr/bin/env node
import { readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createTursoClient, queryRows } from "./turso-lib.mjs";

/**
 * Verifies that the Turso database matches the repository migrations and that
 * SQLite still considers the data consistent. Safe to run against production.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));

const TABLES = [
  "exams",
  "subjects",
  "questions",
  "mock_tests",
  "mock_test_versions",
  "mock_questions",
  "attempts",
  "attempt_answers",
  "practice_papers",
  "practice_questions",
  "practice_passages",
  "users",
  "sessions",
  "admins",
  "blog_posts",
  "d1_migrations",
];

async function main() {
  const client = createTursoClient();
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql") && name !== "0002_seed.sql")
    .sort();
  const applied = new Set(
    (await queryRows(client, "SELECT name FROM d1_migrations")).map((row) =>
      String(row.name),
    ),
  );
  const missing = files.filter((name) => !applied.has(name));
  if (missing.length > 0) {
    throw new Error(`Missing migrations: ${missing.join(", ")}`);
  }

  const integrity = await queryRows(client, "PRAGMA integrity_check");
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    throw new Error(`integrity_check failed: ${JSON.stringify(integrity)}`);
  }

  const fk = await queryRows(client, "PRAGMA foreign_key_check");
  if (fk.length > 0) {
    throw new Error(`foreign_key_check found ${fk.length} violation(s).`);
  }

  const counts = {};
  for (const table of TABLES) {
    const rows = await queryRows(client, `SELECT COUNT(*) AS n FROM "${table}"`);
    counts[table] = Number(rows[0]?.n ?? 0);
  }

  const published = await queryRows(
    client,
    "SELECT COUNT(*) AS n FROM questions WHERE status = 'published'",
  );
  const maxIds = await queryRows(
    client,
    `SELECT
       (SELECT MAX(id) FROM questions) AS question_id,
       (SELECT MAX(id) FROM practice_questions) AS practice_question_id,
       (SELECT MAX(id) FROM attempts) AS attempt_id`,
  );

  const dataChecks = {
    orphanAttempts: Number(
      (
        await queryRows(
          client,
          `SELECT COUNT(*) AS n FROM attempts a
           LEFT JOIN mock_tests m ON m.id = a.mock_id
           LEFT JOIN mock_test_versions v ON v.id = a.version_id
           WHERE m.id IS NULL OR v.id IS NULL`,
        )
      )[0]?.n ?? 0,
    ),
    orphanAnswers: Number(
      (
        await queryRows(
          client,
          `SELECT COUNT(*) AS n FROM attempt_answers aa
           LEFT JOIN attempts a ON a.id = aa.attempt_id
           LEFT JOIN questions q ON q.id = aa.question_id
           WHERE a.id IS NULL OR q.id IS NULL`,
        )
      )[0]?.n ?? 0,
    ),
    duplicatePublicIds: Number(
      (
        await queryRows(
          client,
          `SELECT COUNT(*) AS n FROM (
             SELECT public_id FROM question_public_ids
             GROUP BY public_id HAVING COUNT(*) > 1
           )`,
        )
      )[0]?.n ?? 0,
    ),
    duplicateQuestionPointers: Number(
      (
        await queryRows(
          client,
          `SELECT COUNT(*) AS n FROM (
             SELECT current_question_id FROM question_public_ids
             GROUP BY current_question_id HAVING COUNT(*) > 1
           )`,
        )
      )[0]?.n ?? 0,
    ),
    duplicateMockSlugs: Number(
      (
        await queryRows(
          client,
          `SELECT COUNT(*) AS n FROM (
             SELECT slug FROM mock_tests GROUP BY slug HAVING COUNT(*) > 1
           )`,
        )
      )[0]?.n ?? 0,
    ),
  };

  const failedChecks = Object.entries(dataChecks).filter(([, value]) => value !== 0);
  if (failedChecks.length > 0) {
    throw new Error(
      `Data integrity checks failed: ${failedChecks
        .map(([name, value]) => `${name}=${value}`)
        .join(", ")}`,
    );
  }

  console.log(
    JSON.stringify(
      {
        migrations: files.length,
        integrity: "ok",
        foreignKeys: "ok",
        publishedQuestions: Number(published[0]?.n ?? 0),
        maxIds: maxIds[0],
        dataChecks,
        counts,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
