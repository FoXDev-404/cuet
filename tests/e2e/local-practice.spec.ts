import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

type LocalIndexPaper = {
  slug: string;
  title: string;
  subject: { slug: string; name: string };
  year: number;
  questionCount: number;
  scorableQuestionCount: number;
  pendingReviewCount: number;
  durationMinutes: number;
};

type LocalIndex = { papers?: LocalIndexPaper[] | null };

const LOCAL_INDEX = JSON.parse(
  readFileSync(fileURLToPath(new URL("../../src/data/local-papers/index.json", import.meta.url)), "utf8"),
) as LocalIndex;

function paperBySlug(slug: string): LocalIndexPaper {
  const paper = (LOCAL_INDEX.papers ?? []).find((entry) => entry.slug === slug);
  if (!paper) throw new Error(`Missing local paper fixture: ${slug}`);
  return paper;
}

const SCORED_PAPER = paperBySlug("english-2022-08-06-shift-1");
const DETAIL_PAPER = paperBySlug("biology-2025-05-20-shift-2");
const INSTRUCTIONS = `/mock/${SCORED_PAPER.slug}/instructions`;

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
  await expect(page.locator("#question-area [data-option]").first()).toBeVisible();
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
  await expect(page.locator(`a[href="/mock-tests/${SCORED_PAPER.slug}"]`).first()).toBeVisible();

  await page.goto(`/mock-tests/${SCORED_PAPER.slug}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "CUET UG English 6 August 2022",
  );
  await expect(page.getByRole("link", { name: /Start ranked paper/ })).toHaveAttribute(
    "href",
    INSTRUCTIONS,
  );
  await expect(page.getByRole("link", { name: "View leaderboard" })).toHaveAttribute(
    "href",
    `/leaderboard/${SCORED_PAPER.slug}`,
  );
});

test("practice detail reports the scored count when no questions are excluded", async ({
  page,
}) => {
  await page.goto(`/mock-tests/${DETAIL_PAPER.slug}`);

  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "CUET UG Biology 20 May 2025",
  );
  await expect(page.getByText(/not included in the ranked paper/)).toHaveCount(0);
  const scoredCard = page.getByText("in the ranked paper").locator("..");
  await expect(scoredCard).toContainText(String(DETAIL_PAPER.scorableQuestionCount));
  await expect(page.getByRole("link", { name: /Start ranked paper/ })).toHaveAttribute(
    "href",
    `/mock/${DETAIL_PAPER.slug}/instructions`,
  );
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
  await expect(page.getByText(`${SCORED_PAPER.durationMinutes} min`, { exact: true })).toBeVisible();

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

test("practice attempts hide question sharing during the paper and in solutions", async ({
  page,
}) => {
  const shareUi = '[data-share-sheet], [data-share-trigger], [data-question-share], a[href^="/q/"]';

  await page.goto(INSTRUCTIONS);
  await beginAttempt(page);
  expect(await page.locator(shareUi).count()).toBe(0);
  expect(await page.getByRole("button", { name: /share/i }).count()).toBe(0);

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

test("previous-year practice mocks are filtered out of the generic mock bank", async ({ page }) => {
  await page.goto("/cuet-ug-mock-test");
  expect(await page.locator(`a[href="/mock/${SCORED_PAPER.slug}/instructions"]`).count()).toBe(0);
  expect(await page.locator(`a[href="/mock/${SCORED_PAPER.slug}"]`).count()).toBe(0);

  await page.goto(`/cuet-mock-test/${SCORED_PAPER.subject.slug}`);
  await expect(page.locator(`a[href="/mock-tests/${SCORED_PAPER.slug}"]`).first()).toBeVisible();
});

test("the homepage shows refined most-popular papers in the hero and below", async ({ page }) => {
  await page.goto("/");

  const heroPanel = page.locator('aside[aria-labelledby="popular-heading"]');
  await expect(heroPanel).toBeVisible();
  await expect(
    heroPanel.getByRole("heading", { name: "Most Popular Mock Tests", level: 2 }),
  ).toBeVisible();
  const heroLinks = heroPanel.locator('a[href^="/mock-tests/"]');
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

  await page.goto(`/mock-tests/${SCORED_PAPER.slug}`);
  const detail = await page.content();
  expect(detail).not.toMatch(/\bunranked\b/i);
  expect(detail).not.toMatch(/PaddleOCR|OCR export|recovered from source/i);
});
