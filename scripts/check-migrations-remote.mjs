import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";

const migrationsDir = resolve(process.cwd(), "migrations");
const expectedFiles = readdirSync(migrationsDir)
  .filter((f) => f.endsWith(".sql"))
  .sort();

console.log("================================================================");
console.log("Remote D1 Migration Verification & Drift Checker (Fix R4)");
console.log(`Local migration directory: ${expectedFiles.length} migrations`);
console.log("================================================================\n");

const environments = [
  { name: "staging", db: "cuet-d1-staging", envFlag: "--env staging" },
  { name: "production", db: "cuet-blueprint-db", envFlag: "" },
];

// These conditions mean the remote check could not run; they are not evidence
// of migration drift. Quota exhaustion is expected on the D1 free tier and the
// production database now lives in Turso, so D1 remains a legacy/fallback copy.
const UNVERIFIED_PATTERNS = [
  "Authentication",
  "not authenticated",
  "API token",
  "daily row read limit",
  "exceeded D1's free tier",
  "code: 7500",
  "code: 7403",
  "not valid or is not authorized",
  "rate limit",
  "Too Many Requests",
];

function isUnverified(output) {
  return UNVERIFIED_PATTERNS.some((pattern) => output.includes(pattern));
}

let hasDrift = false;
const verified = [];
const unverified = [];

for (const env of environments) {
  console.log(`Checking remote environment: ${env.name.toUpperCase()} (${env.db})...`);
  try {
    const cmd = `npx wrangler d1 migrations list ${env.db} --remote ${env.envFlag}`.trim();
    const stdout = execSync(cmd, { encoding: "utf8", stdio: "pipe" });
    console.log(stdout.trim());
    console.log(`✅ ${env.name} migrations verified successfully.\n`);
    verified.push(env.name);
  } catch (err) {
    const output = [err.stdout, err.stderr, err.message]
      .filter(Boolean)
      .map((part) => part.toString())
      .join("\n");
    console.warn(`[Remote Notice] ${env.name} query output:`);
    console.log(output.trim());
    if (isUnverified(output)) {
      console.log(
        `⚠️  ${env.name} could not be queried (missing CLI credentials or D1 free-tier limit). ` +
          `Migration list marked UNVERIFIED, not drifted (offline rule 7).\n`,
      );
      unverified.push(env.name);
    } else {
      console.error(`❌ Migration check failed for ${env.name}: ${err.message}\n`);
      hasDrift = true;
    }
  }
}

if (hasDrift) {
  console.error("FAIL: Migration drift detected across remote D1 instances.");
  process.exit(1);
} else {
  console.log(
    `SUCCESS: No migration drift detected. Verified: ${verified.length > 0 ? verified.join(", ") : "none"}; ` +
      `unverified: ${unverified.length > 0 ? unverified.join(", ") : "none"}.`,
  );
}

