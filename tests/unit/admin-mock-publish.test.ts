import { beforeEach, describe, expect, it, vi } from "vitest";

const { all, first, run } = vi.hoisted(() => ({
  all: vi.fn(),
  first: vi.fn(),
  run: vi.fn(),
}));

vi.mock("../../src/lib/db", () => ({ all, first, run }));

import { publishMockVersion } from "../../src/lib/admin/mocks";

const VERSION = {
  id: 10,
  mock_id: 1,
  version_no: 1,
  duration_min: 60,
  total_marks: 250,
  marking_scheme: '{"correct":5,"wrong":-1,"skipped":0}',
  instructions: null,
  status: "draft",
  published_at: null,
  created_by: 1,
  created_at: "2026-11-20T00:00:00.000Z",
};

function link(questionId: number) {
  return { question_id: questionId, section: "English", position: questionId };
}

function validationRow(questionId: number) {
  return {
    id: questionId,
    status: "published",
    explanation: "This is the reason the answer is correct.",
    options: JSON.stringify([
      { text: "Option A", image_url: null, alt: null },
      { text: "Option B", image_url: null, alt: null },
      { text: "Option C", image_url: null, alt: null },
      { text: "Option D", image_url: null, alt: null },
    ]),
    correct_option: 0,
    text: `Question number ${questionId}`,
    image_url: null,
    image_alt: null,
    explanation_image_url: null,
    explanation_image_alt: null,
    passage_image_url: null,
    passage_image_alt: null,
  };
}

function mockDatabase(questionCount: number) {
  const links = Array.from({ length: questionCount }, (_, index) => link(index + 1));
  all.mockImplementation(async (sql: string) => {
    if (sql.includes("FROM mock_questions")) return links;
    if (sql.includes("FROM questions q")) {
      return links.map((row) => validationRow(row.question_id));
    }
    return [];
  });
}

describe("publishMockVersion question count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    first.mockResolvedValue(VERSION);
    run.mockResolvedValue({});
  });

  it("refuses to publish a version with fewer than 50 questions", async () => {
    mockDatabase(5);

    await expect(publishMockVersion(1, 10)).rejects.toThrow(
      "exactly 50 questions",
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses to publish a version with more than 50 questions", async () => {
    mockDatabase(51);

    await expect(publishMockVersion(1, 10)).rejects.toThrow(
      "exactly 50 questions",
    );
    expect(run).not.toHaveBeenCalled();
  });

  it("publishes a version with exactly 50 questions", async () => {
    mockDatabase(50);

    await expect(publishMockVersion(1, 10)).resolves.toBeUndefined();
    expect(run).toHaveBeenCalledTimes(3);
  });
});
