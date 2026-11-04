/**
 * Extract verifiable machine facts for the CUET Mock Project Report.
 * Output: docs/report/facts.json
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const ROOT = process.cwd();

// 1. Dependency versions from package.json and package-lock.json
function getDependencyFacts() {
  const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
  let lock = null;
  if (existsSync(join(ROOT, "package-lock.json"))) {
    try {
      lock = JSON.parse(readFileSync(join(ROOT, "package-lock.json"), "utf8"));
    } catch {}
  }

  const resolveVersion = (name) => {
    if (lock?.packages?.[`node_modules/${name}`]?.version) {
      return lock.packages[`node_modules/${name}`].version;
    }
    return pkg.dependencies?.[name] ?? pkg.devDependencies?.[name] ?? "unknown";
  };

  const keyDeps = [
    "astro",
    "@astrojs/cloudflare",
    "tailwindcss",
    "@playwright/test",
    "vitest",
    "satori",
    "katex",
    "better-sqlite3",
    "wrangler",
    "axe-core",
    "fflate",
  ];

  const dependencies = {};
  for (const dep of keyDeps) {
    dependencies[dep] = resolveVersion(dep);
  }

  return {
    packageVersion: pkg.version ?? "1.0.0",
    dependencies,
    allDependencies: pkg.dependencies ?? {},
    devDependencies: pkg.devDependencies ?? {},
    overrides: pkg.overrides ?? {},
  };
}

// 2. Discover all routes from src/pages
function getRouteFacts() {
  const pagesDir = join(ROOT, "src", "pages");
  const routes = [];

  function walk(dir, currentPrefix = "") {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(join(dir, entry.name), `${currentPrefix}/${entry.name}`);
      } else if (/\.(astro|ts|js)$/.test(entry.name)) {
        let routePath = `${currentPrefix}/${entry.name.replace(/\.(astro|ts|js)$/, "")}`;
        if (routePath.endsWith("/index")) {
          routePath = routePath.slice(0, -"/index".length) || "/";
        }
        if (!routePath.startsWith("/")) routePath = `/${routePath}`;

        const isApi = routePath.startsWith("/api/");
        const isDynamic = /\[.+\]/.test(routePath);
        const filePath = join(dir, entry.name).replace(ROOT + "\\", "").replace(ROOT + "/", "");

        routes.push({
          path: routePath,
          filePath,
          isApi,
          isDynamic,
          type: entry.name.endsWith(".astro") ? "page" : "endpoint",
        });
      }
    }
  }

  walk(pagesDir);
  routes.sort((a, b) => a.path.localeCompare(b.path));

  return {
    totalRoutes: routes.length,
    pagesCount: routes.filter((r) => r.type === "page").length,
    apiCount: routes.filter((r) => r.type === "endpoint").length,
    dynamicCount: routes.filter((r) => r.isDynamic).length,
    routes,
  };
}

// 3. Database Table Catalogue & Row Counts
function getDatabaseFacts() {
  const sqliteFiles = [
    join(
      ROOT,
      ".wrangler/state/v3/d1/miniflare-D1DatabaseObject/9e86a3487f62f60f2005838556d2eb9f94df20a990ccf3e7e9e15550212e2901.sqlite"
    ),
  ];

  let dbPath = sqliteFiles.find((p) => existsSync(p));
  if (!dbPath) {
    return { error: "Local D1 sqlite database file not found" };
  }

  const db = new DatabaseSync(dbPath);
  const tables = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY name"
    )
    .all();

  const tableFacts = [];
  let totalRows = 0;

  for (const { name } of tables) {
    let rowCount = 0;
    try {
      const res = db.prepare(`SELECT COUNT(*) as c FROM "${name}"`).get();
      rowCount = Number(res?.c ?? 0);
    } catch (e) {
      rowCount = -1;
    }
    totalRows += rowCount > 0 ? rowCount : 0;

    const columns = db.prepare(`PRAGMA table_info("${name}")`).all();
    const indexes = db.prepare(`PRAGMA index_list("${name}")`).all();

    tableFacts.push({
      name,
      rowCount,
      columnsCount: columns.length,
      indexesCount: indexes.length,
      columns: columns.map((c) => ({
        cid: c.cid,
        name: c.name,
        type: c.type,
        notnull: Boolean(c.notnull),
        pk: Boolean(c.pk),
      })),
    });
  }

  // Extract real explanation counts and unkeyed counts directly from database
  const explanationStats = {
    questions: { ai_draft: 0, banner: 0, none: 0, reviewed: 0 },
    practice: { ai_draft: 0, banner: 0, none: 0, reviewed: 0 },
    unkeyedPracticeQuestions: 0,
    unkeyedQuestions: 0,
    totalAiDraft: 0,
    totalNoExplanation: 0,
    totalReviewed: 0,
  };

  try {
    const qRows = db
      .prepare(
        "SELECT explanation_source, explanation_status, COUNT(*) as c FROM questions GROUP BY explanation_source, explanation_status"
      )
      .all();
    for (const r of qRows) {
      if (r.explanation_source === "ai_draft") explanationStats.questions.ai_draft += Number(r.c);
      if (r.explanation_source === "banner") explanationStats.questions.banner += Number(r.c);
      if (r.explanation_source === "none") explanationStats.questions.none += Number(r.c);
      if (r.explanation_status === "reviewed") explanationStats.questions.reviewed += Number(r.c);
    }

    const pqRows = db
      .prepare(
        "SELECT explanation_source, explanation_status, COUNT(*) as c FROM practice_questions GROUP BY explanation_source, explanation_status"
      )
      .all();
    for (const r of pqRows) {
      if (r.explanation_source === "ai_draft") explanationStats.practice.ai_draft += Number(r.c);
      if (r.explanation_source === "banner") explanationStats.practice.banner += Number(r.c);
      if (r.explanation_source === "none") explanationStats.practice.none += Number(r.c);
      if (r.explanation_status === "reviewed") explanationStats.practice.reviewed += Number(r.c);
    }

    explanationStats.totalAiDraft = explanationStats.questions.ai_draft + explanationStats.practice.ai_draft;
    explanationStats.totalNoExplanation = explanationStats.questions.none + explanationStats.practice.none;
    explanationStats.totalReviewed = explanationStats.questions.reviewed + explanationStats.practice.reviewed;

    const unkeyedQ = db.prepare("SELECT COUNT(*) as c FROM questions WHERE correct_option IS NULL").get();
    explanationStats.unkeyedQuestions = Number(unkeyedQ?.c ?? 0);

    const unkeyedPQ = db.prepare("SELECT COUNT(*) as c FROM practice_questions WHERE correct_option IS NULL").get();
    explanationStats.unkeyedPracticeQuestions = Number(unkeyedPQ?.c ?? 0);
  } catch (err) {
    console.warn("Could not query explanation stats:", err.message);
  }

  return {
    databasePath: dbPath.replace(ROOT + "\\", "").replace(ROOT + "/", ""),
    totalTables: tableFacts.length,
    totalRows,
    tables: tableFacts,
    explanationStats,
  };
}

// 4. Migrations
function getMigrationFacts() {
  const migrationsDir = join(ROOT, "migrations");
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  return {
    totalMigrations: files.length,
    migrations: files.map((name) => {
      const content = readFileSync(join(migrationsDir, name), "utf8");
      return {
        name,
        bytes: content.length,
        lines: content.split("\n").length,
      };
    }),
  };
}

// 5. Environment Variables
function getEnvFacts() {
  const wranglerPath = join(ROOT, "wrangler.jsonc");
  let wranglerVars = {};
  if (existsSync(wranglerPath)) {
    try {
      // simple parse ignoring comments
      const raw = readFileSync(wranglerPath, "utf8").replace(/\/\/.*/g, "");
      const parsed = JSON.parse(raw);
      wranglerVars = parsed.vars ?? {};
    } catch {}
  }

  const devVarsPath = join(ROOT, ".dev.vars");
  const devVarsKeys = [];
  if (existsSync(devVarsPath)) {
    const lines = readFileSync(devVarsPath, "utf8").split("\n");
    for (const l of lines) {
      const m = l.match(/^([A-Z0-9_]+)=/);
      if (m) devVarsKeys.push(m[1]);
    }
  }

  const documentedVars = [
    "ENV",
    "SITE_URL",
    "AUTH_SECRET",
    "ADMIN_AUTH_MODE",
    "ADMIN_ALLOW_SESSION_IN_PROD",
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "CF_ACCESS_TEAM_DOMAIN",
    "CF_ACCESS_AUD",
    "BOOTSTRAP_SUPER_ADMIN_EMAIL",
    "MEDIA_BUCKET",
    "MEDIA_FALLBACK_KV",
    "CF_ANALYTICS_TOKEN",
    "GOOGLE_SITE_VERIFICATION",
    "ADSENSE_CLIENT_ID",
  ];

  return {
    documentedVars: documentedVars.map((v) => ({
      name: v,
      status: devVarsKeys.includes(v) || wranglerVars[v] !== undefined ? "set" : "unset",
      source: wranglerVars[v] !== undefined ? "wrangler.jsonc" : devVarsKeys.includes(v) ? ".dev.vars" : "missing",
    })),
  };
}

function main() {
  console.log("Generating report facts...");
  const facts = {
    generatedAt: new Date().toISOString(),
    nodeVersion: process.version,
    dependencies: getDependencyFacts(),
    routes: getRouteFacts(),
    database: getDatabaseFacts(),
    migrations: getMigrationFacts(),
    environments: getEnvFacts(),
  };

  const outDir = join(ROOT, "docs", "report");
  const outFile = join(outDir, "facts.json");
  writeFileSync(outFile, JSON.stringify(facts, null, 2), "utf8");

  console.log(`Facts written to ${outFile}`);
  console.log(`- Dependencies tracked: ${Object.keys(facts.dependencies.dependencies).length}`);
  console.log(`- Routes: ${facts.routes.totalRoutes} (${facts.routes.pagesCount} pages, ${facts.routes.apiCount} APIs)`);
  console.log(`- Database Tables: ${facts.database.totalTables} (${facts.database.totalRows} total rows)`);
  console.log(`- Migrations: ${facts.migrations.totalMigrations}`);
}

main();

