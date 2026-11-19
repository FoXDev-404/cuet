import { expect, test, type Page } from "@playwright/test";

/**
 * Covers the 118 rebuilt 50-question sets: the three set shapes (pooled,
 * pooled with passages, reduced), the source tags carried into the runner and
 * solutions, the archive filters, and the archived-paper redirects.
 */

const POOLED = {
  slug: "cuet-accountancy-pyq-set-1",
  path: "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/accountancy/cuet-accountancy-pyq-set-1",
  instructions: "/mock/cuet-accountancy-pyq-set-1/instructions",
};

const PASSAGE_SET = {
  slug: "cuet-business-studies-pyq-set-6",
  path: "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/business-studies/cuet-business-studies-pyq-set-6",
  instructions: "/mock/cuet-business-studies-pyq-set-6/instructions",
};

const REDUCED = {
  slug: "cuet-general-test-pyq-set-1",
  path: "/cuet-ug-previous-year-question-papers/general-aptitude-test-pyqs/general-test/cuet-general-test-pyq-set-1",
  instructions: "/mock/cuet-general-test-pyq-set-1/instructions",
};

const UNTOUCHED = {
  slug: "biology-2025-05-20-shift-1",
  path: "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/biology-2025-05-20-shift-1",
  instructions: "/mock/biology-2025-05-20-shift-1/instructions",
};

test.beforeEach(async ({ page, request }) => {
  // The rebuild is applied to local D1 and production, not to the legacy seed
  // fixture CI imports. Use the sitemap as the marker so a real 404 on a set
  // page still fails instead of silently skipping.
  const sitemap = await request.get("/sitemap.xml");
  const sitemapBody = sitemap.ok() ? await sitemap.text() : "";
  test.skip(
    !/cuet-[a-z-]+-pyq-set-\d+/.test(sitemapBody),
    "PYQ rebuild fixture is not applied to this database.",
  );
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

test("each rebuilt set shape reports exactly 50 questions and its provenance", async ({
  page,
}) => {
  for (const set of [POOLED, PASSAGE_SET, REDUCED]) {
    const response = await page.goto(set.path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();

    const questionsCard = page.getByText("Questions", { exact: true }).locator("..");
    await expect(questionsCard).toContainText("50");
    const durationCard = page.getByText("Duration", { exact: true }).locator("..");
    await expect(durationCard).toContainText("60 min");
    await expect(page.getByRole("link", { name: /Start Test/ })).toHaveAttribute(
      "href",
      set.instructions,
    );
  }

  await page.goto(POOLED.path);
  await expect(page.getByText(/questions pooled from \d+ CUET papers/)).toBeVisible();

  await page.goto(PASSAGE_SET.path);
  await expect(page.getByText(/questions pooled from \d+ CUET papers/)).toBeVisible();

  await page.goto(REDUCED.path);
  await expect(
    page.getByText("Reduced from the original 125-question paper; 75 questions omitted."),
  ).toBeVisible();
});

test("a pooled set keeps its passages in front of their questions", async ({ page }) => {
  await page.goto(PASSAGE_SET.instructions);
  await beginAttempt(page);

  // Question 19 is the first passage-bearing question in this set.
  await page.locator("#palette-grid .nta-palette-btn").nth(18).click();
  const passageBox = page.locator("#question-area article > div.mt-4.rounded-lg").first();
  await expect(passageBox).toBeVisible();
  expect(((await passageBox.textContent()) ?? "").trim().length).toBeGreaterThan(40);

  const attemptData = (await page.locator("#attempt-data").textContent()) ?? "";
  expect(attemptData).toContain('"passage"');
  expect(attemptData).toContain('"body"');
});

test("runner and solutions show the original source tag and filter solutions by year", async ({
  page,
}) => {
  test.slow();
  await page.goto(POOLED.instructions);
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
  await beginAttempt(page);

  const questionArea = page.locator("#question-area");
  await expect(questionArea).toContainText("PYQ - 2022");

  await questionArea.locator("[data-option]").first().click();
  await expect(page.locator("#save-state")).toHaveText(/Saved/, { timeout: 10_000 });

  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#submit-attempt").click();
  await expect(page).toHaveURL(/\/result\/\d+$/);

  await page.getByRole("link", { name: "Review solutions →" }).click();
  await expect(page).toHaveURL(/\/result\/\d+\/solutions$/);

  const yearSelect = page.locator("#solution-year");
  await expect(yearSelect).toBeVisible();
  await expect(yearSelect.locator("option")).toHaveText([
    "All years",
    "2023",
    "2022",
  ]);

  const cards = page.locator("#solution-list [data-source-year]");
  await expect(cards.first()).toBeVisible();
  await expect(page.getByText(/^PYQ - 2022$/).first()).toBeVisible();

  await yearSelect.selectOption("2023");
  await expect(page.locator('#solution-list [data-source-year="2023"]:visible')).toHaveCount(15);
  await expect(page.locator('#solution-list [data-source-year="2022"]:visible')).toHaveCount(0);

  await yearSelect.selectOption("2022");
  await expect(page.locator('#solution-list [data-source-year="2022"]:visible')).toHaveCount(35);
  await expect(page.locator('#solution-list [data-source-year="2023"]:visible')).toHaveCount(0);
});

test("an untouched exactly-50 paper keeps its URL and paper-level source tag", async ({
  page,
}) => {
  const response = await page.goto(UNTOUCHED.path);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "CUET UG Biology 20 May 2025",
  );
  const questionsCard = page.getByText("Questions", { exact: true }).locator("..");
  await expect(questionsCard).toContainText("50");

  await page.goto(UNTOUCHED.instructions);
  await beginAttempt(page);
  await expect(page.locator("#question-area")).toContainText("PYQ - 20 May 2025, Shift 1");
});

test("archived paper URLs permanently redirect to the set or subject hub that replaced them", async ({
  page,
}) => {
  const archivedToSet = {
    old: "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/chemistry-2025-05-21-shift-2",
    target:
      "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/chemistry/cuet-chemistry-pyq-set-13",
  };
  const setResponse = await page.request.get(archivedToSet.old, { maxRedirects: 0 });
  expect(setResponse.status()).toBe(301);
  expect(setResponse.headers().location).toBe(archivedToSet.target);
  await page.goto(archivedToSet.old);
  await expect(page).toHaveURL(new RegExp(`${archivedToSet.target}$`));

  const archivedToHub = {
    old: "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology/biology-2025-05-20-shift-2",
    target: "/cuet-ug-previous-year-question-papers/domain-subject-pyqs/biology",
  };
  const hubResponse = await page.request.get(archivedToHub.old, { maxRedirects: 0 });
  expect(hubResponse.status()).toBe(301);
  expect(hubResponse.headers().location).toBe(archivedToHub.target);
  const followed = await page.goto(archivedToHub.old);
  expect(followed?.status()).toBe(200);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Biology");
});

test("the PYQ archive filters by subject, language, type and year range", async ({ page }) => {
  await page.goto("/cuet-ug-previous-year-question-papers");
  const rows = page.locator("[data-pyq-paper]");
  const total = await rows.count();
  expect(total).toBeGreaterThanOrEqual(132);

  await page.locator("[data-pyq-results] summary").click();

  await page.selectOption("#pyq-filter-subject", "accountancy");
  await expect(page.locator('[data-pyq-paper][data-subject="accountancy"]:visible')).toHaveCount(8);
  await expect(page.locator("[data-pyq-filter-count]")).toContainText(
    `Showing 8 of ${total} papers`,
  );
  const accountancyCard = page.locator('[data-pyq-subject-card][data-subject-slug="accountancy"]');
  await expect(accountancyCard).toBeVisible();
  await expect(
    page.locator('[data-pyq-subject-card]:not([data-subject-slug="accountancy"]):visible'),
  ).toHaveCount(0);

  await page.selectOption("#pyq-filter-subject", "");
  await page.selectOption("#pyq-filter-language", "Hindi");
  await expect(page.locator("[data-pyq-paper]:visible")).toHaveCount(2);
  await expect(page.locator("[data-pyq-filter-count]")).toContainText(
    `Showing 2 of ${total} papers`,
  );
  const hindiSubjects = await page
    .locator("[data-pyq-paper]:visible")
    .evaluateAll((elements) => [
      ...new Set(elements.map((element) => (element as HTMLElement).dataset.subject)),
    ]);
  expect(hindiSubjects).toEqual(["hindi"]);

  await page.selectOption("#pyq-filter-language", "");
  await page.selectOption("#pyq-filter-type", "practice_set");
  await expect(page.locator("[data-pyq-paper]:visible")).toHaveCount(118);

  await page.selectOption("#pyq-filter-type", "");
  await page.selectOption("#pyq-filter-year-from", "2026");
  await page.selectOption("#pyq-filter-year-to", "2026");
  const visibleYears = await page
    .locator("[data-pyq-paper]:visible")
    .evaluateAll((elements) => [
      ...new Set(elements.map((element) => (element as HTMLElement).dataset.year)),
    ]);
  expect(visibleYears).toEqual(["2026"]);
  expect(await page.locator("[data-pyq-paper]:visible").count()).toBeGreaterThan(0);
});

test("the sitemap lists every rebuilt set and no archived paper", async ({ request }) => {
  const response = await request.get("/sitemap.xml");
  expect(response.status()).toBe(200);
  const body = await response.text();

  const setPaths = new Set(
    [...body.matchAll(/cuet-[a-z-]+-pyq-set-\d+/g)].map((match) => match[0]),
  );
  expect(setPaths.size).toBe(118);
  for (const set of [POOLED, PASSAGE_SET, REDUCED]) {
    expect(body).toContain(set.path);
  }

  for (const archived of [
    "general-test-2025-05-20-shift-1",
    "biology-2025-05-20-shift-2",
    "chemistry-2025-05-21-shift-2",
  ]) {
    expect(body).not.toContain(archived);
  }
});
