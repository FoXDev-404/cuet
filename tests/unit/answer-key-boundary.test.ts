import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * Answer-key boundary regression test.
 *
 * Public paper JSON (served from /local-papers/papers/*.json) must never carry
 * an answer key or explanation: those are server-only and live in
 * src/data/local-papers/keys.json (and, in production, D1). This test guards the
 * whole 245-paper library so a single re-imported or hand-edited paper cannot
 * re-leak keys to the client.
 */

const PAPERS_DIR = fileURLToPath(new URL("../../public/local-papers/papers", import.meta.url));
const KEYS_FILE = fileURLToPath(new URL("../../src/data/local-papers/keys.json", import.meta.url));
const INDEX_FILE = fileURLToPath(new URL("../../src/data/local-papers/index.json", import.meta.url));

const ANSWER_OPTIONS = new Set(["A", "B", "C", "D"]);
const EXPECTED_TOTAL_QUESTIONS = 7_527;

interface RawQuestion {
  id?: string;
  optionsEn?: Array<{ id?: string } | null> | null;
  correctAnswer?: string | null;
  explanationEn?: string | null;
}

interface RawPaperExam {
  slug?: string;
  questionCount?: number;
  questions?: RawQuestion[];
}

interface RawPaperFile {
  exam?: RawPaperExam;
}

interface RawKeyEntry {
  a?: string | null;
  e?: string | null;
}

interface RawKeysFile {
  papers?: Record<string, Record<string, RawKeyEntry>>;
}

interface RawIndexRow {
  slug?: string;
  questionCount?: number;
}

interface RawIndexFile {
  papers?: RawIndexRow[];
}

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

function collectProblems(problems: string[]): string {
  return problems.length > 0 ? `\n${problems.slice(0, 40).join("\n")}` : "";
}

const PAPER_SLUGS = readdirSync(PAPERS_DIR)
  .filter((name) => name.endsWith(".json"))
  .map((name) => name.slice(0, -".json".length))
  .sort();

const PAPERS = new Map<string, RawPaperFile>(
  PAPER_SLUGS.map((slug) => [slug, loadJson<RawPaperFile>(`${PAPERS_DIR}/${slug}.json`)]),
);
const KEYS = loadJson<RawKeysFile>(KEYS_FILE).papers ?? {};
const INDEX_ROWS = loadJson<RawIndexFile>(INDEX_FILE).papers ?? [];

function questionsOf(slug: string): RawQuestion[] {
  return PAPERS.get(slug)?.exam?.questions ?? [];
}

describe("answer-key boundary", () => {
  it("loads the full public paper library", () => {
    expect(PAPER_SLUGS.length).toBeGreaterThan(0);
    expect(INDEX_ROWS.length).toBe(PAPER_SLUGS.length);
    expect(Object.keys(KEYS).length).toBe(PAPER_SLUGS.length);
    expect(INDEX_ROWS.reduce((sum, row) => sum + (row.questionCount ?? 0), 0)).toBe(
      EXPECTED_TOTAL_QUESTIONS,
    );
  });

  it("never exposes correctAnswer or explanationEn in public paper JSON", () => {
    const problems: string[] = [];
    for (const slug of PAPER_SLUGS) {
      for (const question of questionsOf(slug)) {
        const qid = question.id ?? "(no id)";
        if (question.correctAnswer !== null) {
          problems.push(`${slug} ${qid}: public correctAnswer=${JSON.stringify(question.correctAnswer)}`);
        }
        if (question.explanationEn !== null) {
          problems.push(`${slug} ${qid}: public explanationEn is present`);
        }
      }
    }
    expect(problems, collectProblems(problems)).toEqual([]);
  });

  it("keys every question exactly once with a valid option id", () => {
    const problems: string[] = [];
    let keyedQuestions = 0;
    for (const slug of PAPER_SLUGS) {
      const bucket = KEYS[slug];
      if (!bucket) {
        problems.push(`${slug}: no keys.json bucket`);
        continue;
      }
      for (const question of questionsOf(slug)) {
        const qid = question.id ?? "(no id)";
        const entry = bucket[qid];
        if (!entry) {
          problems.push(`${slug} ${qid}: no keys.json entry`);
          continue;
        }
        keyedQuestions += 1;
        const answer = entry.a;
        if (typeof answer !== "string" || !ANSWER_OPTIONS.has(answer)) {
          problems.push(`${slug} ${qid}: invalid keys.json answer ${JSON.stringify(answer)}`);
          continue;
        }
        const optionIds = (question.optionsEn ?? [])
          .map((option) => option?.id)
          .filter((id): id is string => typeof id === "string");
        if (!optionIds.includes(answer)) {
          problems.push(
            `${slug} ${qid}: key ${answer} is not among options [${optionIds.join(", ")}]`,
          );
        }
      }
    }
    expect(problems, collectProblems(problems)).toEqual([]);
    expect(keyedQuestions).toBe(EXPECTED_TOTAL_QUESTIONS);
  });

  it("contains no orphaned keys.json entries", () => {
    const problems: string[] = [];
    const keyedTotal = Object.values(KEYS).reduce(
      (sum, bucket) => sum + Object.keys(bucket).length,
      0,
    );
    for (const [slug, bucket] of Object.entries(KEYS)) {
      if (!PAPERS.has(slug)) {
        problems.push(`${slug}: keys.json bucket has no public paper file`);
        continue;
      }
      const questionIds = new Set(questionsOf(slug).map((question) => question.id));
      for (const qid of Object.keys(bucket)) {
        if (!questionIds.has(qid)) {
          problems.push(`${slug} ${qid}: keys.json entry has no matching paper question`);
        }
      }
    }
    expect(problems, collectProblems(problems)).toEqual([]);
    expect(keyedTotal).toBe(EXPECTED_TOTAL_QUESTIONS);
  });

  it("keeps index.json question counts in sync with the paper JSON", () => {
    const problems: string[] = [];
    const seen = new Set<string>();
    let indexTotal = 0;
    for (const row of INDEX_ROWS) {
      const slug = row.slug ?? "";
      if (!slug) {
        problems.push("index.json row without a slug");
        continue;
      }
      if (seen.has(slug)) problems.push(`${slug}: duplicate index.json row`);
      seen.add(slug);
      const paper = PAPERS.get(slug);
      if (!paper) {
        problems.push(`${slug}: index.json row has no public paper file`);
        continue;
      }
      const questions = questionsOf(slug);
      const questionCount = row.questionCount ?? 0;
      indexTotal += questionCount;
      if (questionCount !== questions.length) {
        problems.push(
          `${slug}: index.questionCount=${questionCount} but paper has ${questions.length} questions`,
        );
      }
      if (paper.exam?.questionCount !== questions.length) {
        problems.push(
          `${slug}: exam.questionCount=${String(paper.exam?.questionCount)} but paper has ${
            questions.length
          } questions`,
        );
      }
    }
    for (const slug of PAPER_SLUGS) {
      if (!seen.has(slug)) problems.push(`${slug}: public paper has no index.json row`);
    }
    expect(problems, collectProblems(problems)).toEqual([]);
    expect(indexTotal).toBe(EXPECTED_TOTAL_QUESTIONS);
  });
});
