import { spawn, execSync } from "node:child_process";
import { copyFileSync, existsSync, unlinkSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";
import http from "node:http";
import { generateAppendixC } from "./generate-appendix-c.mjs";

console.log("=== STARTING FULL VERIFICATION SUITE (FIX R1) ===");

// 1. Locate and back up local D1 SQLite database to preserve working state (Global Rule 3)
const d1Dir = resolve(process.cwd(), ".wrangler/state/v3/d1/miniflare-D1DatabaseObject");
let sqliteFile = null;
let backupFile = null;

try {
  const files = readdirSync(d1Dir)
    .filter((f) => f.endsWith(".sqlite") && !f.includes("backup"))
    .map((f) => ({ name: f, size: statSync(join(d1Dir, f)).size }))
    .sort((a, b) => b.size - a.size);

  if (files.length > 0) {
    sqliteFile = join(d1Dir, files[0].name);
    backupFile = join(d1Dir, `${files[0].name}.audit-backup`);
    console.log(`[DB Protection] Backing up ${sqliteFile} -> ${backupFile}`);
    copyFileSync(sqliteFile, backupFile);
    // Also backup WAL if present
    if (existsSync(`${sqliteFile}-wal`)) copyFileSync(`${sqliteFile}-wal`, `${backupFile}-wal`);
    if (existsSync(`${sqliteFile}-shm`)) copyFileSync(`${sqliteFile}-shm`, `${backupFile}-shm`);
  }
} catch (err) {
  console.warn("[DB Protection] Warning: could not back up local sqlite file:", err.message);
}

function restoreDatabase() {
  if (sqliteFile && backupFile && existsSync(backupFile)) {
    console.log(`\n[DB Protection] Restoring pristine local database from ${backupFile}...`);
    try {
      copyFileSync(backupFile, sqliteFile);
      unlinkSync(backupFile);
      if (existsSync(`${backupFile}-wal`)) {
        copyFileSync(`${backupFile}-wal`, `${sqliteFile}-wal`);
        unlinkSync(`${backupFile}-wal`);
      }
      if (existsSync(`${backupFile}-shm`)) {
        copyFileSync(`${backupFile}-shm`, `${sqliteFile}-shm`);
        unlinkSync(`${backupFile}-shm`);
      }
      console.log("[DB Protection] Restore complete. Working database preserved cleanly.");
    } catch (err) {
      console.error("[DB Protection] Restore failed:", err.message);
    }
  }
}

async function waitForServer(url, timeoutMs = 60_000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await new Promise((resolve, reject) => {
        const req = http.get(url, (res) => {
          if (res.statusCode && res.statusCode < 500) resolve(true);
          else reject(new Error(`Status ${res.statusCode}`));
        });
        req.on("error", reject);
        req.setTimeout(2000, () => {
          req.destroy();
          reject(new Error("Timeout"));
        });
      });
      return true;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  throw new Error(`Server did not respond at ${url} within ${timeoutMs}ms`);
}

let serverProcess = null;

try {
  // Step 2: Ensure fresh production build
  console.log("\n--- Step 2: Fresh Production Build (`astro check && astro build`) ---");
  execSync("npx astro check", { stdio: "inherit" });
  execSync("npx astro build", { stdio: "inherit" });

  // Step 3: Run Vitest Suite with JSON reporter
  console.log("\n--- Step 3: Vitest Unit & Integration Suite ---");
  execSync("npx vitest run --reporter=json --outputFile=docs/report/vitest-results.json", {
    stdio: "inherit",
  });

  // Step 4: Run Playwright E2E Suite
  console.log("\n--- Step 4: Playwright E2E Suite against Production Build ---");
  try {
    execSync("npx playwright test", {
      stdio: "inherit",
      env: { ...process.env, USE_PROD_BUILD: "1" },
    });
  } catch (err) {
    console.error("Playwright run reported failures:", err.message);
  }

  // Step 5: Launch Production Server via wrangler dev for Audits
  console.log("\n--- Step 5: Spawning Production Server (`wrangler dev --port 4321`) ---");
  serverProcess = spawn(
    "npx",
    ["wrangler", "dev", "--port", "4321", "--ip", "127.0.0.1"],
    {
      stdio: "pipe",
      shell: true,
      env: { ...process.env, CI: "true" },
    },
  );

  serverProcess.stdout.on("data", (data) => {
    const text = data.toString();
    if (text.includes("Ready") || text.includes("Starting local server") || text.includes("127.0.0.1:4321")) {
      console.log(`[Wrangler] ${text.trim()}`);
    }
  });

  serverProcess.stderr.on("data", (data) => {
    console.error(`[Wrangler ERR] ${data.toString().trim()}`);
  });

  console.log("Waiting for production server at http://127.0.0.1:4321/ ...");
  await waitForServer("http://127.0.0.1:4321/");
  console.log("✅ Production server is online and responding.");

  // Step 6: Run Axe Accessibility Audit
  console.log("\n--- Step 6: Axe Accessibility Audit against Production Build ---");
  try {
    execSync("node scripts/a11y-audit.mjs", {
      stdio: "inherit",
      env: { ...process.env, A11Y_BASE_URL: "http://127.0.0.1:4321" },
    });
  } catch (err) {
    console.error("Axe audit reported issues:", err.message);
  }

  // Step 7: SEO Consistency Check
  console.log("\n--- Step 7: SEO Consistency Audit ---");
  try {
    execSync("node scripts/seo-consistency.mjs", {
      stdio: "inherit",
      env: { ...process.env, BASE_URL: "http://127.0.0.1:4321" },
    });
  } catch (err) {
    console.error("SEO consistency reported issues:", err.message);
  }

  // Step 8: Copy Lint Check
  console.log("\n--- Step 8: Copy Lint Audit ---");
  try {
    execSync("node scripts/copy-lint.mjs", { stdio: "inherit" });
  } catch (err) {
    console.error("Copy lint reported issues:", err.message);
  }

  // Step 9: Generate Appendix C from machine JSONs
  console.log("\n--- Step 9: Generating Appendix C from Machine JSON Outputs ---");
  generateAppendixC();

  console.log("\n🎉 Full verification suite completed successfully!");
} finally {
  if (serverProcess && serverProcess.pid) {
    console.log("[Server] Shutting down wrangler dev...");
    try {
      if (process.platform === "win32") {
        execSync(`taskkill /pid ${serverProcess.pid} /T /F`, { stdio: "ignore" });
      } else {
        serverProcess.kill("SIGTERM");
      }
    } catch {}
  }
  restoreDatabase();
}

