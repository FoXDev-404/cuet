import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const INDEX_FILE = join(ROOT, "src", "data", "local-papers", "index.json");
const KEYS_FILE = join(ROOT, "src", "data", "local-papers", "keys.json");
const PAPERS_DIR = join(ROOT, "public", "local-papers", "papers");

const indexData = JSON.parse(readFileSync(INDEX_FILE, "utf8"));
const keysData = JSON.parse(readFileSync(KEYS_FILE, "utf8"));

import { pathToFileURL } from "node:url";

// Import timing function
const { calculateMockDuration } = await import(pathToFileURL(join(ROOT, "src", "lib", "exam-timing.ts")).href);

let updatedCount = 0;

for (const p of indexData.papers) {
  const paperFile = join(PAPERS_DIR, `${p.slug}.json`);
  let raw;
  try {
    raw = JSON.parse(readFileSync(paperFile, "utf8"));
  } catch {
    continue;
  }

  const rawQuestions = raw.exam?.questions || raw.questions || [];
  const storedKeys = keysData.papers?.[p.slug] || {};

  let scorable = 0;
  let imageQuestionCount = 0;
  let assetCount = 0;

  for (const q of rawQuestions) {
    const assets = (q.assets || []).filter(
      (a) => a && (a.url || a.path || a.image_url || a.kind === "question")
    );
    if (assets.length > 0) imageQuestionCount++;
    assetCount += assets.length;

    const storedKey = storedKeys[q.id]?.a ?? storedKeys[q.id]?.correctAnswer;
    const directKey = q.correctAnswer;
    const finalKey = (storedKey !== undefined && storedKey !== null && storedKey !== "") ? storedKey : directKey;

    if (finalKey !== undefined && finalKey !== null && finalKey !== "") {
      scorable++;
    }
  }

  const questionCount = rawQuestions.length;
  const pending = Math.max(0, questionCount - scorable);
  const timing = calculateMockDuration(scorable || questionCount, p.subject?.name || "CUET");
  const duration = timing.durationMinutes;

  let changed = false;
  if (p.questionCount !== questionCount) {
    p.questionCount = questionCount;
    changed = true;
  }
  if (p.scorableQuestionCount !== scorable) {
    p.scorableQuestionCount = scorable;
    changed = true;
  }
  if (p.pendingReviewCount !== pending) {
    p.pendingReviewCount = pending;
    changed = true;
  }
  if (p.imageQuestionCount !== imageQuestionCount) {
    p.imageQuestionCount = imageQuestionCount;
    changed = true;
  }
  if (p.assetCount !== assetCount) {
    p.assetCount = assetCount;
    changed = true;
  }
  if (p.durationMinutes !== duration) {
    p.durationMinutes = duration;
    changed = true;
  }

  // Update metaDescription count if present
  if (p.metaDescription) {
    const newDesc = p.metaDescription
      .replace(/\d+\s+questions?/, `${questionCount} questions`)
      .replace(/\d+\s+scored/, `${scorable} scored`);
    if (newDesc !== p.metaDescription) {
      p.metaDescription = newDesc;
      changed = true;
    }
  }

  if (changed) {
    updatedCount++;
    console.log(`Synced ${p.slug}: ${questionCount}Q, ${scorable} scored, ${pending} pending, ${imageQuestionCount} imgs, ${assetCount} assets, ${duration} min`);
  }
}

writeFileSync(INDEX_FILE, JSON.stringify(indexData, null, 2), "utf8");
console.log(`Successfully synced ${updatedCount} papers in index.json!`);
