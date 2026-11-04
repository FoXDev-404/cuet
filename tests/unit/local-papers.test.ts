import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  getLocalPaper,
  getLocalPaperSummary,
  getLocalPaperTakeData,
  getLocalPapers,
  getLocalPapersForSubject,
  getLocalPapersForYear,
  getLocalPaperYears,
  getLocalSubjectSummaries,
  getLocalSubjectSummary,
  getPopularLocalPapers,
  gradeLocalPaper,
  isLocalPaperSlug,
  localPaperPath,
} from "../../src/lib/local-papers";
import { setPracticeLibraryStore, usePracticeLibrary } from "../../src/lib/practice-library";
import {
  buildPaper,
  buildSummary,
  createStoredKeys,
  type LocalPaperSummary,
  type RawIndexPaper,
  type RawKeyBundle,
  type RawPaper,
} from "../../src/lib/practice-normalize";
import {
  mapIndexRow,
  mapPaperRow,
  type PaperIndexRow,
  type PaperRow,
  type PassageRow,
  type QuestionRow,
} from "../../src/lib/practice-store-rows";

const PUBLIC_ROOT = fileURLToPath(new URL("../../public", import.meta.url));
const KEYS_FILE = fileURLToPath(new URL("../../src/data/local-papers/keys.json", import.meta.url));
const INDEX_FILE = fileURLToPath(new URL("../../src/data/local-papers/index.json", import.meta.url));
const KEYED_SLUG = "physics-2025-05-20-shift-2";
const SCANNED_SLUG = "general-test-2025-05-20-shift-1";

function assetFile(path: string): string {
  return `${PUBLIC_ROOT}${path.replace(/^\/+/, "/")}`;
}

function readPaper(slug: string): RawPaper {
  return JSON.parse(
    readFileSync(assetFile(`/local-papers/papers/${slug}.json`), "utf8"),
  ) as RawPaper;
}

const INDEX_DATA = JSON.parse(readFileSync(INDEX_FILE, "utf8")) as { papers?: RawIndexPaper[] };
const SUMMARIES = (INDEX_DATA.papers ?? [])
  .map(buildSummary)
  .filter((summary): summary is LocalPaperSummary => summary !== null);
const STORED_KEYS = createStoredKeys(
  JSON.parse(readFileSync(KEYS_FILE, "utf8")) as RawKeyBundle,
);

// Inject the JSON seed as the store, mirroring what D1 serves in production.
setPracticeLibraryStore({
  loadIndex: async () => SUMMARIES,
  loadPaper: async (slug) => {
    const summary = SUMMARIES.find((paper) => paper.slug === slug);
    if (!summary) return null;
    try {
      return buildPaper(readPaper(slug), summary, STORED_KEYS.get(slug));
    } catch {
      return null;
    }
  },
});
usePracticeLibrary(SUMMARIES);

describe("local previous-year library", () => {
  it("loads the generated index with unique slugs and usable summaries", () => {
    const papers = getLocalPapers();
    expect(papers.length).toBeGreaterThan(100);
    const slugs = papers.map((paper) => paper.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    const descriptions = papers.map((paper) => paper.metaDescription);
    expect(new Set(descriptions).size).toBe(descriptions.length);
    for (const paper of papers) {
      expect(paper.year).toBeGreaterThanOrEqual(2021);
      expect(paper.subject.name.length).toBeGreaterThan(0);
      expect(paper.recoveredQuestionCount).toBeGreaterThan(0);
      expect(paper.scorableQuestionCount).toBeLessThanOrEqual(paper.recoveredQuestionCount);
      expect(paper.metaDescription.length).toBeGreaterThan(50);
      expect(paper.path).toBe(`/practice/${paper.slug}`);
      expect(paper.localPaper && paper.draft).toBe(true);
    }
  });

  it("filters by year and resolves paths", () => {
    const papers = getLocalPapers();
    const years = getLocalPaperYears();
    expect(years.reduce((sum, entry) => sum + entry.paper_count, 0)).toBe(papers.length);
    for (const entry of years) {
      expect(getLocalPapersForYear(entry.year)).toHaveLength(entry.paper_count);
    }
    const first = papers[0];
    expect(localPaperPath(first.slug)).toBe(`/practice/${first.slug}`);
    expect(isLocalPaperSlug(first.slug)).toBe(true);
    expect(isLocalPaperSlug("missing-paper")).toBe(false);
    expect(getLocalPaperSummary("missing-paper")).toBeNull();
  });

  it("loads every paper and finds every referenced crop on disk", async () => {
    for (const summary of getLocalPapers()) {
      const take = await getLocalPaperTakeData(summary.slug);
      expect(take, summary.slug).not.toBeNull();
      expect(take!.questions.length, summary.slug).toBeGreaterThan(0);
      for (const question of take!.questions) {
        expect(question.options.length, `${summary.slug} q${question.number}`).toBeGreaterThanOrEqual(2);
        for (const asset of question.assets) {
          expect(existsSync(assetFile(asset.path)), `${summary.slug} ${asset.path}`).toBe(true);
        }
        if (question.bodyIsImage) {
          expect(question.assets.some((asset) => asset.kind === "question")).toBe(true);
        }
      }
    }
  }, 60_000);

  it("never exposes answer keys or explanations in the take payload", async () => {
    const take = await getLocalPaperTakeData(KEYED_SLUG);
    expect(take).not.toBeNull();
    const serialized = JSON.stringify(take);
    expect(serialized).not.toContain("correctAnswer");
    expect(serialized).not.toContain("correctOption");
    expect(serialized).not.toContain("explanation");
    for (const question of take?.questions ?? []) {
      expect(question).toHaveProperty("optionsAreImages");
      expect(question).toHaveProperty("bodyIsImage");
      expect(Object.keys(question)).not.toContain("correctAnswer");
    }
  });

  it("keeps recovered scanned bodies as text with their exact crops", async () => {
    const take = await getLocalPaperTakeData(SCANNED_SLUG);
    const figureQuestion = take?.questions.find((question) => question.number === 8);
    const imageOptionsQuestion = take?.questions.find((question) => question.number === 33);
    expect(figureQuestion?.stemEn).toContain("How many triangles");
    expect(figureQuestion?.assets.some((asset) => asset.kind === "figure")).toBe(true);
    expect(imageOptionsQuestion?.stemEn).toContain("embedded");
    expect(imageOptionsQuestion?.assets.some((asset) => asset.kind === "figure")).toBe(true);
    expect(imageOptionsQuestion?.assets.some((asset) => asset.kind === "options")).toBe(true);
    expect(imageOptionsQuestion?.options.map((option) => option.id)).toEqual(["A", "B", "C", "D"]);
  });

  it("keeps answer keys out of the publicly served paper JSON", () => {
    const paperFile = assetFile(`/local-papers/papers/${KEYED_SLUG}.json`);
    const payload = JSON.parse(readFileSync(paperFile, "utf8")) as {
      exam?: { questions?: { correctAnswer?: string | null; explanationEn?: string | null }[] };
    };
    const questions = payload.exam?.questions ?? [];
    const summary = getLocalPaperSummary(KEYED_SLUG);
    expect(summary).not.toBeNull();
    expect(questions.length).toBe(summary!.recoveredQuestionCount);
    for (const question of questions) {
      expect(question.correctAnswer).toBeNull();
      expect(question.explanationEn).toBeNull();
    }
    const keys = JSON.parse(readFileSync(KEYS_FILE, "utf8")) as {
      papers?: Record<string, Record<string, unknown>>;
    };
    expect(Object.keys(keys.papers?.[KEYED_SLUG] ?? {}).length).toBe(summary!.scorableQuestionCount);
  });
});

describe("gradeLocalPaper", () => {
  it("scores a submitted answer server-side and returns the key only after submit", async () => {
    const paper = await getLocalPaper(KEYED_SLUG);
    expect(paper).not.toBeNull();
    const scorable = paper!.questions.find((question) => question.scorable);
    expect(scorable).toBeTruthy();
    const correct = scorable!.correctAnswer!;
    const wrong = scorable!.options.find((option) => option.id !== correct)!.id;

    const result = await gradeLocalPaper(KEYED_SLUG, [
      { questionId: scorable!.id, selectedOption: correct },
    ]);
    expect(result).not.toBeNull();
    expect(result?.localOnly).toBe(true);
    expect(result?.ranked).toBe(false);
    expect(result?.total).toBe(paper!.questions.length);
    expect(result?.maxScore).toBe(paper!.scorableQuestionCount * 5);
    expect(result?.attempted).toBe(1);
    expect(result?.correct).toBe(1);
    expect(result?.score).toBe(5);
    expect(result?.review.find((item) => item.questionId === scorable!.id)).toMatchObject({
      selectedOption: correct,
      status: "correct",
      correctOption: correct,
    });

    const wrongResult = await gradeLocalPaper(KEYED_SLUG, [
      { questionId: scorable!.id, selectedOption: wrong },
    ]);
    expect(wrongResult?.incorrect).toBe(1);
    expect(wrongResult?.score).toBe(-1);
  });

  it("treats an invalid option id as unattempted", async () => {
    const paper = await getLocalPaper(KEYED_SLUG);
    const scorable = paper!.questions.find((question) => question.scorable)!;
    const result = await gradeLocalPaper(KEYED_SLUG, [
      { questionId: scorable.id, selectedOption: "Z" },
    ]);
    expect(result?.attempted).toBe(0);
    expect(result?.incorrect).toBe(0);
    expect(result?.score).toBe(0);
    expect(result?.review.find((item) => item.questionId === scorable.id)?.status).toBe("unattempted");
  });

  it("keeps questions without a matched key pending and unscored", async () => {
    const paper = await getLocalPaper(KEYED_SLUG);
    const pending = paper!.questions.find((question) => !question.scorable);
    expect(pending).toBeTruthy();
    const result = await gradeLocalPaper(KEYED_SLUG, [
      { questionId: pending!.id, selectedOption: pending!.options[0].id },
    ]);
    expect(result?.review.find((item) => item.questionId === pending!.id)).toMatchObject({
      status: "pending",
      correctOption: null,
      scorable: false,
    });
  });

  it("returns an empty, unattempted result for a blank submission", async () => {
    const paper = await getLocalPaper(KEYED_SLUG);
    const result = await gradeLocalPaper(KEYED_SLUG, []);
    expect(result).not.toBeNull();
    expect(result?.score).toBe(0);
    expect(result?.attempted).toBe(0);
    expect(result?.unattempted).toBe(paper!.questions.length);
    expect(result?.pending).toBe(paper!.questions.filter((question) => !question.scorable).length);
  });

  it("rejects an unknown paper slug", async () => {
    await expect(gradeLocalPaper("missing-paper", [])).resolves.toBeNull();
  });
});

describe("homepage curation", () => {
  it("prefers fully keyed papers, then the newest papers", () => {
    const popular = getPopularLocalPapers(12);
    expect(popular).toHaveLength(12);
    expect(new Set(popular.map((paper) => paper.slug)).size).toBe(12);

    const firstPendingIndex = popular.findIndex((paper) => paper.pendingReviewCount > 0);
    if (firstPendingIndex !== -1) {
      expect(popular.slice(firstPendingIndex).every((paper) => paper.pendingReviewCount > 0)).toBe(true);
    }

    const keyed = popular.filter((paper) => paper.pendingReviewCount === 0);
    for (let i = 1; i < keyed.length; i += 1) {
      expect(keyed[i - 1].year).toBeGreaterThanOrEqual(keyed[i].year);
    }
  });

  it("is deterministic and returns detached copies", () => {
    const first = getPopularLocalPapers(6);
    const second = getPopularLocalPapers(6);
    expect(second.map((paper) => paper.slug)).toEqual(first.map((paper) => paper.slug));

    first[0].title = "mutated";
    first[0].markingScheme.correct = 99;
    const reloaded = getPopularLocalPapers(6)[0];
    expect(reloaded.title).not.toBe("mutated");
    expect(reloaded.markingScheme.correct).not.toBe(99);
  });

  it("honours a zero or negative limit", () => {
    expect(getPopularLocalPapers(0)).toEqual([]);
    expect(getPopularLocalPapers(-3)).toEqual([]);
  });

  it("rolls papers up by subject and links to the latest year", () => {
    const papers = getLocalPapers();
    const subjects = getLocalSubjectSummaries();
    expect(subjects.length).toBeGreaterThan(0);
    expect(subjects.reduce((sum, subject) => sum + subject.paperCount, 0)).toBe(papers.length);
    expect(subjects.reduce((sum, subject) => sum + subject.questionCount, 0)).toBe(
      papers.reduce((sum, paper) => sum + paper.recoveredQuestionCount, 0),
    );
    expect(subjects.reduce((sum, subject) => sum + subject.pendingReviewCount, 0)).toBe(
      papers.reduce((sum, paper) => sum + paper.pendingReviewCount, 0),
    );

    for (let i = 1; i < subjects.length; i += 1) {
      expect(subjects[i - 1].paperCount).toBeGreaterThanOrEqual(subjects[i].paperCount);
    }

    for (const subject of subjects) {
      const own = papers.filter((paper) => paper.subject.slug === subject.subject.slug);
      expect(own).toHaveLength(subject.paperCount);
      const latestYear = Math.max(...own.map((paper) => paper.year));
      expect(subject.latestYear).toBe(latestYear);
      expect(subject.href).toBe(`/pyq/${latestYear}/${subject.subject.slug}`);
      expect(subject.latestPaperPath.startsWith("/practice/")).toBe(true);
    }
  });

  it("resolves a single subject rollup and returns detached copies", () => {
    const summary = getLocalSubjectSummary("english");
    expect(summary).not.toBeNull();

    const own = getLocalPapersForSubject("english");
    expect(summary!.paperCount).toBe(own.length);
    expect(summary!.questionCount).toBe(
      own.reduce((total, paper) => total + paper.recoveredQuestionCount, 0),
    );
    expect(summary!.scorableQuestionCount).toBe(
      own.reduce((total, paper) => total + paper.scorableQuestionCount, 0),
    );

    summary!.questionCount = -1;
    summary!.subject.name = "mutated";
    expect(getLocalSubjectSummary("english")!.questionCount).not.toBe(-1);
    expect(getLocalSubjectSummary("english")!.subject.name).not.toBe("mutated");
    expect(getLocalSubjectSummary("missing-subject")).toBeNull();
  });
});

describe("D1 practice row mapping", () => {
  function rowsFor(summary: LocalPaperSummary) {
    const raw = readPaper(summary.slug);
    const paper = buildPaper(raw, summary, STORED_KEYS.get(summary.slug));
    expect(paper, summary.slug).not.toBeNull();

    const paperRow: PaperRow = {
      slug: paper!.slug,
      title: paper!.title,
      meta_description: summary.metaDescription,
      year: paper!.year,
      exam_date: paper!.date,
      date_label: paper!.dateLabel,
      shift: paper!.shift,
      duration_min: paper!.durationMinutes,
      source_file: paper!.sourceFile,
      source_method: paper!.sourceMethod,
      source_question_count: paper!.sourceQuestionCount,
      publication_status: paper!.publicationStatus,
      review_required: paper!.reviewRequired ? 1 : 0,
      subject_name: paper!.subject.name,
      subject_slug: paper!.subject.slug,
      subject_code: paper!.subject.code,
    };

    const passages: PassageRow[] = [];
    const seen = new Set<string>();
    for (const question of paper!.questions) {
      if (!question.passage || seen.has(question.passage.id)) continue;
      seen.add(question.passage.id);
      passages.push({
        passage_key: question.passage.id,
        title: question.passage.title,
        body: question.passage.content,
      });
    }

    const questions: QuestionRow[] = paper!.questions.map((question, position) => ({
      question_key: question.id,
      source_question_no: question.number,
      position: position + 1,
      stem: question.stemEn,
      options_json: JSON.stringify(question.options),
      options_are_images: question.optionsAreImages ? 1 : 0,
      correct_option: question.correctAnswer,
      explanation: question.explanation,
      passage_key: question.passage?.id ?? null,
      match_list_json: question.matchList ? JSON.stringify(question.matchList) : null,
      arrangement_json: JSON.stringify(question.arrangementItems),
      assets_json: JSON.stringify(question.assets),
      review_flags_json: JSON.stringify(question.reviewFlags),
    }));

    const indexRow: PaperIndexRow = {
      ...paperRow,
      question_count: questions.length,
      scorable_count: questions.filter((question) => question.correct_option !== null).length,
      image_question_count: paper!.questions.filter((question) => question.assets.length > 0).length,
      asset_count: paper!.questions.reduce((total, question) => total + question.assets.length, 0),
    };

    return { raw, paper: paper!, paperRow, passages, questions, indexRow };
  }

  it("maps every imported paper back to the exact JSON-seed result", () => {
    for (const summary of SUMMARIES) {
      const { paper, paperRow, passages, questions } = rowsFor(summary);
      const mapped = mapPaperRow(paperRow, passages, questions);
      expect(mapped, summary.slug).toEqual(paper);
    }
  }, 30_000);

  it("derives index counts that match the generated index seed", () => {
    for (const summary of SUMMARIES) {
      const { indexRow } = rowsFor(summary);
      const mapped = mapIndexRow(indexRow);
      expect(mapped, summary.slug).toEqual(summary);
    }
  });
});
