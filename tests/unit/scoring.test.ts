import { describe, expect, it } from "vitest";
import { scoreAttempt } from "../../src/lib/scoring";

const marking = { correct: 4, wrong: -1, skipped: 0 };
const questions = [
  { id: 1, subject_id: 10, correct_option: 1 },
  { id: 2, subject_id: 10, correct_option: 2 },
  { id: 3, subject_id: 20, correct_option: 0 },
  { id: 4, subject_id: 20, correct_option: 3 },
];

describe("scoreAttempt", () => {
  it("scores correct, wrong and skipped answers with negative marking", () => {
    const result = scoreAttempt(
      questions,
      [
        { question_id: 1, selected: 1, time_spent_sec: 30 },
        { question_id: 2, selected: 0, time_spent_sec: 20 },
        { question_id: 3, selected: null, time_spent_sec: 5 },
      ],
      marking,
    );

    expect(result.score).toBe(3);
    expect(result.correct).toBe(1);
    expect(result.wrong).toBe(1);
    expect(result.skipped).toBe(2);
    expect(result.correctness.get(1)).toBe(1);
    expect(result.correctness.get(2)).toBe(0);
    expect(result.correctness.get(3)).toBeNull();
    expect(result.correctness.get(4)).toBeNull();
  });

  it("groups totals by subject and keeps per-question time", () => {
    const result = scoreAttempt(
      questions,
      [
        { question_id: 1, selected: 1, time_spent_sec: 30 },
        { question_id: 2, selected: 2, time_spent_sec: 50 },
        { question_id: 3, selected: 1, time_spent_sec: 10 },
      ],
      marking,
    );

    const language = result.subjectStats.get(10);
    expect(language).toEqual({ attempted: 2, correct: 2, time: 80, answered: 2 });
    const domain = result.subjectStats.get(20);
    expect(domain).toEqual({ attempted: 2, correct: 0, time: 10, answered: 1 });
  });

  it("aggregates topic-level stats only for real topic rows", () => {
    const withTopics = [
      { id: 1, subject_id: 10, topic_id: 100, correct_option: 1 },
      { id: 2, subject_id: 10, topic_id: 100, correct_option: 2 },
      { id: 3, subject_id: 10, topic_id: 101, correct_option: 0 },
      { id: 4, subject_id: 10, topic_id: null, correct_option: 0 },
    ];
    const result = scoreAttempt(
      withTopics,
      [
        { question_id: 1, selected: 1, time_spent_sec: 12 },
        { question_id: 2, selected: 0, time_spent_sec: 18 },
        { question_id: 3, selected: 0, time_spent_sec: 5 },
        { question_id: 4, selected: null, time_spent_sec: 3 },
      ],
      marking,
    );

    expect(result.topicStats.get("10:100")).toEqual({
      subject_id: 10,
      topic_id: 100,
      attempted: 2,
      correct: 1,
      time: 30,
      answered: 2,
    });
    expect(result.topicStats.get("10:101")).toEqual({
      subject_id: 10,
      topic_id: 101,
      attempted: 1,
      correct: 1,
      time: 5,
      answered: 1,
    });
    expect(result.topicStats.has("10:0")).toBe(false);
    expect(result.subjectStats.get(10)).toMatchObject({ attempted: 4, correct: 2, answered: 3 });
  });

  it("allows a negative total and ignores answers outside the paper", () => {
    const result = scoreAttempt(
      questions.slice(0, 2),
      [
        { question_id: 1, selected: 0, time_spent_sec: 0 },
        { question_id: 2, selected: 0, time_spent_sec: 0 },
        { question_id: 999, selected: 1, time_spent_sec: 500 },
      ],
      marking,
    );

    expect(result.score).toBe(-2);
    expect(result.correct).toBe(0);
    expect(result.wrong).toBe(2);
    expect(result.skipped).toBe(0);
    expect(result.subjectStats.get(10)?.attempted).toBe(2);
  });

  it("treats an empty paper as a zero score", () => {
    const result = scoreAttempt([], [], marking);
    expect(result).toMatchObject({ score: 0, correct: 0, wrong: 0, skipped: 0 });
    expect(result.correctness.size).toBe(0);
    expect(result.subjectStats.size).toBe(0);
  });

  it("honours a custom positive/zero marking scheme", () => {
    const result = scoreAttempt(
      questions.slice(0, 2),
      [
        { question_id: 1, selected: 1, time_spent_sec: 0 },
        { question_id: 2, selected: 0, time_spent_sec: 0 },
      ],
      { correct: 5, wrong: 0, skipped: 0 },
    );
    expect(result.score).toBe(5);
    expect(result.wrong).toBe(1);
  });

  it("supports dynamic schemes: zero negative marking (+4 / 0 / 0)", () => {
    const result = scoreAttempt(
      questions,
      [
        { question_id: 1, selected: 1, time_spent_sec: 10 }, // correct (+4)
        { question_id: 2, selected: 0, time_spent_sec: 10 }, // wrong (0)
        { question_id: 3, selected: null, time_spent_sec: 0 }, // skipped (0)
        { question_id: 4, selected: 3, time_spent_sec: 10 }, // correct (+4)
      ],
      { correct: 4, wrong: 0, skipped: 0 },
    );
    expect(result.score).toBe(8);
    expect(result.correct).toBe(2);
    expect(result.wrong).toBe(1);
    expect(result.skipped).toBe(1);
  });

  it("supports dynamic schemes: custom values (+10 / -2 / -1)", () => {
    const result = scoreAttempt(
      questions,
      [
        { question_id: 1, selected: 1, time_spent_sec: 10 }, // correct (+10)
        { question_id: 2, selected: 0, time_spent_sec: 10 }, // wrong (-2)
        { question_id: 3, selected: null, time_spent_sec: 0 }, // skipped (-1)
        { question_id: 4, selected: 0, time_spent_sec: 10 }, // wrong (-2)
      ],
      { correct: 10, wrong: -2, skipped: -1 },
    );
    // 10 - 2 - 1 - 2 = 5
    expect(result.score).toBe(5);
    expect(result.correct).toBe(1);
    expect(result.wrong).toBe(2);
    expect(result.skipped).toBe(1);
  });

  it("supports per-section marking schemes across sections", () => {
    const multiSectionQuestions = [
      { id: 1, subject_id: 10, section: "Section A", correct_option: 1 },
      { id: 2, subject_id: 10, section: "Section A", correct_option: 2 },
      { id: 3, subject_id: 20, section: "Section B", correct_option: 0 },
      { id: 4, subject_id: 20, section: "Section B", correct_option: 3 },
    ];
    const perSectionScheme = {
      correct: 5,
      wrong: -1,
      skipped: 0,
      sections: {
        "Section A": { correct: 5, wrong: -1, skipped: 0 },
        "Section B": { correct: 2, wrong: 0, skipped: 0 }, // No negative marking in Section B
      },
    };
    const result = scoreAttempt(
      multiSectionQuestions,
      [
        { question_id: 1, selected: 1, time_spent_sec: 10 }, // Sec A correct (+5)
        { question_id: 2, selected: 0, time_spent_sec: 10 }, // Sec A wrong (-1)
        { question_id: 3, selected: 1, time_spent_sec: 10 }, // Sec B wrong (0)
        { question_id: 4, selected: 3, time_spent_sec: 10 }, // Sec B correct (+2)
      ],
      perSectionScheme,
    );
    // 5 - 1 + 0 + 2 = 6
    expect(result.score).toBe(6);
    expect(result.correct).toBe(2);
    expect(result.wrong).toBe(2);
  });

  it("golden test: existing attempt scores remain exactly unchanged under standard CUET scheme", () => {
    const standardScheme = { correct: 5, wrong: -1, skipped: 0 };
    // 35 correct, 10 wrong, 5 skipped
    const goldenQuestions = Array.from({ length: 50 }, (_, i) => ({
      id: i + 1,
      subject_id: 1,
      correct_option: 1,
    }));
    const goldenAnswers = Array.from({ length: 50 }, (_, i) => {
      if (i < 35) return { question_id: i + 1, selected: 1, time_spent_sec: 30 };
      if (i < 45) return { question_id: i + 1, selected: 0, time_spent_sec: 20 };
      return { question_id: i + 1, selected: null, time_spent_sec: 0 };
    });

    const result = scoreAttempt(goldenQuestions, goldenAnswers, standardScheme);
    // 35 * 5 - 10 * 1 = 175 - 10 = 165
    expect(result.score).toBe(165);
    expect(result.correct).toBe(35);
    expect(result.wrong).toBe(10);
    expect(result.skipped).toBe(5);
  });
});
