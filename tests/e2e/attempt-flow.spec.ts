import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const MOCK_LIST_PATHS = ["/mock-tests"];
const WRANGLER_BIN = path.resolve("node_modules/wrangler/bin/wrangler.js");

/** Keeps repeated local runs out of the shared rate-limit bucket. */
function testClientIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": testClientIp() });
});

/**
 * Moves an attempt's server deadline into the past using the same local D1
 * file the dev server reads. This keeps the expiry test at the HTTP boundary
 * instead of mocking the timer inside the application.
 */
function expireAttemptInLocalD1(attemptId: number): void {
  if (!Number.isInteger(attemptId) || attemptId <= 0) throw new Error("Invalid attempt id.");
  const deadline = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  execFileSync(
    process.execPath,
    [
      WRANGLER_BIN,
      "d1",
      "execute",
      "cuet-blueprint-db",
      "--local",
      "--command",
      `UPDATE attempts SET deadline_at = '${deadline}' WHERE id = ${attemptId}`,
    ],
    { cwd: process.cwd(), stdio: "pipe", timeout: 120_000 },
  );
}

/**
 * Finds the first published mock linked from the public mock list and opens
 * its instructions page. The public catalogue intentionally hides QA
 * fixtures, so on a local run the dedicated fixture is used directly to keep
 * the attempt flow covered. Tests are skipped (rather than silently passing)
 * when neither is available.
 */
async function openFirstMockInstructions(page: Page): Promise<void> {
  let href: string | null = null;
  for (const path of MOCK_LIST_PATHS) {
    await page.goto(path);
    const mockLink = page.locator('a[href^="/mock/"]').first();
    href = (await mockLink.count()) > 0 ? await mockLink.getAttribute("href") : null;
    if (href) {
      // The library card links straight to /instructions; normalise back to the
      // mock root so the helper always appends the instructions path once.
      href = href.replace(/\/instructions$/, "");
      break;
    }
  }

  if (!href && !process.env.PLAYWRIGHT_BASE_URL) {
    const fixture = await page.goto("/mock/e2e-local-fixture-mock/instructions");
    if (fixture?.status() === 200) href = "/mock/e2e-local-fixture-mock";
  }

  if (!href) {
    test.skip(true, "No published mock test is available in this environment.");
    return;
  }

  await page.goto(`${href}/instructions`);
  await expect(page.getByRole("heading", { name: "Before you start" })).toBeVisible();
}

async function beginAttempt(page: Page): Promise<void> {
  await page.getByRole("button", { name: /Begin test/ }).click();
  await expect(page).toHaveURL(/\/attempt\/\d+$/);
  await expect(page.locator("#attempt-data")).toBeAttached();
  await expect(page.locator("#question-area [data-option]").first()).toBeVisible();
}

async function answerFirstQuestion(page: Page): Promise<void> {
  const option = page.locator("#question-area [data-option]").first();
  await option.click();
  await expect(option).toHaveClass(/selected/);
}

async function submitAttempt(page: Page): Promise<void> {
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#submit-attempt").click();
  await expect(page).toHaveURL(/\/result\/\d+$/);
}

async function expectServerScoredResult(page: Page): Promise<void> {
  await expect(page.getByText("Submitted", { exact: true })).toBeVisible();
  await expect(page.getByText("Server-scored with this paper's marking scheme")).toBeVisible();
  await expect(page.getByRole("link", { name: "Review solutions →" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Leaderboard", exact: true })).toBeVisible();
  await expect(page.locator("#discussion").getByRole("heading", { name: "Discussion & chat" })).toBeVisible();

  await page.getByRole("link", { name: "Review solutions →" }).click();
  await expect(page).toHaveURL(/\/result\/\d+\/solutions$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Correct answer/i).first()).toBeVisible();
}

test("registered student can start, answer, submit and review a mock", async ({ page }) => {
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const username = `e2e_${stamp}`.slice(0, 30);
  const email = `e2e-${stamp}@example.com`;

  await page.goto("/signup");
  await page.fill('input[name="username"]', username);
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', "E2ePass123!");
  await page.locator('#signup-form button[type="submit"]').click();

  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Hi,");

  await openFirstMockInstructions(page);
  await beginAttempt(page);

  // The paper discussion sits below the live exam frame so a student can
  // scroll to it without leaving the attempt.
  const liveDiscussion = page.locator("#discussion");
  await expect(liveDiscussion.getByRole("heading", { name: "Live paper chat" })).toBeVisible();
  await expect(liveDiscussion.getByLabel("Join the discussion")).toBeVisible();
  await expect(liveDiscussion.getByRole("button", { name: "Post comment" })).toBeVisible();

  // Posting from the live chat must not reload the attempt or trip the
  // leave-page guard; the confirmation appears in place.
  await liveDiscussion.getByLabel("Join the discussion").fill(`Live UI comment ${stamp}`);
  await liveDiscussion.getByRole("button", { name: "Post comment" }).click();
  await expect(liveDiscussion.getByText(/Comment submitted|Posted\./)).toBeVisible();
  await expect(page).toHaveURL(/\/attempt\/\d+$/);
  await expect(liveDiscussion.getByLabel("Join the discussion")).toHaveValue("");
  await expect(liveDiscussion.getByRole("button", { name: "Post comment" })).toBeEnabled();

  await answerFirstQuestion(page);
  await submitAttempt(page);
  await expectServerScoredResult(page);
});

test("guest can start, answer and submit a mock without an account", async ({ page }) => {
  await openFirstMockInstructions(page);
  await beginAttempt(page);
  await answerFirstQuestion(page);
  await submitAttempt(page);
  await expect(page.getByText("Create an account in this browser to enter the first-attempt leaderboard.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Review solutions →" })).toBeVisible();

  // Duplicate submits are idempotent and never double-score the attempt.
  const attemptId = page.url().match(/\/result\/(\d+)/)?.[1];
  expect(attemptId).toBeTruthy();
  const repeated = await page.request.post(`/api/attempts/${attemptId}/submit`, { data: {} });
  expect(repeated.status()).toBe(200);
  expect(await repeated.json()).toMatchObject({ ok: true, status: "submitted" });
});

test("a refresh resumes the same attempt with saved answers", async ({ page }) => {
  await openFirstMockInstructions(page);
  await beginAttempt(page);
  await answerFirstQuestion(page);

  // Autosave fires 1.2s after a change; wait for the visible save confirmation.
  await expect(page.locator("#save-state")).toHaveText(/Saved/, { timeout: 10_000 });

  await page.reload({ waitUntil: "load" });
  await expect(page).toHaveURL(/\/attempt\/\d+$/);
  await expect(page.locator("#attempt-data")).toBeAttached();
  await expect(page.locator("#question-area [data-option].selected").first()).toBeVisible();
  await expect(page.locator("#save-state")).toHaveText(/Saved/);
});

test("an attempt past its deadline is expired and stays unranked", async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "The expiry test moves the deadline in the local D1 file used by the dev server.",
  );

  const list = await page.request.get("/api/mocks?limit=1");
  expect(list.status()).toBe(200);
  const mock = ((await list.json()) as { mocks?: { id: number }[] }).mocks?.[0];
  if (!mock) {
    test.skip(true, "No published mock test is available in this environment.");
    return;
  }

  const headers = { "cf-connecting-ip": testClientIp() };
  const started = await page.request.post("/api/attempts/start", {
    data: { mockId: mock.id },
    headers,
  });
  expect([200, 201]).toContain(started.status());
  const { attemptId } = (await started.json()) as { attemptId: number };
  expect(attemptId).toBeGreaterThan(0);

  expireAttemptInLocalD1(attemptId);

  const submitted = await page.request.post(`/api/attempts/${attemptId}/submit`, {
    data: { answers: [] },
    headers,
  });
  expect(submitted.status()).toBe(200);
  expect(await submitted.json()).toMatchObject({ ok: true, status: "expired" });

  // Re-submitting an expired attempt is idempotent and never restores ranking.
  const repeated = await page.request.post(`/api/attempts/${attemptId}/submit`, { data: {} });
  expect(await repeated.json()).toMatchObject({ ok: true, status: "expired" });

  await page.goto(`/result/${attemptId}`);
  await expect(page.getByText("Time expired", { exact: true })).toBeVisible();
  await expect(page.getByText("The timer ran out before the test was submitted.")).toBeVisible();
  await expect(page.getByText("Server-scored with this paper's marking scheme")).toBeVisible();
});
