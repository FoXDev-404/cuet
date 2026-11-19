#!/usr/bin/env node
/**
 * Retarget the two archived PYQ papers whose `replaced_by` points at an
 * empty previous-year-papers subject hub (both hubs return HTTP 404) to the
 * subject practice hubs, which exist and list the available questions.
 *
 * The fix is a two-row UPDATE:
 *   sociology-2024-05-18-shift-3 -> /cuet-mock-test/sociology
 *   legal-studies-2022           -> /cuet-mock-test/legal-studies
 *
 * Usage:
 *   node scripts/fix-archived-redirects.mjs --dry-run    # print before/after (local read-only)
 *   node scripts/fix-archived-redirects.mjs --local      # apply to local D1
 *   node --env-file-if-exists=.dev.vars scripts/fix-archived-redirects.mjs --turso   # apply to Turso (production)
 */
import { readdirSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { createTursoClient, getTursoConfig, queryRows } from "./turso-lib.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const DRY_RUN = args.has("--dry-run");
const LOCAL = args.has("--local");
const TURSO = args.has("--turso");

if (!DRY_RUN && !LOCAL && !TURSO) {
  console.error("Usage: node scripts/fix-archived-redirects.mjs [--dry-run|--local|--turso]");
  process.exit(2);
}
if (TURSO && !(getTursoConfig()?.url && getTursoConfig()?.authToken)) {
  console.error("TURSO_DATABASE_URL / TURSO_AUTH_TOKEN missing (set them in .dev.vars).");
  process.exit(2);
}

const FIXES = [
  {
    slug: "sociology-2024-05-18-shift-3",
    expected: "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/sociology",
    target: "/cuet-mock-test/sociology",
  },
  {
    slug: "legal-studies-2022",
    expected: "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/legal-studies",
    target: "/cuet-mock-test/legal-studies",
  },
];
const REDIRECT_FIXES = [
  {
    slug: "sociology-2024-05-18-shift-3",
    entityType: "mock",
    targetPath: "/cuet-mock-test/sociology",
  },
  {
    slug: "legal-studies-2022",
    entityType: "mock",
    targetPath: "/cuet-mock-test/legal-studies",
  },
];

function localDatabasePath() {
  const dir = join(ROOT, ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
  for (const name of readdirSync(dir)) {
    if (!name.endsWith(".sqlite")) continue;
    const db = new DatabaseSync(join(dir, name));
    try {
      const row = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='practice_papers'")
        .get();
      if (row) return join(dir, name);
    } finally {
      db.close();
    }
  }
  throw new Error("Local D1 sqlite file not found (run npm run db:migrate:local first).");
}

async function inspectLocal() {
  const db = new DatabaseSync(localDatabasePath());
  try {
    const papers = FIXES.map((fix) => ({
      kind: "practice_paper",
      ...fix,
      before: db
        .prepare("SELECT is_archived, replaced_by, publication_status FROM practice_papers WHERE slug = ?")
        .get(fix.slug),
    }));
    const redirects = REDIRECT_FIXES.map((fix) => ({
      kind: "slug_redirect",
      slug: fix.slug,
      target: fix.targetPath,
      before: db
        .prepare("SELECT entity_type, entity_id, target_path FROM slug_redirects WHERE old_slug = ?")
        .get(fix.slug),
    }));
    return [...papers, ...redirects];
  } finally {
    db.close();
  }
}

async function inspectRemote(client) {
  const papers = [];
  for (const fix of FIXES) {
    const result = await queryRows(
      client,
      "SELECT is_archived, replaced_by, publication_status FROM practice_papers WHERE slug = ?",
      [fix.slug],
    );
    papers.push({ kind: "practice_paper", ...fix, before: result[0] ?? null });
  }
  const redirects = [];
  for (const fix of REDIRECT_FIXES) {
    const result = await queryRows(
      client,
      "SELECT entity_type, entity_id, target_path FROM slug_redirects WHERE old_slug = ?",
      [fix.slug],
    );
    redirects.push({ kind: "slug_redirect", slug: fix.slug, target: fix.targetPath, before: result[0] ?? null });
  }
  return [...papers, ...redirects];
}

async function applyLocal() {
  const db = new DatabaseSync(localDatabasePath());
  try {
    for (const fix of FIXES) {
      const current = db
        .prepare("SELECT replaced_by FROM practice_papers WHERE slug = ?")
        .get(fix.slug);
      if (current?.replaced_by === fix.target) {
        console.log(`  practice_papers ${fix.slug}: already retargeted, skipping.`);
        continue;
      }
      const result = db
        .prepare("UPDATE practice_papers SET replaced_by = ? WHERE slug = ?")
        .run(fix.target, fix.slug);
      console.log(`  practice_papers ${fix.slug}: ${result.changes} row(s) updated to ${fix.target}`);
    }
    for (const fix of REDIRECT_FIXES) {
      const current = db
        .prepare("SELECT target_path FROM slug_redirects WHERE old_slug = ?")
        .get(fix.slug);
      if (current?.target_path === fix.targetPath) {
        console.log(`  slug_redirects ${fix.slug}: already retargeted, skipping.`);
        continue;
      }
      const result = db
        .prepare("UPDATE slug_redirects SET target_path = ? WHERE old_slug = ? AND entity_type = ?")
        .run(fix.targetPath, fix.slug, fix.entityType);
      console.log(`  slug_redirects ${fix.slug}: ${result.changes} row(s) updated to ${fix.targetPath}`);
    }
  } finally {
    db.close();
  }
}

async function applyRemote(client) {
  const transaction = await client.transaction("write");
  try {
    for (const fix of FIXES) {
      const current = await transaction.execute({
        sql: "SELECT replaced_by FROM practice_papers WHERE slug = ?",
        args: [fix.slug],
      });
      const row = current.rows?.[0];
      if (row?.replaced_by === fix.target) {
        console.log(`  practice_papers ${fix.slug}: already retargeted, skipping.`);
        continue;
      }
      const update = await transaction.execute({
        sql: "UPDATE practice_papers SET replaced_by = ? WHERE slug = ?",
        args: [fix.target, fix.slug],
      });
      console.log(`  practice_papers ${fix.slug}: ${update.rowsAffected ?? update.changes} row(s) updated to ${fix.target}`);
    }
    for (const fix of REDIRECT_FIXES) {
      const current = await transaction.execute({
        sql: "SELECT target_path FROM slug_redirects WHERE old_slug = ? AND entity_type = ?",
        args: [fix.slug, fix.entityType],
      });
      const row = current.rows?.[0];
      if (row?.target_path === fix.targetPath) {
        console.log(`  slug_redirects ${fix.slug}: already retargeted, skipping.`);
        continue;
      }
      const update = await transaction.execute({
        sql: "UPDATE slug_redirects SET target_path = ? WHERE old_slug = ? AND entity_type = ?",
        args: [fix.targetPath, fix.slug, fix.entityType],
      });
      console.log(`  slug_redirects ${fix.slug}: ${update.rowsAffected ?? update.changes} row(s) updated to ${fix.targetPath}`);
    }
    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => {});
    transaction.close();
    throw error;
  }
  transaction.close();
}

async function main() {
  if (DRY_RUN || LOCAL) {
    const rows = await inspectLocal();
    for (const fix of rows) {
      if (fix.kind === "practice_paper") {
        const status = fix.before
          ? `replaced_by=${fix.before.replaced_by} -> would become ${fix.target}`
          : "MISSING";
        console.log(`  practice_papers ${fix.slug}: ${status}`);
        if (!fix.before) throw new Error(`${fix.slug} not found in local D1`);
        if (Number(fix.before.is_archived) !== 1) {
          throw new Error(`${fix.slug} is not archived — refusing to retarget.`);
        }
      } else {
        const status = fix.before
          ? `target_path=${fix.before.target_path ?? "null"} (entity_type=${fix.before.entity_type}) -> would become ${fix.target}`
          : "MISSING";
        console.log(`  slug_redirects ${fix.slug}: ${status}`);
      }
    }
    if (DRY_RUN) {
      console.log("\nDry run complete. Re-run with --local to apply to the local D1 copy.");
      return;
    }
    applyLocal();
    const after = await inspectLocal();
    console.log("\nAfter:");
    for (const fix of after) {
      const value = fix.kind === "practice_paper" ? `replaced_by=${fix.before?.replaced_by}` : `target_path=${fix.before?.target_path ?? "null"}`;
      console.log(`  ${fix.kind} ${fix.slug}: ${value}`);
    }
    return;
  }

  // Turso path
  const client = createTursoClient();
  const before = await inspectRemote(client);
  console.log("Before:");
  for (const fix of before) {
    if (fix.kind === "practice_paper") {
      console.log(`  practice_papers ${fix.slug}: replaced_by=${fix.before?.replaced_by ?? "MISSING"}`);
      if (fix.before && Number(fix.before.is_archived) !== 1) {
        throw new Error(`${fix.slug} is not archived — refusing to retarget.`);
      }
    } else {
      console.log(`  slug_redirects ${fix.slug}: target_path=${fix.before?.target_path ?? "MISSING"}`);
      if (!fix.before) {
        throw new Error(`slug redirect for ${fix.slug} is missing — refusing to continue.`);
      }
    }
  }
  await applyRemote(client);
  const after = await inspectRemote(client);
  console.log("After:");
  for (const fix of after) {
    const value = fix.kind === "practice_paper" ? `replaced_by=${fix.before?.replaced_by}` : `target_path=${fix.before?.target_path ?? "null"}`;
    console.log(`  ${fix.kind} ${fix.slug}: ${value}`);
  }
}

main().catch((error) => {
  console.error(error?.stack ?? error);
  process.exit(1);
});
