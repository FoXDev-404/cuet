import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAPERS_DIR = "public/local-papers/papers";
const files = readdirSync(PAPERS_DIR).filter(f => f.endsWith(".json"));

console.log(`Scanning ${files.length} papers in ${PAPERS_DIR}...`);

const issues = {
  crammedOptions: [],
  dummyNumberOptions: [],
  stemStartsWith4: [],
  truncatedTableImages: [],
  emptyOptions: [],
  passageContainsQuestion: [],
};

for (const file of files) {
  const filePath = join(PAPERS_DIR, file);
  let paper;
  try {
    paper = JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    console.error(`Error reading ${file}:`, err);
    continue;
  }

  const questions = paper.exam?.questions || paper.questions || [];
  const passages = paper.exam?.passages || paper.passages || [];
  const passageMap = new Map();
  for (const pas of passages) {
    passageMap.set(pas.id, pas.contentEn || pas.content || "");
  }

  for (const q of questions) {
    const qNum = q.sourceQuestionNo || q.number || q.id;
    const stem = q.stemEn || q.stem || "";
    const options = q.optionsEn || q.options || [];

    // 1. Check for dummy number options: ["1", "2", "3", "4"] or ["1.", "2.", "3.", "4."]
    const optTexts = options.map(o => (o.text || "").trim());
    const isDummyNumbers = optTexts.length >= 4 &&
      optTexts[0] === "1" && optTexts[1] === "2" && optTexts[2] === "3" && optTexts[3] === "4";
    
    if (isDummyNumbers) {
      issues.dummyNumberOptions.push({ file, qNum, stem: stem.slice(0, 80) });
    }

    // 2. Check for stem starting with "4. " or "4."
    if (/^\s*4\.\s*/.test(stem)) {
      issues.stemStartsWith4.push({ file, qNum, stem: stem.slice(0, 80) });
    }

    // 3. Check for crammed options (e.g. option text containing "(B)", "(C)", "(D)" or "\mathrm{(C)}" or "\mathrm{(B)}")
    for (const opt of options) {
      const text = opt.text || "";
      if (
        /\b\([B-D]\)|\b\(ii\b|\b\(iii\b|\\mathrm\{\([B-D]\)\}|\\mathrm\{\([b-d]\)\}/i.test(text) &&
        !stem.includes("Match List") // ignore if stem itself is match list where option is (A)-(I), (B)-(II)
      ) {
        // Also check if text contains newline followed by $$ or (C) or (D)
        if (text.includes("(C)") || text.includes("(D)") || text.includes("(B)") || text.includes("\n\n(C)") || text.includes("\n\n(D)")) {
          issues.crammedOptions.push({ file, qNum, optId: opt.id, snippet: text.slice(0, 100).replace(/\n/g, " ") });
        }
      }
    }

    // 4. Check for empty options (when optionsAreImages is false or not set)
    if (!q.optionsAreImages && options.some(o => !(o.text && o.text.trim()) && !o.imageUrl)) {
      issues.emptyOptions.push({ file, qNum });
    }

    // 5. Check if stem is just "Match List-I with List-II" but only has a table asset
    if (/^Match List-?I with List-?II/i.test(stem.trim()) && stem.trim().length < 40) {
      const assets = q.assets || [];
      const hasTableAsset = assets.some(a => a.kind === "table" || a.path?.includes("table"));
      issues.truncatedTableImages.push({ file, qNum, stem: stem.trim(), assets: assets.map(a => a.path) });
    }
  }
}

console.log("=== SCAN RESULTS ===");
console.log(`Dummy number options (1,2,3,4): ${issues.dummyNumberOptions.length}`);
for (const item of issues.dummyNumberOptions) {
  console.log(`  ${item.file} Q${item.qNum}: ${item.stem}`);
}

console.log(`\nStem starts with '4. ': ${issues.stemStartsWith4.length}`);
for (const item of issues.stemStartsWith4) {
  console.log(`  ${item.file} Q${item.qNum}: ${item.stem}`);
}

console.log(`\nCrammed options: ${issues.crammedOptions.length}`);
for (const item of issues.crammedOptions.slice(0, 30)) {
  console.log(`  ${item.file} Q${item.qNum} [${item.optId}]: ${item.snippet}`);
}
if (issues.crammedOptions.length > 30) {
  console.log(`  ... and ${issues.crammedOptions.length - 30} more`);
}

console.log(`\nEmpty options: ${issues.emptyOptions.length}`);
for (const item of issues.emptyOptions.slice(0, 20)) {
  console.log(`  ${item.file} Q${item.qNum}`);
}

console.log(`\nMatch List questions with short stem (relying on assets): ${issues.truncatedTableImages.length}`);
for (const item of issues.truncatedTableImages.slice(0, 30)) {
  console.log(`  ${item.file} Q${item.qNum}: assets=${item.assets.join(", ")}`);
}

