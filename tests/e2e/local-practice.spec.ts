import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";
import { executeLocalD1 as localD1, queryLocalD1 } from "../../scripts/lib/local-d1.mjs";

type LocalIndexPaper = {
  slug: string;
  title: string;
  subject: { slug: string; name: string };
  year: number;
  date?: string | null;
  dateLabel: string;
  shift?: string | null;
  questionCount: number;
  scorableQuestionCount: number;
  pendingReviewCount: number;
  durationMinutes: number;
  rankedQuestionCount: number;
  rankedDurationMinutes: number;
};

type LocalIndex = { papers?: LocalIndexPaper[] | null };

const LOCAL_INDEX = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../src/data/local-papers/index.json", import.meta.url)), "utf8"),
) as LocalIndex;

let previousAttemptSetting: string | null = null;
let attemptSettingCaptured = false;

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function localD1Rows<T>(sql: string): T[] {
  return queryLocalD1<T>(sql);
}

/** Enables the live-attempt share button and remembers the original setting. */
function setAttemptShareSetting(value: "true" | "false"): void {
  if (!attemptSettingCaptured) {
    const rows = localD1Rows<{ value: string }>(
      "SELECT value FROM site_settings WHERE key = 'share_question_during_attempt'",
    );
    previousAttemptSetting = rows[0]?.value ?? null;
    attemptSettingCaptured = true;
  }
  localD1(
    `INSERT INTO site_settings (key, value)
     VALUES ('share_question_during_attempt', ${sqlString(value)})
     ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
  );
}

test.afterAll(() => {
  if (!attemptSettingCaptured) return;
  if (previousAttemptSetting === null) {
    localD1("DELETE FROM site_settings WHERE key = 'share_question_during_attempt';");
  } else {
    localD1(
      `INSERT INTO site_settings (key, value) VALUES ('share_question_during_attempt', ${sqlString(previousAttemptSetting)})
       ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
    );
  }
});

function paperBySlug(slug: string): LocalIndexPaper {
  const paper = (LOCAL_INDEX.papers ?? []).find((entry) => entry.slug === slug);
  if (!paper) throw new Error(`Missing local paper fixture: ${slug}`);
  return paper;
}

const SCORED_PAPER = paperBySlug("english-2022-08-06-shift-1");
const DETAIL_PAPER = paperBySlug("biology-2025-05-20-shift-2");
const GENERAL_TEST_PAPERS = [
  paperBySlug("general-test-2025-05-20-shift-1"),
  paperBySlug("general-test-2025-05-20-shift-2"),
  paperBySlug("general-test-2022-08-06"),
];
const INSTRUCTIONS = `/mock/${SCORED_PAPER.slug}/instructions`;
const SCORED_PAPER_PATH = `/cuet-ug-previous-year-question-papers/language-pyqs/${SCORED_PAPER.subject.slug}/${SCORED_PAPER.slug}`;
const DETAIL_PAPER_PATH = `/cuet-ug-previous-year-question-papers/domain-subject-pyqs/${DETAIL_PAPER.subject.slug}/${DETAIL_PAPER.slug}`;

test.beforeEach(async ({ page }) => {
  // Keep repeated local runs out of the shared rate-limit bucket.
  await page.setExtraHTTPHeaders({
    "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
  });
});

async function beginAttempt(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Begin test/ }).click();
  await expect(page).toHaveURL(/\/attempt\/\d+$/);
  await expect(page.locator("#attempt-data")).toBeAttached();
  const questionArea = page.locator("#question-area");
  await expect(questionArea).toHaveAttribute("data-ready", "true");
  await expect(questionArea.locator("[data-option]").first()).toBeVisible();
}

async function submitAttempt(page: Page): Promise<void> {
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#submit-attempt").click();
  await expect(page).toHaveURL(/\/result\/\d+$/);
}

test("practice library stays available and routes into the ranked engine", async ({ page }) => {
  // The unfiltered library is sorted by paper size and paginated, so filter to
  // the fixture paper's year before asserting its row is linked.
  await page.goto("/mock-tests?year=2022");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Practice with previous-year CUET mock tests",
  );
  await expect(page.locator(`a[href="${SCORED_PAPER_PATH}"]`).first()).toBeVisible();

  // The visible label stays "Start"; the paper title is in-flow text so the
  // link has a descriptive inner text for Lighthouse as well as a11y tooling.
  await expect(
    page.locator(`a[href="/mock/${SCORED_PAPER.slug}/instructions"]`).first(),
  ).toContainText(SCORED_PAPER.title);

  await page.goto(SCORED_PAPER_PATH);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "CUET UG English 6 August 2022",
  );
  await expect(page.getByRole("link", { name: /Start Test/ })).toHaveAttribute(
    "href",
    INSTRUCTIONS,
  );
  await expect(page.getByRole("link", { name: "View leaderboard" })).toHaveAttribute(
    "href",
    `/leaderboard/${SCORED_PAPER.slug}`,
  );
});

test("the instructions back link names the paper without a literal dollar sign", async ({
  page,
}) => {
  await page.goto(INSTRUCTIONS);

  await expect(
    page.getByRole("link", { name: `← Back to ${SCORED_PAPER.title}`, exact: true }),
  ).toBeVisible();
});

test("the PYQ archive meta description stays inside the SERP window", async ({ page }) => {
  await page.goto("/cuet-ug-previous-year-question-papers");
  const description = await page.locator('meta[name="description"]').getAttribute("content");
  expect(description).not.toBeNull();
  expect(description!.length).toBeGreaterThanOrEqual(120);
  expect(description!.length).toBeLessThanOrEqual(160);
});

test("the PYQ archive lists language subjects before general aptitude and domain subjects", async ({
  page,
}) => {
  await page.goto("/cuet-ug-previous-year-question-papers");
  await expect(page.locator("h3[id^='pyq-section-']")).toHaveText([
    "Language Subjects",
    "General Aptitude Test",
    "Domain-Specific Subjects",
  ]);
});

test("practice detail reports the scored count when no questions are excluded", async ({
  page,
}) => {
  await page.goto(DETAIL_PAPER_PATH);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "CUET UG Biology 20 May 2025",
  );
  await expect(page.getByText(/not included in the ranked paper/)).toHaveCount(0);
  const scoredCard = page.getByText("in the ranked paper").locator("..");
  await expect(scoredCard).toContainText(String(DETAIL_PAPER.rankedQuestionCount));
  await expect(page.getByRole("link", { name: /Start Test/ })).toHaveAttribute(
    "href",
    `/mock/${DETAIL_PAPER.slug}/instructions`,
  );
  await expect(page.getByRole("link", { name: "All PYQs" })).toHaveAttribute(
    "href",
    "/cuet-ug-previous-year-question-papers",
  );
  // Every generated paper gets a real OG preview image, not the logo fallback.
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    "content",
    new RegExp(`/og/papers/${DETAIL_PAPER.slug}\\.png$`),
  );
});

test("legacy mock-tests detail URLs permanently redirect to the categorized PYQ paper page", async ({
  page,
}) => {
  const response = await page.request.get(`/mock-tests/${SCORED_PAPER.slug}`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(SCORED_PAPER_PATH);

  const legacyArchiveResponse = await page.request.get(
    `/cuet-ug-previous-year-question-papers/language-pyqs/subject/${SCORED_PAPER.subject.slug}/${SCORED_PAPER.slug}`,
    { maxRedirects: 0 },
  );
  expect(legacyArchiveResponse.status()).toBe(301);
  expect(legacyArchiveResponse.headers().location).toBe(SCORED_PAPER_PATH);
});

test("an unknown practice topic renders the themed 404 with a 404 status", async ({ page }) => {
  const response = await page.goto("/cuet-mock-test/english/not-a-real-topic");
  expect(response?.status()).toBe(404);
  await expect(
    page.getByRole("heading", { level: 1, name: "That page is not here." }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Go home" })).toHaveAttribute("href", "/");
});

test("legacy practice URLs permanently redirect to mock-tests", async ({ page }) => {
  const index = await page.request.get("/practice", { maxRedirects: 0 });
  expect(index.status()).toBe(301);
  expect(index.headers().location).toBe("/mock-tests");

  const detail = await page.request.get(`/practice/${SCORED_PAPER.slug}?source=old`, {
    maxRedirects: 0,
  });
  expect(detail.status()).toBe(301);
  expect(detail.headers().location).toBe(`/mock-tests/${SCORED_PAPER.slug}?source=old`);
});

test("the retired take URL permanently redirects to ranked instructions", async ({ page }) => {
  const response = await page.request.get(`/mock-tests/${SCORED_PAPER.slug}/take`, {
    maxRedirects: 0,
  });
  expect(response.status()).toBe(301);
  expect(response.headers().location).toBe(INSTRUCTIONS);

  await page.goto(`/mock-tests/${SCORED_PAPER.slug}/take`);
  await expect(page).toHaveURL(new RegExp(`${INSTRUCTIONS.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
});

test("a practice paper starts, autosaves, submits and shows a saved ranked result", async ({
  page,
}) => {
  await page.goto(INSTRUCTIONS);
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  await expect(
    page.getByText(`${SCORED_PAPER.rankedDurationMinutes} min`, { exact: true }),
  ).toBeVisible();

  await beginAttempt(page);

  const html = await page.content();
  expect(html).not.toContain("correctAnswer");
  expect(html).not.toContain("correct_option");
  expect(html).not.toContain("explanationEn");

  const firstOption = page.locator("#question-area [data-option]").first();
  await firstOption.click();
  await expect(firstOption).toHaveClass(/selected/);
  await expect(page.locator("#save-state")).toHaveText(/Saved/, { timeout: 10_000 });

  await page.reload();
  await expect(page).toHaveURL(/\/attempt\/\d+$/);
  await expect(page.locator("#question-area")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#question-area [data-option].selected").first()).toBeVisible();
  await expect(page.locator("#save-state")).toHaveText(/Saved/);

  await submitAttempt(page);
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
  await expect(page.getByText("Server-scored with this paper's marking scheme")).toBeVisible();
  await expect(
    page.getByText(/This attempt is tied to a guest cookie on this browser/),
  ).toBeVisible();

  await page.getByRole("link", { name: "Review solutions →" }).click();
  await expect(page).toHaveURL(/\/result\/\d+\/solutions$/);
  await expect(page.getByText(/Correct answer/i).first()).toBeVisible();
});

test("practice attempt sharing follows the admin setting and never links /q/", async ({
  page,
}) => {
  test.slow();
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test toggles a site setting in the local D1 database.",
  );
  const shareUi = '[data-share-sheet], [data-share-trigger], [data-question-share], a[href^="/q/"]';

  // Setting off (the default): no share UI anywhere on the attempt.
  setAttemptShareSetting("false");
  await page.goto(INSTRUCTIONS);
  await beginAttempt(page);
  expect(await page.locator(shareUi).count()).toBe(0);
  expect(await page.locator("[data-attempt-share-trigger]").count()).toBe(0);
  expect(await page.getByRole("button", { name: /share/i }).count()).toBe(0);

  // Owner decision 2026-11-06: practice papers share the question image with
  // the mock instructions link — never a public /q/ URL and never the answer.
  setAttemptShareSetting("true");
  await page.reload();
  await expect(page.locator("[data-attempt-share-trigger]").first()).toBeVisible();
  expect(await page.locator('a[href^="/q/"]').count()).toBe(0);

  await page.locator("[data-attempt-share-trigger]").first().click();
  const dialog = page.locator("[data-attempt-share-dialog]");
  await expect(dialog).toBeVisible();
  const card = page.locator("[data-attempt-share-card]");
  await expect(card.locator(".asq-title")).toContainText("CUET UG English 6 August 2022");
  await expect(card).not.toContainText("Correct answer");
  await expect(page.locator("[data-attempt-share-preview]")).toBeVisible({ timeout: 30_000 });

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  // Solutions still expose no share surface: practice questions have no
  // public-id lineage, so nothing there is individually linkable.
  await submitAttempt(page);
  await page.getByRole("link", { name: "Review solutions →" }).click();
  await expect(page).toHaveURL(/\/result\/\d+\/solutions$/);
  expect(await page.locator(shareUi).count()).toBe(0);
  expect(await page.getByRole("button", { name: /share/i }).count()).toBe(0);
  expect(await page.getByRole("link", { name: /share/i }).count()).toBe(0);
});

test("submitting a practice paper increments the public ranked attempt counter", async ({
  page,
}) => {
  const counter = page.getByText(/\d[\d,]* attempts? so far/);

  await page.goto(INSTRUCTIONS);
  await expect(counter).toBeVisible();
  const before = Number((await counter.textContent())!.match(/\d[\d,]*/)![0].replace(/,/g, ""));

  await beginAttempt(page);
  await submitAttempt(page);

  await page.goto(INSTRUCTIONS);
  await expect(counter).toBeVisible();
  const after = Number((await counter.textContent())!.match(/\d[\d,]*/)![0].replace(/,/g, ""));
  expect(after).toBe(before + 1);
});

test("practice papers are linked from their subject hub", async ({ page }) => {
  await page.goto(`/cuet-mock-test/${SCORED_PAPER.subject.slug}`);
  await expect(page.locator(`a[href="${SCORED_PAPER_PATH}"]`).first()).toBeVisible();
});

test("PYQ cards and General Test metadata use the requested PYQ wording", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cuet-ug-previous-year-question-papers");
  await expect(page.getByRole("heading", { name: "Browse by year" })).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Browse by subject" })).toHaveCount(0);
  const subjectCards = page.locator("[data-pyq-subject-card]");
  await expect(subjectCards.first()).toBeVisible();

  for (const card of await subjectCards.all()) {
    await expect(card.locator(":scope > div:first-child > span")).toHaveText(/^\d+ PYQs$/);
    await expect(
      card.getByText("Practice Online for FREE and Boost Your NTA CUET UG 2027 Preparation.", {
        exact: true,
      }),
    ).toBeVisible();
  }

  const generalTestRows = page
    .locator('[data-pyq-subject-card][data-subject-slug="general-test"]')
    .locator("[data-pyq-paper-row]");
  for (const row of await generalTestRows.all()) {
    const tagRow = row.locator(".min-w-0 > div");
    const tags = tagRow.locator("span.rounded");
    await expect(tags).toHaveCount(4);
    await expect(tags.nth(1)).toHaveText(/^\d{2}-\d{2}-\d{4}(?: Shift \d+)?$/i);
    await expect(tags.nth(2)).toContainText(/\d+ questions/);
    await expect(tags.nth(3)).toHaveText(/\d+ min/);
    const tagRows = await tags.evaluateAll((elements) =>
      elements.map((element) => Math.round(element.getBoundingClientRect().top)),
    );
    expect(new Set(tagRows).size).toBe(1);
    await expect(row.getByRole("link", { name: "Start Test →" })).toHaveAttribute(
      "href",
      /^\/cuet-ug-previous-year-question-papers\/general-aptitude-test-pyqs\/general-test\/.+$/,
    );
  }

  await page.goto(
    "/cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test",
  );
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "NTA CUET UG General Aptitude Test PYQs - Practice Online",
  );
  await expect(
    page.getByText(
      "Practice CUET UG General Aptitude Test PYQs Online for FREE with Answers. Attempt Timed NTA Previous Years Questions and Boost your Preparation for CUET UG 2027.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(page).toHaveTitle(
    "NTA CUET UG General Aptitude Test PYQs | Free Online Practice",
  );
  await expect(page.locator('meta[name="description"]')).toHaveAttribute(
    "content",
    "Practice CUET UG General Aptitude Test PYQs Online for FREE with Answers. Attempt Timed NTA Previous Years Questions and Boost your Preparation for CUET UG 2027.",
  );

  const legacySubjectResponse = await page.request.get(
    "/cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/subject/general-test",
    { maxRedirects: 0 },
  );
  expect(legacySubjectResponse.status()).toBe(301);
  expect(legacySubjectResponse.headers().location).toBe(
    "/cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test",
  );
});

test("Accountancy subject archive uses the URL without /subject", async ({ page }) => {
  const path = "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy";
  const response = await page.goto(path);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Accountancy");

  const legacyResponse = await page.request.get(
    "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/subject/accountancy",
    { maxRedirects: 0 },
  );
  expect(legacyResponse.status()).toBe(301);
  expect(legacyResponse.headers().location).toBe(path);
});

test("General Test paper pages use the requested date-specific metadata", async ({ page }) => {
  for (const paper of GENERAL_TEST_PAPERS) {
    const dateLabel = paper.dateLabel || String(paper.year);
    const titleShift = paper.shift ? ` ${paper.shift}` : "";
    const descriptionShift = paper.shift ? `, ${paper.shift}` : "";

    await page.goto(
      `/cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/${paper.slug}`,
    );
    await expect(page).toHaveTitle(
      `CUET UG General Test ${dateLabel}${titleShift} PYQ | Online Test`,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      `Practice the official NTA CUET UG General Test Previous Year Question Paper with Answers (${dateLabel}${descriptionShift}) Online for FREE and Boost your Exam Prep!`,
    );
    if (paper.shift && paper.date) {
      const [year, month, day] = paper.date.split("-");
      await expect(page.locator("[data-paper-shift-tag]")).toHaveText(
        `${day}-${month}-${year} ${paper.shift}`,
      );
    } else {
      await expect(page.locator("[data-paper-shift-tag]")).toHaveCount(0);
    }
  }
});

test("the homepage shows refined most-popular papers in the hero and below", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Boost Your CUET UG 2027 Preparation with FREE Online Mock Tests & PYQs",
  );
  await expect(page.getByText(/No account needed to start/)).toBeVisible();

  const heroPanel = page.locator('aside[aria-labelledby="popular-heading"]');
  await expect(heroPanel).toBeVisible();
  await expect(
    heroPanel.getByRole("heading", { name: "Most Popular Mock Tests", level: 2 }),
  ).toBeVisible();
  const heroLinks = heroPanel.locator('a[href^="/cuet-ug-previous-year-question-papers/"]');
  expect(await heroLinks.count()).toBeGreaterThan(0);

  await expect(
    page.getByRole("heading", { name: "Most Popular Mock Tests", level: 3 }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Most Popular Subject Practice", level: 3 }),
  ).toBeVisible();

  const libraryGrid = page.locator("div.lg\\:grid-cols-2").filter({ has: page.locator("h3") });
  await expect(libraryGrid).toHaveCount(1);

  const html = await page.content();
  expect(html).not.toContain("E2E Local Fixture Mock");
  expect(html).not.toContain("English Starter Mock");
  expect(html).not.toMatch(/e2e-/i);
});

test("practice library copy is ranked and free of public OCR provenance", async ({ page }) => {
  await page.goto("/mock-tests");
  const html = await page.content();
  expect(html).not.toMatch(/\bunranked\b/i);
  expect(html).not.toMatch(/PaddleOCR|OCR export|extraction pipeline/i);

  await page.goto(SCORED_PAPER_PATH);
  const detail = await page.content();
  expect(detail).not.toMatch(/\bunranked\b/i);
  expect(detail).not.toMatch(/PaddleOCR|OCR export|recovered from source/i);
});
