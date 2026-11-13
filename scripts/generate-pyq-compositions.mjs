#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildPaper,
  buildSummary,
  createStoredKeys,
} from "../src/lib/practice-normalize.ts";
import { calculateMockDuration } from "../src/lib/exam-timing.ts";

const ROOT = resolve(join(fileURLToPath(new URL(".", import.meta.url)), ".."));
const INDEX_FILE = join(ROOT, "src", "data", "local-papers", "index.json");
const KEYS_FILE = join(ROOT, "src", "data", "local-papers", "keys.json");
const PAPERS_DIR = join(ROOT, "public", "local-papers", "papers");
const OUTPUT_FILE = join(ROOT, "src", "data", "local-papers", "pyq-compositions.json");

function readJson(file) {
  return JSON.parse(readFileSync(file, "utf8"));
}

function isRankable(question) {
  return (
    question.scorable &&
    question.options.length >= 2 &&
    question.options.every(
      (option) => (option.text && option.text.trim().length > 0) || option.image_url,
    )
  );
}

function fingerprint(question) {
  const normalize = (value) =>
    String(value ?? "")
      .normalize("NFKC")
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  return JSON.stringify([
    normalize(question.stemEn),
    question.options.map((option) => normalize(option.text)),
    normalize(question.passage?.content),
    question.matchList
      ? [
          question.matchList.listI.map((item) => normalize(item.text)),
          question.matchList.listII.map((item) => normalize(item.text)),
        ]
      : null,
    question.arrangementItems.map((item) => normalize(item.text)),
  ]);
}

function hash(value) {
  let result = 2166136261;
  for (const character of value) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return result >>> 0;
}

const index = readJson(INDEX_FILE);
const storedKeys = createStoredKeys(readJson(KEYS_FILE));
const papersBySlug = new Map();

for (const rawSummary of index.papers ?? []) {
  const summary = buildSummary(rawSummary);
  if (!summary) continue;

  const raw = readJson(join(PAPERS_DIR, `${summary.slug}.json`));
  const paper = buildPaper(raw, summary, storedKeys.get(summary.slug));
  if (!paper) throw new Error(`Could not normalize paper ${summary.slug}.`);

  papersBySlug.set(summary.slug, {
    slug: summary.slug,
    subject: summary.subject.name,
    questions: paper.questions.filter(isRankable),
  });
}

const targets = [...papersBySlug.values()]
  .filter((paper) => paper.questions.length >= 40 && paper.questions.length < 50)
  .sort((a, b) => a.slug.localeCompare(b.slug));
const usedQuestionRefs = new Set();
const usedSupplementFingerprints = new Set();
const compositions = {};
const unfilled = [];

for (const target of targets) {
  const needed = 50 - target.questions.length;
  const targetFingerprints = new Set(target.questions.map(fingerprint));
  const sourceGroups = [...papersBySlug.values()]
    .filter((paper) => paper.subject === target.subject && paper.slug !== target.slug)
    .map((paper) => ({
      paper,
      questions: [...paper.questions].sort(
        (a, b) =>
          hash(`${target.slug}:${paper.slug}:${a.id}`) -
            hash(`${target.slug}:${paper.slug}:${b.id}`) ||
          a.id.localeCompare(b.id),
      ),
      cursor: 0,
    }))
    .sort(
      (a, b) =>
        hash(`${target.slug}:${a.paper.slug}`) -
          hash(`${target.slug}:${b.paper.slug}`) ||
        a.paper.slug.localeCompare(b.paper.slug),
    );

  const selected = [];
  while (selected.length < needed) {
    let madeProgress = false;
    for (const group of sourceGroups) {
      while (group.cursor < group.questions.length) {
        const question = group.questions[group.cursor++];
        const questionRef = `${group.paper.slug}/${question.id}`;
        const questionFingerprint = fingerprint(question);
        if (
          usedQuestionRefs.has(questionRef) ||
          usedSupplementFingerprints.has(questionFingerprint) ||
          targetFingerprints.has(questionFingerprint)
        ) {
          continue;
        }

        usedQuestionRefs.add(questionRef);
        usedSupplementFingerprints.add(questionFingerprint);
        targetFingerprints.add(questionFingerprint);
        selected.push({ paperSlug: group.paper.slug, questionId: question.id });
        madeProgress = true;
        break;
      }
      if (selected.length === needed) break;
    }

    if (!madeProgress) {
      for (const question of selected) {
        usedQuestionRefs.delete(`${question.paperSlug}/${question.questionId}`);
        const source = papersBySlug.get(question.paperSlug);
        const sourceQuestion = source?.questions.find((item) => item.id === question.questionId);
        if (sourceQuestion) usedSupplementFingerprints.delete(fingerprint(sourceQuestion));
      }
      unfilled.push({
        slug: target.slug,
        subject: target.subject,
        baseQuestionCount: target.questions.length,
        missingCount: needed - selected.length,
      });
      selected.length = 0;
      break;
    }
  }

  if (selected.length === needed) {
    compositions[target.slug] = {
      baseQuestionCount: target.questions.length,
      questionCount: 50,
      questions: selected,
    };
  }
}

const manifest = {
  version: 1,
  generatedAt: "source-data",
  targetQuestionCount: 50,
  papers: compositions,
  unfilled,
};

writeFileSync(OUTPUT_FILE, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
for (const rawSummary of index.papers ?? []) {
  const composition = compositions[rawSummary.slug];
  if (!composition) continue;
  rawSummary.rankedQuestionCount = composition.questionCount;
  rawSummary.rankedDurationMinutes = calculateMockDuration(
    composition.questionCount,
    rawSummary.subject?.name ?? "CUET",
  ).durationMinutes;
}
writeFileSync(INDEX_FILE, `${JSON.stringify(index, null, 2)}\n`, "utf8");

const addedQuestions = Object.values(compositions).reduce(
  (sum, paper) => sum + paper.questions.length,
  0,
);
console.log(`Generated ${Object.keys(compositions).length} PYQ compositions with ${addedQuestions} sourced questions.`);
for (const paper of unfilled) {
  console.warn(
    `Could not complete ${paper.slug}: no distinct same-subject PYQ source for ${paper.missingCount} question(s).`,
  );
}
