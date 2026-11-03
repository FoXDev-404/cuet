import { describe, expect, it } from "vitest";
import { buildSubjectStats } from "../../src/lib/subject-stats-core";

const subjects = [
  {
    id: 1,
    name: "Biology",
    slug: "biology",
    type: "domain",
    exam_name: "CUET UG",
    exam_slug: "cuet-ug",
  },
  {
    id: 2,
    name: "English",
    slug: "english",
    type: "language",
    exam_name: "CUET UG",
    exam_slug: "cuet-ug",
  },
  {
    id: 3,
    name: "Fine Arts",
    slug: "fine-arts",
    type: "domain",
    exam_name: "CUET UG",
    exam_slug: "cuet-ug",
  },
];

describe("buildSubjectStats", () => {
  it("counts distinct questions and mocks without double counting", () => {
    const rows = buildSubjectStats(
      subjects,
      [
        { subject_id: 1, question_count: 10 },
        { subject_id: 2, question_count: 4 },
      ],
      [
        // Question 100 appears in two mocks: it must count once.
        { mock_id: 10, question_id: 100, subject_id: 1, practice: 0 },
        { mock_id: 11, question_id: 100, subject_id: 1, practice: 0 },
        { mock_id: 11, question_id: 101, subject_id: 1, practice: 0 },
        // A practice paper's questions are tracked separately.
        { mock_id: 20, question_id: 200, subject_id: 2, practice: 1 },
        { mock_id: 20, question_id: 201, subject_id: 2, practice: 1 },
      ],
      [
        { id: 10, subject_id: null, practice: 0 },
        { id: 11, subject_id: 1, practice: 0 },
        { id: 20, subject_id: 2, practice: 1 },
      ],
    );

    const biology = rows.find((row) => row.slug === "biology")!;
    expect(biology.published_question_count).toBe(10);
    expect(biology.bank_question_count).toBe(2);
    expect(biology.all_mock_question_count).toBe(2);
    expect(biology.question_mock_count).toBe(2);
    expect(biology.direct_mock_count).toBe(1);
    expect(biology.mock_count).toBe(2);
    expect(biology.all_mock_count).toBe(2);

    const english = rows.find((row) => row.slug === "english")!;
    expect(english.published_question_count).toBe(4);
    expect(english.bank_question_count).toBe(0);
    expect(english.all_mock_question_count).toBe(2);
    expect(english.question_mock_count).toBe(0);
    expect(english.mock_count).toBe(0);
    expect(english.all_mock_count).toBe(1);

    const fineArts = rows.find((row) => row.slug === "fine-arts")!;
    expect(fineArts.published_question_count).toBe(0);
    expect(fineArts.bank_question_count).toBe(0);
    expect(fineArts.mock_count).toBe(0);
  });

  it("keeps a subject whose only mock points at it directly", () => {
    const rows = buildSubjectStats(
      [subjects[2]],
      [],
      [],
      [{ id: 30, subject_id: 3, practice: 0 }],
    );
    expect(rows[0].direct_mock_count).toBe(1);
    expect(rows[0].question_mock_count).toBe(0);
    expect(rows[0].mock_count).toBe(1);
    expect(rows[0].all_mock_count).toBe(1);
  });
});
