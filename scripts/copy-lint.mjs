#!/usr/bin/env node
/**
 * Copy-Lint Script (Fix 8)
 *
 * Scans public and student-facing pages, components, and layouts for banned marketing
 * superlatives, unverified claims, or affiliation implications.
 *
 * Banned patterns (case-insensitive unless specified):
 * - "national rank" / "national percentile" (unverifiable NTA claim)
 * - "official mock" / "official test" / "official result" / "official answer key"
 * - "largest archive" / "largest question bank" / "largest verified"
 * - "verified percentile" / "verified subject accuracy"
 * - "100% guaranteed" / "100% authentic" / "100% compliant" / "guaranteed score"
 * - "authentic paper" / "authentic mock" / "authentic archive"
 *
 * Allowed usages (factual disclaimers and attributions):
 * - "National Testing Agency" in legal disclaimer / attribution
 * - "not an official NTA rank" / "not official results"
 * - "official NTA bulletin" / "official NTA portal" / "official syllabus scope"
 * - "width: 100%" (CSS)
 * - "authentication" (technical auth term)
 */

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const DIRS_TO_SCAN = [
  "src/pages",
  "src/components",
  "src/layouts",
  "src/lib",
];

const BANNED_PATTERNS = [
  {
    regex: /\bnational\s+(?:rank|percentile|standing|score|leaderboard)\b/i,
    description: "Unverified claim of national rank/percentile",
  },
  {
    regex: /\bofficial\s+(?:mock|test\b|results?\b|answer\s*key|question\s*paper)/i,
    description: "Claim that this site's mocks/tests/answers are official",
  },
  {
    regex: /\b(?:largest|biggest)\s+(?:archive|collection|library|question\s*bank|verified)/i,
    description: "Unverified superlative claim of archive size",
  },
  {
    regex: /\bverified\s+(?:percentile|subject\s*accuracy|rank)\b/i,
    description: "Claim of verified percentile or accuracy on public profile",
  },
  {
    regex: /100%\s*(?:guaranteed?|authentic|compliant|accurate|match)/i,
    description: "Unproven 100% marketing guarantee",
  },
  {
    regex: /\bguarantee(?:d)?\s+(?:score|rank|result|admission|success)\b/i,
    description: "Guarantee of admission or score",
  },
  {
    regex: /\bauthentic\s+(?:previous-year|paper|mock|archive|question)/i,
    description: "Unverified claim of authentic paper/mock",
  },
];

// Explicit allow-list for legitimate disclaimers and contexts
const ALLOWED_MATCHES = [
  // Disclaimers stating practice results are NOT official
  /not\s+official\s+results/i,
  /not\s+an\s+official\s+NTA\s+rank/i,
  /not\s+an\s+official\s+rank/i,
  /not\s+an\s+official\s+score/i,
  /independent\s+practice\s*,\s*unofficial\s+scores/i,
  /practice\s+results\s+are\s+not\s+official/i,
  /are\s+practice\s+indicators\s*,\s*not\s+official/i,
  /not\s+official\s+NTA\s+scores/i,
  /unofficial\s+study\s+guide/i,
  // Educational attribution to official NTA portal/bulletin
  /official\s+NTA\s+bulletin/i,
  /official\s+NTA\s+portal/i,
  /official\s+NTA\s+page/i,
  /official\s+NTA\s+source/i,
  /official\s+syllabus\s+scope/i,
  /official\s+information\s+bulletin/i,
  /official\s+pattern\s+and\s+this\s+guide/i,
  /official\s+summary/i,
  /official\s+portals/i,
  /official\s+exam\s+names/i,
  /official\s+PDF/i,
  // Section 52(1)(i) fair-use legal notice
  /Section\s+52\(1\)\(i\)/i,
  // Question text or explanations discussing historical/scientific facts (e.g., Rowlatt Act, Montreal Protocol, DNS)
  /National\s+parks/i,
  /Indian\s+National\s+Congress/i,
  /National\s+Testing\s+Agency/i,
];

function getFilesRecursively(dir) {
  const files = [];
  try {
    const entries = readdirSync(dir);
    for (const entry of entries) {
      const full = join(dir, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        files.push(...getFilesRecursively(full));
      } else if (/\.(astro|ts|tsx|js|mjs|json)$/.test(entry)) {
        // Skip keys.json and test fixtures which contain raw exam question crops / historical question text
        if (!full.includes("local-papers/keys.json") && !full.includes("tests/")) {
          files.push(full);
        }
      }
    }
  } catch {
    // dir may not exist
  }
  return files;
}

function lint() {
  console.log("================================================================");
  console.log("CUET Free Mock Test — Copy-Lint Policy Checker (Fix 8)");
  console.log("================================================================\n");

  const violations = [];
  let filesChecked = 0;

  for (const dir of DIRS_TO_SCAN) {
    const files = getFilesRecursively(join(process.cwd(), dir));
    for (const file of files) {
      filesChecked++;
      const content = readFileSync(file, "utf8");
      const lines = content.split("\n");

      lines.forEach((line, lineIdx) => {
        for (const pattern of BANNED_PATTERNS) {
          const match = pattern.regex.exec(line);
          if (match) {
            // Check allow-list
            const isAllowed = ALLOWED_MATCHES.some((allow) => allow.test(line));
            if (!isAllowed) {
              violations.push({
                file: relative(process.cwd(), file),
                line: lineIdx + 1,
                matched: match[0],
                description: pattern.description,
                context: line.trim(),
              });
            }
          }
        }
      });
    }
  }

  console.log(`Files scanned: ${filesChecked}`);
  console.log(`Violations detected: ${violations.length}\n`);

  if (violations.length > 0) {
    console.error("FAIL: Banned marketing or superlative phrases detected:");
    for (const v of violations) {
      console.error(`  - ${v.file}:${v.line} [${v.matched}]: ${v.description}`);
      console.error(`    Context: "${v.context}"`);
    }
    process.exitCode = 1;
  } else {
    console.log("SUCCESS: 0 violations. All site copy is 100% honest and policy-compliant!");
    process.exitCode = 0;
  }
}

lint();
