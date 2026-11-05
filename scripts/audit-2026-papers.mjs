import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const PAPERS_DIR = "public/local-papers/papers";
const files = readdirSync(PAPERS_DIR).filter(f => f.includes("2026") && f.endsWith(".json"));

console.log(`Auditing all ${files.length} papers for 2026...`);

const results = [];

for (const file of files) {
  const filePath = join(PAPERS_DIR, file);
  const data = JSON.parse(readFileSync(filePath, "utf8"));
  const questions = data.exam?.questions || data.questions || [];

  for (let i = 0; i < questions.length; i++) {
    const q = questions[i];
    const qNum = q.sourceQuestionNo || q.number || (i + 1);
    const stem = q.stemEn || q.stem || "";
    const options = q.optionsEn || q.options || [];

    // 1. Leaked answers/keys in options
    for (const opt of options) {
      if (/Correct\s*(Answer|Option)|Solution:|Explanation:|#####?/i.test(opt.text || "")) {
        results.push({
          file,
          qNum,
          type: "LEAKED_KEY_IN_OPTION",
          detail: `Option ${opt.id}: ${opt.text}`
        });
      }
    }

    // 2. Extra options in array (more than 4 options)
    if (options.length > 4) {
      results.push({
        file,
        qNum,
        type: "EXTRA_OPTIONS_COUNT",
        detail: `Found ${options.length} options: ${options.map(o => o.id + ': ' + (o.text||'').slice(0, 20)).join(' | ')}`
      });
    }

    // 3. Question concatenation in stem (e.g. contains "\n2. ", "\n3. ", etc.)
    const stemNumberMatch = stem.match(/\n\s*(\d{1,2})\.\s+[A-Z]/);
    if (stemNumberMatch && parseInt(stemNumberMatch[1], 10) !== qNum) {
      results.push({
        file,
        qNum,
        type: "MERGED_QUESTION_IN_STEM",
        detail: `Stem contains question ${stemNumberMatch[1]}: ${stem.slice(0, 150).replace(/\n/g, ' ')}`
      });
    }

    // 4. Dummy options ["1", "2", "3", "4"]
    const optTexts = options.map(o => (o.text || "").trim());
    if (optTexts.length === 4 && optTexts[0] === "1" && optTexts[1] === "2" && optTexts[2] === "3" && optTexts[3] === "4") {
      // Check if stem has actual options (A) ... (B) ... (C) ... (D)
      const hasRealOptionsInStem = /\(A\)[\s\S]+\(B\)[\s\S]+\(C\)[\s\S]+\(D\)/.test(stem);
      results.push({
        file,
        qNum,
        type: "DUMMY_OPTIONS_1234",
        detail: hasRealOptionsInStem ? "Stem has (A)-(D) options embedded!" : "Pure dummy options, no (A)-(D) in stem"
      });
    }

    // 5. Crammed LaTeX options (e.g. \n\n $$ \mathrm{(C)...} $$ inside option B)
    for (const opt of options) {
      const text = opt.text || "";
      if (text.includes("\n\n $$") || text.includes("\n\n$$") || /\n\n\s*\(?[C-D]\)?\s+/i.test(text)) {
        if (!stem.includes("Match List")) {
          results.push({
            file,
            qNum,
            type: "CRAMMED_OPTIONS_IN_ONE_TEXT",
            detail: `Option ${opt.id}: ${text.replace(/\n/g, ' ').slice(0, 120)}`
          });
        }
      }
    }

    // 6. Empty option text
    for (const opt of options) {
      if (!opt.text || !opt.text.trim()) {
        results.push({
          file,
          qNum,
          type: "EMPTY_OPTION",
          detail: `Option ${opt.id} is empty`
        });
      }
    }
  }
}

console.log(`Found ${results.length} issues in 2026 papers:\n`);
for (const r of results) {
  console.log(`[${r.type}] ${r.file} (Q${r.qNum}):`);
  console.log(`  ${r.detail}\n`);
}

