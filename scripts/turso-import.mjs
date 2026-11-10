#!/usr/bin/env node
import { readdir, readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createTursoClient, queryRows, tableCount } from "./turso-lib.mjs";

/**
 * Imports a data-only D1 export into Turso.
 *
 * Generate the dump with:
 *   npx wrangler d1 export cuet-blueprint-db --remote --no-schema --output <file>
 *
 * The dump is line-oriented (one INSERT per line), so it can be split safely
 * without a SQL parser. `d1_migrations` is skipped because the migration script
 * owns that table; `sqlite_sequence` is restored before the data so AUTOINCREMENT
 * ids never get reused after rows were deleted in D1.
 *
 * Published mock versions freeze their question membership through a trigger.
 * That trigger is correct for production traffic but would reject the replay of
 * historical `mock_questions` rows, so it is dropped for the import and rebuilt
 * from the migration files afterwards.
 */

const args = process.argv.slice(2);
function argValue(name, fallback) {
  const index = args.indexOf(name);
  if (index === -1) return fallback;
  const value = args[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
  return value;
}

const file = argValue("--file", "");
const allowExisting = args.includes("--allow-existing");
const reset = args.includes("--reset");
const batchBytes = Number(argValue("--batch-bytes", "500000"));
const batchStatements = Number(argValue("--batch-statements", "500"));

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));
const INSERT_GUARD = "trg_frozen_version_question_insert";
const DELETE_GUARDS = [
  "trg_published_version_no_delete",
  "trg_frozen_version_question_delete",
  "trg_published_question_no_delete",
  "trg_frozen_passage_no_delete",
];

if (!file) {
  throw new Error(
    "Usage: node scripts/turso-import.mjs --file <d1-data.sql> [--reset] [--allow-existing]",
  );
}
if (!Number.isFinite(batchBytes) || batchBytes < 10_000) {
  throw new Error("--batch-bytes must be at least 10000.");
}
if (!Number.isInteger(batchStatements) || batchStatements < 1) {
  throw new Error("--batch-statements must be a positive integer.");
}

function parseDump(text) {
  const sequence = [];
  const data = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith("PRAGMA ")) continue;
    if (!line.startsWith("INSERT INTO ")) {
      throw new Error(`Unexpected dump line: ${line.slice(0, 120)}`);
    }
    if (line.startsWith('INSERT INTO "d1_migrations"')) continue;
    if (line.startsWith('INSERT INTO "sqlite_sequence"')) {
      // Turso already has one more migration row than the D1 dump (the dump's
      // d1_migrations rows are skipped), so its AUTOINCREMENT counter must stay
      // at the higher value or the next migration would reuse an id.
      if (line.includes("'d1_migrations'")) continue;
      sequence.push(line);
      continue;
    }
    data.push(line);
  }
  return { sequence, data };
}

function expectedCounts(dataLines) {
  const counts = new Map();
  for (const line of dataLines) {
    const match = /^INSERT INTO "([^"]+)"/.exec(line);
    if (!match) throw new Error(`Cannot read table name from: ${line.slice(0, 120)}`);
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }
  return counts;
}

function expectedSequences(lines) {
  const expected = new Map();
  for (const line of lines) {
    const match = /^INSERT INTO "sqlite_sequence" \("name","seq"\) VALUES\('([^']+)',(\d+)\);?$/.exec(
      line,
    );
    if (!match) throw new Error(`Cannot read sqlite_sequence row: ${line}`);
    expected.set(match[1], Number(match[2]));
  }
  return expected;
}

/**
 * Reads every trigger definition from the migrations, keyed by trigger name.
 * Files are applied in order so a later migration that repairs a trigger wins.
 */
async function triggerDefinitions() {
  const files = (await readdir(MIGRATIONS_DIR))
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const definitions = new Map();
  for (const name of files) {
    const sql = await readFile(join(MIGRATIONS_DIR, name), "utf8");
    const pattern =
      /CREATE TRIGGER\s+(?:IF NOT EXISTS\s+)?["'`[]?([A-Za-z0-9_]+)["'`\]]?[\s\S]*?\nEND;/g;
    for (const match of sql.matchAll(pattern)) {
      definitions.set(match[1], match[0]);
    }
  }
  return definitions;
}

async function dropTriggers(client, names) {
  if (names.length === 0) return;
  await client.executeMultiple(
    names.map((name) => `DROP TRIGGER IF EXISTS "${name}";`).join("\n"),
  );
}

async function syncTriggers(client, definitions) {
  const names = [...definitions.keys()];
  const missing = names.filter((name) => !definitions.get(name));
  if (missing.length > 0) {
    throw new Error(`Missing trigger definitions: ${missing.join(", ")}`);
  }
  await dropTriggers(client, names);
  await client.executeMultiple(names.map((name) => definitions.get(name)).join("\n"));
}

/**
 * Clears the data while keeping the migrated schema. Guard triggers that block
 * deletes are removed first and restored from the migration definitions.
 */
async function resetDatabase(client, definitions) {
  const tables = (
    await queryRows(
      client,
      `SELECT name FROM sqlite_master
        WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name <> 'd1_migrations'
        ORDER BY name`,
    )
  ).map((row) => String(row.name));
  if (tables.length === 0) {
    throw new Error("No tables found; run db:turso:migrate before importing.");
  }

  await dropTriggers(client, [...DELETE_GUARDS, INSERT_GUARD]);
  const statements = ["PRAGMA foreign_keys = OFF;"];
  for (const table of tables) statements.push(`DELETE FROM "${table}";`);
  statements.push("DELETE FROM sqlite_sequence;");
  await client.executeMultiple(statements.join("\n"));
  await syncTriggers(client, definitions);
  console.log(`reset ${tables.length} tables (d1_migrations kept).`);
}

async function main() {
  const text = await readFile(file, "utf8");
  const { sequence, data } = parseDump(text);
  const counts = expectedCounts(data);
  const sequences = expectedSequences(sequence);

  console.log(
    `${file}: ${data.length} rows across ${counts.size} tables, ${sequence.length} sequence rows.`,
  );

  const client = createTursoClient();
  const definitions = await triggerDefinitions();
  if (reset) await resetDatabase(client, definitions);

  const current = await tableCount(client, "questions");
  if (current > 0 && !allowExisting) {
    throw new Error(
      `questions already has ${current} rows. Pass --reset to clear a partial import, or --allow-existing only if you intend to import twice.`,
    );
  }

  // Migration 0020 seeds verified exam facts that production already contains,
  // so the dump would hit the primary-key conflict on `exam_info`. Clear the
  // seeded copy before replaying the production rows.
  const prelude = [];
  if (data.some((line) => line.startsWith('INSERT INTO "exam_info"'))) {
    prelude.push("DELETE FROM exam_info;");
  }
  prelude.push(...sequence);
  if (prelude.length > 0) {
    await client.executeMultiple(["PRAGMA foreign_keys = OFF;", ...prelude].join("\n"));
    if (sequence.length > 0) console.log(`restored ${sequence.length} sqlite_sequence rows.`);
  }

  await dropTriggers(client, [INSERT_GUARD]);

  let chunk = [];
  let chunkBytes = 0;
  let imported = 0;
  let batches = 0;

  const flush = async () => {
    if (chunk.length === 0) return;
    const sql = ["PRAGMA foreign_keys = OFF;", ...chunk].join("\n");
    await client.executeMultiple(sql);
    imported += chunk.length;
    batches += 1;
    chunk = [];
    chunkBytes = 0;
    if (batches % 25 === 0 || imported === data.length) {
      console.log(`imported ${imported}/${data.length} rows (${batches} batches)`);
    }
  };

  try {
    for (const line of data) {
      if (chunk.length >= batchStatements || chunkBytes + line.length + 1 > batchBytes) {
        await flush();
      }
      chunk.push(line);
      chunkBytes += line.length + 1;
    }
    await flush();
  } finally {
    // Rebuild the guard even if the import failed, so the database is never
    // left without the published-version protection.
    await syncTriggers(client, definitions);
  }

  await client.execute("PRAGMA foreign_keys = ON");

  const integrity = await queryRows(client, "PRAGMA integrity_check");
  if (integrity.length !== 1 || integrity[0].integrity_check !== "ok") {
    throw new Error(`integrity_check failed: ${JSON.stringify(integrity)}`);
  }

  const fk = await queryRows(client, "PRAGMA foreign_key_check");
  if (fk.length > 0) {
    throw new Error(
      `foreign_key_check found ${fk.length} violation(s): ${JSON.stringify(fk.slice(0, 10))}`,
    );
  }

  const mismatches = [];
  for (const [table, expected] of counts) {
    const actual = await tableCount(client, table);
    if (actual !== expected) mismatches.push({ table, expected, actual });
  }
  for (const [table, expected] of sequences) {
    const rows = await queryRows(
      client,
      "SELECT seq FROM sqlite_sequence WHERE name = ?",
      [table],
    );
    const actual = Number(rows[0]?.seq ?? 0);
    if (actual !== expected) mismatches.push({ table: `sqlite_sequence:${table}`, expected, actual });
  }
  if (mismatches.length > 0) {
    throw new Error(`Row count mismatch: ${JSON.stringify(mismatches, null, 2)}`);
  }

  console.log(
    `import complete: ${imported} rows, ${counts.size} tables verified, integrity_check ok, foreign_key_check clean.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
