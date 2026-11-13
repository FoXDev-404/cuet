import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const compositions = JSON.parse(
  readFileSync(join(root, "src/data/local-papers/pyq-compositions.json"), "utf8"),
) as {
  targetQuestionCount: number;
  papers: Record<
    string,
    {
      baseQuestionCount: number;
      questionCount: number;
      questions: { paperSlug: string; questionId: string }[];
    }
  >;
};
const paperIndex = JSON.parse(
  readFileSync(join(root, "src/data/local-papers/index.json"), "utf8"),
) as { papers: { slug: string; subject: { slug: string } }[] };

describe("generated PYQ compositions", () => {
  it("completes each mapped ranked paper to the configured question count", () => {
    expect(Object.keys(compositions.papers).length).toBeGreaterThan(0);
    for (const [slug, composition] of Object.entries(compositions.papers)) {
      expect(composition.baseQuestionCount + composition.questions.length, slug).toBe(
        compositions.targetQuestionCount,
      );
      expect(composition.questionCount, slug).toBe(compositions.targetQuestionCount);
      expect(composition.questions.length, slug).toBeGreaterThan(0);
    }
  });

  it("uses distinct source-paper questions from the same subject", () => {
    const subjects = new Map(paperIndex.papers.map((paper) => [paper.slug, paper.subject.slug]));
    const usedQuestions = new Set<string>();

    for (const [targetSlug, composition] of Object.entries(compositions.papers)) {
      for (const question of composition.questions) {
        expect(question.paperSlug, targetSlug).not.toBe(targetSlug);
        expect(subjects.get(question.paperSlug), question.paperSlug).toBe(subjects.get(targetSlug));
        const reference = `${question.paperSlug}/${question.questionId}`;
        expect(usedQuestions.has(reference), reference).toBe(false);
        usedQuestions.add(reference);
      }
    }
  });
});
