import { execSync } from "node:child_process";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const specs = [
  "admin-flow.spec.ts",
  "api-contracts.spec.ts",
  "attempt-flow.spec.ts",
  "integrations.spec.ts",
  "local-practice.spec.ts",
  "question-share-public.spec.ts",
  "security.spec.ts",
  "slow-network.spec.ts",
  "theme.spec.ts",
];

mkdirSync("test-results", { recursive: true });

const merged = {
  config: {},
  suites: [],
  errors: [],
  stats: {
    startTime: new Date().toISOString(),
    duration: 0,
    expected: 0,
    skipped: 0,
    unexpected: 0,
    flaky: 0,
  },
};

for (const spec of specs) {
  const specOutputFile = `test-results/results-${spec}.json`;
  console.log(`Running E2E spec: ${spec}...`);
  try {
    execSync(
      `npx playwright test tests/e2e/${spec}`,
      {
        stdio: "inherit",
        env: {
          ...process.env,
          USE_PROD_BUILD: "1",
          PLAYWRIGHT_JSON_OUTPUT_NAME: specOutputFile,
        },
      },
    );
  } catch (err) {
    console.warn(`Spec ${spec} exited with code: ${err.status}`);
  }

  const specPath = resolve(process.cwd(), specOutputFile);
  if (existsSync(specPath)) {
    try {
      const data = JSON.parse(readFileSync(specPath, "utf8"));
      merged.config = data.config || merged.config;
      merged.suites.push(...(data.suites || []));
      merged.stats.duration += data.stats?.duration || 0;
    } catch (e) {
      console.error(`Failed to parse ${specOutputFile}:`, e.message);
    }
  }
}

// Deduplicate suites by file path/title
const seen = new Set();
merged.suites = merged.suites.filter((s) => {
  if (seen.has(s.title)) return false;
  seen.add(s.title);
  return true;
});

// Recompute stats from suites
let expected = 0;
let skipped = 0;
let unexpected = 0;

function walk(s) {
  for (const spec of s.specs || []) {
    const status = spec.tests?.[0]?.status || (spec.ok ? "expected" : "unexpected");
    if (status === "expected") expected += 1;
    else if (status === "skipped") skipped += 1;
    else unexpected += 1;
  }
  for (const child of s.suites || []) {
    walk(child);
  }
}

for (const suite of merged.suites) {
  walk(suite);
}

merged.stats.expected = expected;
merged.stats.skipped = skipped;
merged.stats.unexpected = unexpected;

mkdirSync("docs/report", { recursive: true });
const targetFile = resolve(process.cwd(), "docs/report/playwright-results.json");
writeFileSync(targetFile, JSON.stringify(merged, null, 2), "utf8");
console.log(`\n✅ Saved aggregated Playwright results to ${targetFile}:`);
console.log(`- Expected (Passed): ${expected}`);
console.log(`- Unexpected (Failed): ${unexpected}`);
console.log(`- Skipped: ${skipped}`);
console.log(`- Total Specs: ${merged.suites.length}`);
console.log(`- Total Tests: ${expected + unexpected + skipped}`);
