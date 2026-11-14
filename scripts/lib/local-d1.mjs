import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DB_DIRECTORY = resolve(
  ROOT,
  process.env.CUET_LOCAL_D1_DIR ?? ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
);
const WRANGLER_BIN = join(ROOT, "node_modules", "wrangler", "bin", "wrangler.js");
const DB_NAME = "cuet-blueprint-db";

let databasePath;

function getDatabasePath() {
  if (databasePath) return databasePath;

  let files;
  try {
    files = readdirSync(DB_DIRECTORY).filter(
      (file) => file.endsWith(".sqlite") && file !== "metadata.sqlite",
    );
  } catch (error) {
    throw new Error(
      `Could not find local Wrangler D1 storage at ${DB_DIRECTORY}. Start the local E2E server first.`,
      { cause: error },
    );
  }
  if (files.length !== 1) {
    throw new Error(
      `Expected one local Wrangler D1 database in ${DB_DIRECTORY}, found ${files.length}.`,
    );
  }

  databasePath = join(DB_DIRECTORY, files[0]);
  return databasePath;
}

/** Keep writes inside Wrangler's D1 runtime so its session metadata stays consistent. */
export function executeLocalD1(sql) {
  execFileSync(
    process.execPath,
    [WRANGLER_BIN, "d1", "execute", DB_NAME, "--local", "--command", sql],
    { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
}

/** Retry an idempotent SQL batch once after a transient local D1 internal error. */
export function executeLocalD1WithRetry(sql) {
  try {
    executeLocalD1(sql);
  } catch (error) {
    const stderr =
      error && typeof error === "object" && "stderr" in error ? String(error.stderr) : "";
    const message = `${error instanceof Error ? error.message : String(error)}\n${stderr}`;
    if (!/internal error|failed to get session commit token/i.test(message)) throw error;
    console.warn("[e2e] Retrying idempotent cleanup after a local D1 internal error.");
    executeLocalD1(sql);
  }
}

/** Read committed rows without starting another Wrangler D1 runtime. */
export function queryLocalD1(sql) {
  const database = new DatabaseSync(getDatabasePath(), { readOnly: true });
  try {
    database.exec("PRAGMA busy_timeout = 10000;");
    return database.prepare(sql).all();
  } finally {
    database.close();
  }
}
