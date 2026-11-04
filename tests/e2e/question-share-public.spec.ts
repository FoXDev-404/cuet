import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { generatePublicId, questionSharePath } from "../../src/lib/share/public-id";

const require = createRequire(import.meta.url);
const AXE_PATH = require.resolve("axe-core/axe.min.js");
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];

/**
 * Public shared-question behaviour.
 *
 * These tests write dedicated fixture questions and student accounts into the
 * local D1 database, so they are skipped against a deployed base URL.
 */

const DB_NAME = "cuet-blueprint-db";
const WRANGLER_BIN = path.resolve("node_modules/wrangler/bin/wrangler.js");
const MOCK_ID = 1;

const questionIds: number[] = [];
const publicIds: string[] = [];
const studentEmails: string[] = [];
const mockIds: number[] = [];
let previousAttemptSetting: string | null = null;
let attemptSettingCaptured = false;

type Fixture = {
  id: number;
  publicId: string;
  path: string;
  text: string;
  explanation: string;
  options: string[];
};

type FixtureInput = {
  text: string;
  textHi?: string | null;
  options?: string[];
  optionsHi?: string[] | null;
  optionImages?: Array<{ imageUrl: string | null; alt: string | null }>;
  correctOption?: number;
  explanation?: string | null;
  year?: number | null;
  status?: "draft" | "published";
  revealPolicy?: "attempted_only" | "public";
  shareEnabled?: 0 | 1;
  seoIndexable?: 0 | 1;
  rightsOk?: 0 | 1;
  imageUrl?: string | null;
  imageAlt?: string | null;
};

const DEFAULT_OPTIONS = [
  "Alpha is the answer",
  "Beta is the answer",
  "Gamma is the answer",
  "Delta is the answer",
];

function uniqueStamp(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function testClientIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Runs SQL against the same local D1 file the dev server reads. */
function localD1(sql: string): void {
  execFileSync(
    process.execPath,
    [WRANGLER_BIN, "d1", "execute", DB_NAME, "--local", "--command", sql],
    { cwd: process.cwd(), stdio: "pipe", timeout: 120_000 },
  );
}

function localD1Rows<T>(sql: string): T[] {
  const output = execFileSync(
    process.execPath,
    [WRANGLER_BIN, "d1", "execute", DB_NAME, "--local", "--json", "--command", sql],
    {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 120_000,
    },
  );
  const start = output.indexOf("[");
  if (start < 0) throw new Error(`wrangler returned no JSON: ${output.slice(0, 200)}`);
  const parsed = JSON.parse(output.slice(start)) as Array<{ results?: T[] }>;
  return parsed[0]?.results ?? [];
}

function createFixture(input: FixtureInput): Fixture {
  const publicId = generatePublicId();
  const options = input.options ?? DEFAULT_OPTIONS;
  const correctOption = input.correctOption ?? 0;
  const explanation = input.explanation ?? `E2E share explanation ${publicId}`;
  const optionsJson = JSON.stringify(
    options.map((text, index) => ({
      text,
      image_url: input.optionImages?.[index]?.imageUrl ?? null,
      alt: input.optionImages?.[index]?.alt ?? null,
    })),
  );
  const optionsHiJson = input.optionsHi
    ? JSON.stringify(
        input.optionsHi.map((text) => ({ text, image_url: null, alt: null })),
      )
    : null;

  localD1(`
    INSERT INTO questions
      (subject_id, text, text_hi, options, options_hi, correct_option, explanation,
       status, year, image_url, image_alt)
    VALUES
      (1, ${sqlString(input.text)},
       ${input.textHi ? sqlString(input.textHi) : "NULL"},
       ${sqlString(optionsJson)},
       ${optionsHiJson ? sqlString(optionsHiJson) : "NULL"},
       ${correctOption},
       ${explanation === null ? "NULL" : sqlString(explanation)},
       ${sqlString(input.status ?? "published")},
       ${input.year === undefined || input.year === null ? "NULL" : input.year},
       ${input.imageUrl ? sqlString(input.imageUrl) : "NULL"},
       ${input.imageAlt ? sqlString(input.imageAlt) : "NULL"});
    INSERT INTO question_public_ids
      (public_id, current_question_id, share_enabled, reveal_policy, seo_indexable, rights_ok)
    VALUES
      (${sqlString(publicId)},
       (SELECT id FROM questions WHERE text = ${sqlString(input.text)}),
       ${input.shareEnabled ?? 1},
       ${sqlString(input.revealPolicy ?? "attempted_only")},
       ${input.seoIndexable ?? 0},
       ${input.rightsOk ?? 0});
  `);

  const rows = localD1Rows<{ id: number }>(
    `SELECT id FROM questions WHERE text = ${sqlString(input.text)} ORDER BY id DESC LIMIT 1`,
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Could not create the shared-question fixture.");
  questionIds.push(id);
  publicIds.push(publicId);

  return {
    id,
    publicId,
    path: questionSharePath(publicId, input.text),
    text: input.text,
    explanation,
    options,
  };
}

function createRevision(input: {
  text: string;
  supersedesId: number;
  status?: "draft" | "published";
}): number {
  localD1(`
    INSERT INTO questions
      (subject_id, text, options, correct_option, explanation, status, supersedes_id)
    VALUES
      (1, ${sqlString(input.text)},
       ${sqlString(JSON.stringify(DEFAULT_OPTIONS.map((text) => ({ text, image_url: null, alt: null }))))},
       1, ${sqlString(`E2E revision explanation ${input.text}`)},
       ${sqlString(input.status ?? "draft")}, ${input.supersedesId});
  `);
  const rows = localD1Rows<{ id: number }>(
    `SELECT id FROM questions WHERE text = ${sqlString(input.text)} ORDER BY id DESC LIMIT 1`,
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Could not create the revision fixture.");
  questionIds.push(id);
  return id;
}

async function signupStudent(page: Page): Promise<{ email: string }> {
  const stamp = uniqueStamp();
  const email = `e2e-share-${stamp}@example.com`;
  const response = await page.request.post("/api/auth/signup", {
    headers: { "cf-connecting-ip": testClientIp() },
    data: {
      username: `share_${stamp}`.slice(0, 30),
      email,
      password: "SharePass123!",
    },
  });
  expect(response.status()).toBe(200);
  studentEmails.push(email);
  return { email };
}

/** Creates the minimum attempt rows needed by the shared-page eligibility check. */
function grantAttempt(
  email: string,
  questionId: number,
  status: "in_progress" | "submitted",
): void {
  const submittedAt =
    status === "submitted" ? sqlString("2026-01-01T00:30:00.000Z") : "NULL";
  localD1(`
    INSERT INTO attempts
      (user_id, mock_id, version_id, status, score, correct, wrong, skipped,
       time_taken_sec, started_at, deadline_at, submitted_at, is_first_attempt)
    SELECT u.id, m.id, m.current_version_id, ${sqlString(status)},
           ${status === "submitted" ? "0" : "NULL"},
           ${status === "submitted" ? "0" : "NULL"},
           ${status === "submitted" ? "0" : "NULL"},
           ${status === "submitted" ? "0" : "NULL"},
           ${status === "submitted" ? "0" : "NULL"},
           '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z',
           ${submittedAt}, 0
    FROM users u JOIN mock_tests m ON m.id = ${MOCK_ID}
    WHERE u.email = ${sqlString(email)};
    INSERT INTO attempt_answers
      (attempt_id, question_id, selected, time_spent_sec, marked_for_review, is_correct)
    SELECT a.id, ${questionId}, NULL, 0, 0, NULL
    FROM attempts a JOIN users u ON u.id = a.user_id
    WHERE u.email = ${sqlString(email)}
    ORDER BY a.id DESC LIMIT 1;
  `);
}

function markAttemptSubmitted(email: string): void {
  localD1(`
    UPDATE attempts SET status = 'submitted', submitted_at = '2026-01-01T00:30:00.000Z'
    WHERE id IN (
      SELECT a.id FROM attempts a JOIN users u ON u.id = a.user_id
      WHERE u.email = ${sqlString(email)} ORDER BY a.id DESC LIMIT 1
    );
  `);
}

/**
 * Builds a published ranked mock around one fixture question. Membership is
 * inserted while the version is still a draft because migration 0004 freezes
 * a version's questions once it is published.
 */
function createPublishedMock(questionId: number, stamp: string): number {
  const slug = `e2e-share-mock-${stamp}`;
  const marking = '{"correct":5,"incorrect":-1,"unattempted":0}';
  localD1(`
    INSERT INTO mock_tests
      (exam_id, subject_id, title, slug, type, duration_min, total_marks,
       marking_scheme, status, version)
    VALUES
      (1, 1, ${sqlString(`E2E share mock ${stamp}`)}, ${sqlString(slug)}, 'subject',
       30, 100, ${sqlString(marking)}, 'draft', 1);
    INSERT INTO mock_test_versions
      (mock_id, version_no, duration_min, total_marks, marking_scheme, status)
    SELECT id, 1, 30, 100, ${sqlString(marking)}, 'draft'
    FROM mock_tests WHERE slug = ${sqlString(slug)};
    INSERT INTO mock_questions (version_id, question_id, section, position)
    SELECT v.id, ${questionId}, 'Section', 1
    FROM mock_test_versions v JOIN mock_tests m ON m.id = v.mock_id
    WHERE m.slug = ${sqlString(slug)};
    UPDATE mock_test_versions
    SET status = 'published', published_at = '2026-01-01T00:00:00.000Z'
    WHERE mock_id = (SELECT id FROM mock_tests WHERE slug = ${sqlString(slug)});
    UPDATE mock_tests
    SET status = 'published', published_at = '2026-01-01T00:00:00.000Z',
        current_version_id = (
          SELECT id FROM mock_test_versions WHERE mock_id = mock_tests.id
        )
    WHERE slug = ${sqlString(slug)};
  `);
  const rows = localD1Rows<{ id: number }>(
    `SELECT id FROM mock_tests WHERE slug = ${sqlString(slug)}`,
  );
  const id = rows[0]?.id;
  if (!id) throw new Error("Could not create the published mock fixture.");
  mockIds.push(id);
  return id;
}

function canonicalPathFromRedirect(location: string): string {
  return new URL(location, "http://localhost").pathname;
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

test.beforeEach(async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "These tests create question fixtures and student accounts in the local D1 database.",
  );
  questionIds.length = 0;
  publicIds.length = 0;
  studentEmails.length = 0;
  mockIds.length = 0;
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": testClientIp() });
});

test.afterEach(() => {
  if (attemptSettingCaptured) {
    if (previousAttemptSetting === null) {
      localD1("DELETE FROM site_settings WHERE key = 'share_question_during_attempt';");
    } else {
      localD1(
        `INSERT INTO site_settings (key, value) VALUES ('share_question_during_attempt', ${sqlString(previousAttemptSetting)})
         ON CONFLICT(key) DO UPDATE SET value = excluded.value;`,
      );
    }
    previousAttemptSetting = null;
    attemptSettingCaptured = false;
  }
  if (
    questionIds.length === 0 &&
    publicIds.length === 0 &&
    studentEmails.length === 0 &&
    mockIds.length === 0
  ) {
    return;
  }
  const ids = questionIds.length > 0 ? questionIds.join(", ") : "0";
  for (const publicId of publicIds) {
    const file = path.resolve("public", "og", "questions", `${publicId}.png`);
    if (existsSync(file)) unlinkSync(file);
  }
  const mappings =
    publicIds.length > 0 ? publicIds.map((id) => sqlString(id)).join(", ") : "''";
  const emails =
    studentEmails.length > 0 ? studentEmails.map((email) => sqlString(email)).join(", ") : "''";
  const mocks = mockIds.length > 0 ? mockIds.join(", ") : "0";
  const stamp = sqlString(new Date().toISOString());

  // Migration 0004 forbids hard-deleting published questions and published
  // mock versions. Soft-delete the fixtures and remove their public mappings,
  // exactly as the admin trash flow does.
  localD1(`
    DELETE FROM share_events WHERE public_id IN (${mappings}) OR mock_id IN (${mocks});
    DELETE FROM attempt_answers WHERE question_id IN (${ids});
    DELETE FROM attempt_answers WHERE attempt_id IN
      (SELECT id FROM attempts WHERE user_id IN
        (SELECT id FROM users WHERE email IN (${emails})));
    DELETE FROM attempt_answers WHERE attempt_id IN
      (SELECT id FROM attempts WHERE mock_id IN (${mocks}));
    DELETE FROM attempts WHERE user_id IN (SELECT id FROM users WHERE email IN (${emails}));
    DELETE FROM attempts WHERE mock_id IN (${mocks});
    DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email IN (${emails}));
    DELETE FROM user_stats WHERE user_id IN (SELECT id FROM users WHERE email IN (${emails}));
    DELETE FROM bookmarks WHERE user_id IN (SELECT id FROM users WHERE email IN (${emails}));
    DELETE FROM question_public_ids WHERE public_id IN (${mappings});
    UPDATE questions SET deleted_at = COALESCE(deleted_at, ${stamp}) WHERE id IN (${ids});
    UPDATE mock_tests SET deleted_at = COALESCE(deleted_at, ${stamp}) WHERE id IN (${mocks});
    DELETE FROM users WHERE email IN (${emails});
  `);
});

test("shared question URLs redirect a wrong slug, 404 unknown ids and hide the answer key", async ({
  page,
  request,
}) => {
  const stamp = uniqueStamp();
  const explanation = `E2E-EXPLANATION-${stamp}`;
  const fixture = createFixture({
    text: `E2E share URL ${stamp}: which option is Gamma?`,
    correctOption: 2,
    explanation,
  });

  const wrongSlug = `/q/not-the-real-slug-${fixture.publicId}`;
  const redirect = await request.get(wrongSlug, { maxRedirects: 0 });
  expect(redirect.status()).toBe(301);
  expect(canonicalPathFromRedirect(redirect.headers().location ?? "")).toBe(fixture.path);

  const response = await page.goto(fixture.path);
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  await expect(page.locator("article h1")).toContainText(`E2E share URL ${stamp}`);
  await expect(page.getByText("Attempt the full mock to see the solution")).toBeVisible();
  await expect(page.locator("[data-check-button]")).toHaveCount(0);

  const html = await page.content();
  expect(html).not.toContain(explanation);
  expect(html).not.toContain("correct_option");
  expect(html).not.toContain(`/admin/questions/${fixture.id}`);

  const api = await request.get(`/api/public-questions/${fixture.publicId}`);
  expect(api.status()).toBe(200);
  const apiBody = (await api.json()) as {
    question: Record<string, unknown> & { options: unknown[]; text: string };
  };
  expect(apiBody.question.text).toBe(fixture.text);
  expect(apiBody.question.options).toHaveLength(4);
  expect(apiBody.question.id).toBeUndefined();
  expect(apiBody.question.correctOption).toBeUndefined();
  expect(apiBody.question.explanation).toBeUndefined();
  expect(JSON.stringify(apiBody)).not.toContain(explanation);
  expect(JSON.stringify(apiBody)).not.toContain("correct_option");

  const unknown = await request.get("/q/x-AAAAAAAAAA", { maxRedirects: 0 });
  const disabled = createFixture({
    text: `E2E share disabled ${stamp}: which option is Alpha?`,
    shareEnabled: 0,
  });
  const hidden = await request.get(disabled.path, { maxRedirects: 0 });
  expect(unknown.status()).toBe(404);
  expect(hidden.status()).toBe(404);
  expect(await unknown.text()).toBe(await hidden.text());

  const draft = createFixture({
    text: `E2E share draft ${stamp}: which option is Alpha?`,
    status: "draft",
  });
  const unpublished = await request.get(draft.path, { maxRedirects: 0 });
  expect(unpublished.status()).toBe(404);
  expect(await unpublished.text()).toBe(await unknown.text());

  const pyqWithoutRights = createFixture({
    text: `E2E share PYQ ${stamp}: which option is Alpha?`,
    year: 2024,
    rightsOk: 0,
  });
  expect((await request.get(pyqWithoutRights.path)).status()).toBe(404);
});

test("attempted-only reveal blocks guests and in-progress users, then unlocks after submit", async ({
  page,
  request,
}) => {
  const stamp = uniqueStamp();
  const explanation = `E2E-REVEAL-EXPLANATION-${stamp}`;
  const fixture = createFixture({
    text: `E2E share reveal ${stamp}: which option is Gamma?`,
    correctOption: 2,
    explanation,
  });
  const checkUrl = `/api/public-questions/${fixture.publicId}/check`;

  const guest = await request.post(checkUrl, { data: { option: 2 } });
  expect(guest.status()).toBe(403);
  const guestBody = (await guest.json()) as {
    ok: boolean;
    error: string;
    cta: { href: string; label: string } | null;
    correctOption?: number;
    explanationHtml?: string;
  };
  expect(guestBody.ok).toBe(false);
  expect(guestBody.correctOption).toBeUndefined();
  expect(JSON.stringify(guestBody)).not.toContain(explanation);
  expect(guestBody.cta?.href).toBeTruthy();

  const student = await signupStudent(page);

  const unrelated = await page.request.post(checkUrl, { data: { option: 2 } });
  expect(unrelated.status()).toBe(403);

  grantAttempt(student.email, fixture.id, "in_progress");
  const inProgress = await page.request.post(checkUrl, { data: { option: 2 } });
  expect(inProgress.status()).toBe(403);
  expect(JSON.stringify(await inProgress.json())).not.toContain(explanation);

  markAttemptSubmitted(student.email);
  const eligible = await page.request.post(checkUrl, { data: { option: 1 } });
  expect(eligible.status()).toBe(200);
  const eligibleBody = (await eligible.json()) as {
    ok: boolean;
    correct: boolean;
    correctOption: number;
    explanationHtml: string;
  };
  expect(eligibleBody.ok).toBe(true);
  expect(eligibleBody.correct).toBe(false);
  expect(eligibleBody.correctOption).toBe(2);
  expect(eligibleBody.explanationHtml).toContain(explanation);

  const pageResponse = await page.goto(fixture.path);
  expect(pageResponse?.status()).toBe(200);
  await expect(page.locator("[data-check-button]")).toBeVisible();
  await expect(page.getByText("Attempt the full mock to see the solution")).toHaveCount(0);
});

test("public reveal answers guests and search indexing follows every flag", async ({
  page,
  request,
}) => {
  const stamp = uniqueStamp();
  const explanation = `E2E-PUBLIC-EXPLANATION-${stamp}`;
  const fixture = createFixture({
    text: `E2E share public ${stamp}: which option is Gamma?`,
    correctOption: 2,
    explanation,
    revealPolicy: "public",
    rightsOk: 1,
    seoIndexable: 0,
  });
  const checkUrl = `/api/public-questions/${fixture.publicId}/check`;

  const guestCheck = await request.post(checkUrl, { data: { option: 2 } });
  expect(guestCheck.status()).toBe(200);
  const guestBody = (await guestCheck.json()) as {
    correct: boolean;
    correctOption: number;
    explanationHtml: string;
  };
  expect(guestBody.correct).toBe(true);
  expect(guestBody.correctOption).toBe(2);
  expect(guestBody.explanationHtml).toContain(explanation);

  const response = await page.goto(`${fixture.path}?ref=share`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  await expect(page.locator("[data-check-button]")).toBeVisible();
  const canonicalBefore = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonicalBefore).toBeTruthy();
  expect(canonicalBefore).not.toContain("ref=share");
  expect(canonicalBefore?.endsWith(fixture.path)).toBe(true);
  const structuredBefore = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(structuredBefore.join(" ")).not.toContain("BreadcrumbList");

  localD1(
    `UPDATE question_public_ids SET seo_indexable = 1 WHERE public_id = ${sqlString(fixture.publicId)}`,
  );
  await page.reload();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
  const structuredAfter = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(structuredAfter.join(" ")).toContain("BreadcrumbList");
  const canonicalAfter = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonicalAfter?.endsWith(fixture.path)).toBe(true);

  // Membership in a currently published ranked mock overrides the admin flag.
  const mockId = createPublishedMock(fixture.id, stamp);
  await page.reload();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "noindex, follow",
  );
  const blockedCheck = await request.post(checkUrl, { data: { option: 2 } });
  expect(blockedCheck.status()).toBe(403);

  // Soft-deleting the mock removes the override without touching the frozen
  // published version or its question membership.
  localD1(
    `UPDATE mock_tests SET deleted_at = '2026-01-01T00:00:00.000Z' WHERE id = ${mockId}`,
  );
  await page.reload();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );
});

test("only fully eligible shared questions enter the sitemap and get an OG image", async ({
  page,
  request,
}) => {
  test.slow();
  const stamp = uniqueStamp();
  const fixture = createFixture({
    text: `E2E sitemap eligible ${stamp}: which option is Alpha?`,
    revealPolicy: "public",
    rightsOk: 1,
    seoIndexable: 1,
  });
  const notIndexable = createFixture({
    text: `E2E sitemap off ${stamp}: which option is Beta?`,
    revealPolicy: "public",
    rightsOk: 1,
    seoIndexable: 0,
  });
  const attemptedOnly = createFixture({
    text: `E2E sitemap attempted ${stamp}: which option is Gamma?`,
    revealPolicy: "attempted_only",
    rightsOk: 1,
    seoIndexable: 1,
  });
  const inPublishedMock = createFixture({
    text: `E2E sitemap mock ${stamp}: which option is Delta?`,
    revealPolicy: "public",
    rightsOk: 1,
    seoIndexable: 1,
  });
  createPublishedMock(inPublishedMock.id, stamp);

  const sitemapResponse = await request.get("/sitemap.xml");
  expect(sitemapResponse.status()).toBe(200);
  const sitemap = await sitemapResponse.text();
  expect(sitemap).toContain(fixture.path);
  for (const excluded of [notIndexable, attemptedOnly, inPublishedMock]) {
    expect(sitemap).not.toContain(excluded.path);
    expect(sitemap).not.toContain(excluded.publicId);
  }

  // The image is generated offline by the script, not by the Worker.
  execFileSync(
    process.execPath,
    [path.resolve("scripts/generate-question-og.mjs"), "--local", `--id=${fixture.publicId}`],
    { cwd: process.cwd(), stdio: "pipe", timeout: 180_000 },
  );
  const imageFile = path.resolve("public", "og", "questions", `${fixture.publicId}.png`);
  expect(existsSync(imageFile)).toBe(true);
  const dimensions = pngDimensions(imageFile);
  expect(dimensions).toEqual({ width: 1200, height: 630 });

  const response = await page.goto(`${fixture.path}?ref=share`);
  expect(response?.status()).toBe(200);
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
    "content",
    "index, follow",
  );

  const canonical = await page.locator('link[rel="canonical"]').getAttribute("href");
  expect(canonical?.endsWith(fixture.path)).toBe(true);
  expect(canonical).not.toContain("ref=share");

  const ogImage = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(ogImage).toBe(
    new URL(`/og/questions/${fixture.publicId}.png`, page.url()).toString(),
  );
  const structured = (
    await page.locator('script[type="application/ld+json"]').allTextContents()
  ).join(" ");
  expect(structured).toContain("BreadcrumbList");
  expect(structured).not.toContain(fixture.explanation);

  const imageResponse = await request.get(`/og/questions/${fixture.publicId}.png`);
  expect(imageResponse.status()).toBe(200);
  expect(imageResponse.headers()["content-type"]).toContain("image/png");
  expect((await imageResponse.body()).subarray(1, 4).toString("ascii")).toBe("PNG");

  // Everything else keeps the branded generic preview.
  await page.goto(notIndexable.path);
  const fallback = await page.locator('meta[property="og:image"]').getAttribute("content");
  expect(fallback?.endsWith("/logo.png")).toBe(true);
});

test("a revision keeps the public id and serves the latest published revision", async ({
  page,
  request,
}) => {
  const stamp = uniqueStamp();
  const publishedText = `E2E revision published ${stamp}: which option is Alpha?`;
  const draftText = `E2E revision draft ${stamp}: which option is Beta?`;
  const fixture = createFixture({ text: publishedText, correctOption: 0 });

  const revisionId = createRevision({
    text: draftText,
    supersedesId: fixture.id,
    status: "draft",
  });
  const pointer = localD1Rows<{ current_question_id: number }>(
    `SELECT current_question_id FROM question_public_ids
     WHERE public_id = ${sqlString(fixture.publicId)}`,
  );
  expect(pointer[0]?.current_question_id).toBe(revisionId);

  const baseResponse = await page.goto(fixture.path);
  expect(baseResponse?.status()).toBe(200);
  await expect(page.locator("article h1")).toContainText(publishedText);
  expect(await page.content()).not.toContain(draftText);

  const draftSlug = questionSharePath(fixture.publicId, draftText);
  const redirect = await request.get(draftSlug, { maxRedirects: 0 });
  expect(redirect.status()).toBe(301);
  expect(canonicalPathFromRedirect(redirect.headers().location ?? "")).toBe(fixture.path);

  localD1(`UPDATE questions SET status = 'published' WHERE id = ${revisionId}`);

  const revisionPath = questionSharePath(fixture.publicId, draftText);
  const publishedResponse = await page.goto(fixture.path);
  expect(publishedResponse?.status()).toBe(200);
  expect(new URL(page.url()).pathname).toBe(revisionPath);
  await expect(page.locator("article h1")).toContainText(draftText);
  expect(await page.content()).not.toContain(publishedText);

  const api = await request.get(`/api/public-questions/${fixture.publicId}`);
  expect(api.status()).toBe(200);
  const body = (await api.json()) as { question: { text: string } };
  expect(body.question.text).toBe(draftText);
});

function pngDimensions(filePath: string): { width: number; height: number } {
  const bytes = readFileSync(filePath);
  expect(bytes.subarray(1, 4).toString("ascii")).toBe("PNG");
  return {
    width: bytes.readUInt32BE(16),
    height: bytes.readUInt32BE(20),
  };
}

test("the share sheet generates a PNG and withholds the answer until toggled", async ({
  page,
}) => {
  const stamp = uniqueStamp();
  const explanation = `E2E-SHARE-CARD-ANSWER-${stamp}`;
  const fixture = createFixture({
    text: `E2E share card ${stamp}: which option is Gamma?`,
    correctOption: 2,
    explanation,
  });
  const student = await signupStudent(page);
  grantAttempt(student.email, fixture.id, "submitted");

  await page.goto(fixture.path);
  await page.locator("[data-share-trigger]").click();

  const dialog = page.locator("[data-share-dialog]");
  await expect(dialog).toBeVisible();
  const preview = page.locator("[data-share-preview]");
  await expect(preview).toBeVisible({ timeout: 60_000 });

  const dimensions = await preview.evaluate((image: HTMLImageElement) => ({
    width: image.naturalWidth,
    height: image.naturalHeight,
  }));
  expect([1080, 2160]).toContain(dimensions.width);
  expect(dimensions.height).toBeGreaterThanOrEqual(1080);
  expect(dimensions.height).toBeLessThanOrEqual(3840);

  // A blank first render (a known iOS Safari failure) would leave this at 0.
  const inkPixels = await preview.evaluate((image: HTMLImageElement) => {
    const canvas = document.createElement("canvas");
    canvas.width = 60;
    canvas.height = 60;
    const context = canvas.getContext("2d");
    if (!context) return -1;
    context.drawImage(image, 0, 0, 60, 60);
    const pixels = context.getImageData(0, 0, 60, 60).data;
    let ink = 0;
    for (let index = 0; index < pixels.length; index += 4) {
      if (
        pixels[index]! < 245 ||
        pixels[index + 1]! < 245 ||
        pixels[index + 2]! < 245
      ) {
        ink += 1;
      }
    }
    return ink;
  });
  expect(inkPixels).toBeGreaterThan(0);

  const card = page.locator("[data-share-card]");
  await expect(card).toContainText(`cuetfreemocktest.com/q/${fixture.publicId}`);
  await expect(card).toContainText("Free CUET mock tests");
  await expect(card).toContainText("Gamma is the answer");
  expect(await card.innerText()).not.toContain(explanation);
  expect(await card.innerText()).not.toContain(student.email);
  expect(await card.innerText()).not.toContain("SharePass123!");

  await page.locator("[data-share-answer-toggle]").check();
  await expect(card.locator("[data-share-answer]")).toBeVisible();
  await expect(card).toContainText(explanation);
  await expect(card.locator("[data-share-option='2']")).toHaveClass(/is-correct/);
  await expect(preview).toBeVisible({ timeout: 60_000 });

  const downloadPromise = page.waitForEvent("download");
  await page.locator("[data-share-download]").click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`cuet-question-${fixture.publicId}.png`);
  const filePath = await download.path();
  if (!filePath) throw new Error("The share image download produced no file.");
  const png = pngDimensions(filePath);
  expect([1080, 2160]).toContain(png.width);
  expect(png.height).toBeGreaterThanOrEqual(1080);
  expect(png.height).toBeLessThanOrEqual(3840);
});

test("guests cannot include an answer in the share image", async ({ page }) => {
  const stamp = uniqueStamp();
  const explanation = `E2E-SHARE-GUEST-ANSWER-${stamp}`;
  const fixture = createFixture({
    text: `E2E share card guest ${stamp}: which option is Alpha?`,
    correctOption: 0,
    explanation,
  });

  const response = await page.goto(fixture.path);
  expect(response?.status()).toBe(200);
  const html = (await response?.text()) ?? "";
  expect(html).not.toContain(explanation);
  expect(html).not.toContain("Correct answer:");

  await expect(page.locator("[data-share-answer-toggle]")).not.toBeVisible();
  await page.locator("[data-share-trigger]").click();
  await expect(page.locator("[data-share-preview]")).toBeVisible({ timeout: 60_000 });

  const card = page.locator("[data-share-card]");
  expect(await card.innerText()).not.toContain(explanation);
  await expect(card.locator("[data-share-answer]")).toHaveCount(0);
});

test("the share card renders Hindi, KaTeX and question images in the light palette", async ({
  page,
}) => {
  const stamp = uniqueStamp();
  const fixture = createFixture({
    text: `E2E share card maths ${stamp}: solve $x^2 + 1 = 0$.`,
    textHi: `E2E हिंदी कार्ड ${stamp}: हल करें $x^2 + 1 = 0$।`,
    options: ["Alpha", "Beta", "Gamma", "Delta"],
    optionsHi: ["अल्फा", "बीटा", "गामा", "डेल्टा"],
    correctOption: 1,
    explanation: `E2E-SHARE-CARD-HINDI-${stamp}`,
    imageUrl: "/logo.png",
    imageAlt: "CUET logo",
  });

  await page.goto(fixture.path);
  await page.locator('[data-lang-button="hi"]').click();
  await expect(page.locator('[data-lang-button="hi"]')).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  await page.locator("[data-share-trigger]").click();
  await expect(page.locator("[data-share-preview]")).toBeVisible({ timeout: 60_000 });

  const card = page.locator("[data-share-card]");
  const hindiQuestion = card.locator('[data-share-question] [data-share-lang="hi"]');
  await expect(hindiQuestion).toBeVisible();
  await expect(hindiQuestion).toContainText("हिंदी");
  await expect(hindiQuestion.locator(".katex").first()).toBeVisible();

  const questionImage = card.locator("img[data-share-image]");
  await expect(questionImage).toBeVisible();
  expect(
    await questionImage.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);

  await page.evaluate(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });
  const background = await card.evaluate(
    (node) => getComputedStyle(node).backgroundColor,
  );
  expect(background).toBe("rgb(255, 255, 255)");
  await expect(card).toContainText(`cuetfreemocktest.com/q/${fixture.publicId}`);
});

test("a very long question truncates but keeps the link visible", async ({ page }) => {
  const stamp = uniqueStamp();
  const fixture = createFixture({
    text: `E2E share long ${stamp}: ${"This is a deliberately long question sentence. ".repeat(160)}`,
    correctOption: 0,
  });

  await page.goto(fixture.path);
  await page.locator("[data-share-trigger]").click();
  await expect(page.locator("[data-share-preview]")).toBeVisible({ timeout: 60_000 });

  const card = page.locator("[data-share-card]");
  const height = await card.evaluate((node) => node.getBoundingClientRect().height);
  expect(height).toBe(1920);
  await expect(page.locator("[data-share-truncated]")).toBeVisible();
  await expect(page.locator("[data-share-truncated]")).toContainText(
    "Read the full question at the link.",
  );
  await expect(card).toContainText(`cuetfreemocktest.com/q/${fixture.publicId}`);
  await expect(card).toContainText("Free CUET mock tests");
});

test("native share, WhatsApp, Telegram and copy use the canonical URL", async ({
  page,
  context,
}) => {
  const stamp = uniqueStamp();
  const fixture = createFixture({
    text: `E2E share fallbacks ${stamp}: which option is Beta?`,
    correctOption: 1,
    revealPolicy: "public",
    rightsOk: 1,
  });

  await page.addInitScript(() => {
    const calls: Array<{
      text?: string;
      title?: string;
      files: Array<{ name: string; type: string; size: number }>;
    }> = [];
    (window as unknown as { __shareCalls: typeof calls }).__shareCalls = calls;
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: {
        text?: string;
        title?: string;
        files?: File[];
      }) => {
        calls.push({
          text: data.text,
          title: data.title,
          files: (data.files ?? []).map((file) => ({
            name: file.name,
            type: file.type,
            size: file.size,
          })),
        });
      },
    });
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => true,
    });
  });

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(fixture.path);
  await page.locator("[data-share-trigger]").click();
  await expect(page.locator("[data-share-preview]")).toBeVisible({ timeout: 60_000 });

  await page.locator("[data-share-native]").click();
  const calls = await page.evaluate(
    () => (window as unknown as { __shareCalls: unknown[] }).__shareCalls,
  );
  expect(calls).toHaveLength(1);
  const fileCall = calls[0] as {
    text: string;
    title: string;
    files: Array<{ name: string; type: string; size: number }>;
  };
  expect(fileCall.files).toHaveLength(1);
  expect(fileCall.files[0]?.name).toBe(`cuet-question-${fixture.publicId}.png`);
  expect(fileCall.files[0]?.type).toBe("image/png");
  expect(fileCall.files[0]?.size).toBeGreaterThan(0);
  expect(fileCall.text).toContain("Can you solve this CUET question?");
  expect(fileCall.text).toContain(fixture.path);
  expect(fileCall.title).toBe("Can you solve this CUET question?");

  await page.evaluate(() => {
    Object.defineProperty(navigator, "canShare", {
      configurable: true,
      value: () => false,
    });
  });
  await page.locator("[data-share-native]").click();
  const secondCall = await page.evaluate(
    () =>
      (window as unknown as { __shareCalls: Array<{ files: unknown[] }> })
        .__shareCalls[1],
  );
  expect(secondCall?.files).toEqual([]);

  const whatsapp = await page
    .locator("[data-share-whatsapp]")
    .getAttribute("href");
  expect(whatsapp).toContain("https://wa.me/?text=");
  expect(decodeURIComponent(whatsapp ?? "")).toContain(fixture.path);
  const telegram = await page
    .locator("[data-share-telegram]")
    .getAttribute("href");
  const telegramUrl = new URL(telegram ?? "");
  expect(telegramUrl.searchParams.get("url")).toContain(fixture.path);
  expect(telegramUrl.searchParams.get("text")).toBe(
    "Can you solve this CUET question?",
  );

  await page.locator("[data-share-copy]").click();
  await expect(page.locator("[data-share-status]")).toContainText("Link copied.");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboard).toContain(fixture.path);

  await page.evaluate(() => {
    document.dispatchEvent(
      new CustomEvent("share:language", { detail: "hi" }),
    );
  });
  const hindiWhatsapp = await page
    .locator("[data-share-whatsapp]")
    .getAttribute("href");
  expect(decodeURIComponent(hindiWhatsapp ?? "")).toContain(
    "क्या आप यह CUET प्रश्न हल कर सकते हैं?",
  );
});

test("the share sheet traps focus and closes with Escape", async ({ page }) => {
  const stamp = uniqueStamp();
  const fixture = createFixture({
    text: `E2E share keyboard ${stamp}: which option is Alpha?`,
    correctOption: 0,
  });

  await page.goto(fixture.path);
  const trigger = page.locator("[data-share-trigger]");
  await trigger.click();

  const dialog = page.locator("[data-share-dialog]");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("dialog")).toHaveAttribute("aria-modal", "true");
  await expect(page.locator("[data-share-close]")).toBeFocused();

  // Tabbing from the last control wraps back to the close button.
  await page.locator("[data-share-download]").focus();
  await page.keyboard.press("Tab");
  await expect(page.locator("[data-share-close]")).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveAttribute("aria-expanded", "false");
});

test("a failed image render falls back to the link options", async ({
  page,
  context,
}) => {
  const stamp = uniqueStamp();
  const fixture = createFixture({
    text: `E2E share failure ${stamp}: which option is Delta?`,
    correctOption: 3,
  });

  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      ...args: Parameters<HTMLCanvasElement["getContext"]>
    ) {
      if (args[0] === "2d") return null;
      return original.apply(this, args);
    } as HTMLCanvasElement["getContext"];
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);

  await page.goto(fixture.path);
  await page.locator("[data-share-trigger]").click();
  await expect(page.locator("[data-share-error]")).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("[data-share-error]")).toContainText(
    "Could not create the image",
  );
  await expect(page.locator("[data-share-preview]")).not.toBeVisible();
  await expect(page.locator("[data-share-copy]")).toBeVisible();

  await page.locator("[data-share-copy]").click();
  await expect(page.locator("[data-share-status]")).toContainText("Link copied.");
});

test("solutions pages share the canonical question link after submission", async ({
  page,
  context,
}) => {
  const stamp = uniqueStamp();
  const fixture = createFixture({
    text: `E2E solutions share ${stamp}: which option is Alpha?`,
    correctOption: 0,
    explanation: `E2E-SOLUTION-EXPLANATION-${stamp}`,
  });
  const mockId = createPublishedMock(fixture.id, stamp);
  const headers = { "cf-connecting-ip": testClientIp() };

  const started = await page.request.post("/api/attempts/start", {
    headers,
    data: { mockId },
  });
  expect(started.status()).toBe(201);
  const { attemptId } = (await started.json()) as { attemptId: number };
  expect(attemptId).toBeGreaterThan(0);

  const submitted = await page.request.post(`/api/attempts/${attemptId}/submit`, {
    headers,
    data: {},
  });
  expect(submitted.status()).toBe(200);

  const response = await page.goto(`/result/${attemptId}/solutions`);
  expect(response?.status()).toBe(200);

  const article = page.locator("article").filter({ hasText: fixture.text }).first();
  await expect(article).toBeVisible();
  const sheet = article.locator("[data-share-sheet]");
  await expect(sheet).toHaveAttribute("data-share-context", "solutions");
  await expect(sheet).toHaveAttribute(
    "data-share-url",
    new URL(fixture.path, page.url()).toString(),
  );

  await article.getByRole("button", { name: "Share question" }).click();
  const dialog = article.locator("[data-share-dialog]");
  await expect(dialog).toBeVisible();

  const toggle = dialog.locator("[data-share-answer-toggle]");
  await expect(toggle).not.toBeChecked();
  await expect(dialog.locator("[data-share-answer]")).toBeHidden();

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const eventResponse = page.waitForResponse(
    (res) => res.url().endsWith("/api/share-events") && res.request().method() === "POST",
  );
  await dialog.locator("[data-share-copy]").click();
  expect((await eventResponse).status()).toBe(202);
  await expect(dialog.locator("[data-share-status]")).toContainText("Link copied.");

  await expect
    .poll(() =>
      localD1Rows<{ context: string; channel: string }>(
        `SELECT context, channel FROM share_events
         WHERE public_id = ${sqlString(fixture.publicId)}`,
      ),
    )
    .toEqual([{ context: "solutions", channel: "copy" }]);
});

test("live attempts share only the mock link and keep the timer and autosave running", async ({
  page,
  context,
}) => {
  const stamp = uniqueStamp();
  const fixture = createFixture({
    text: `E2E live attempt share ${stamp}: which option is Beta?`,
    correctOption: 1,
  });
  const mockId = createPublishedMock(fixture.id, stamp);
  const headers = { "cf-connecting-ip": testClientIp() };

  const started = await page.request.post("/api/attempts/start", {
    headers,
    data: { mockId },
  });
  expect(started.status()).toBe(201);
  const { attemptId } = (await started.json()) as { attemptId: number };
  const timer = page.locator("#timer");

  // The setting is global D1 state; pin it so the first assertion does not
  // depend on whatever an earlier local run left behind.
  setAttemptShareSetting("false");
  await page.goto(`/attempt/${attemptId}`);
  await expect(page.locator("[data-mock-share-trigger]")).toHaveCount(0);

  setAttemptShareSetting("true");
  await page.reload();
  await expect(timer).not.toHaveText("--:--:--");
  const trigger = page.locator("[data-mock-share-trigger]");
  await expect(trigger).toBeVisible();
  await trigger.click();

  const dialog = page.locator("[data-mock-share-dialog]");
  await expect(dialog).toBeVisible();
  const dialogText = await dialog.innerText();
  expect(dialogText).not.toContain(fixture.text);
  for (const option of fixture.options) expect(dialogText).not.toContain(option);
  await expect(dialog.locator("img")).toHaveCount(0);

  const whatsapp = await dialog.locator("[data-mock-share-whatsapp]").getAttribute("href");
  expect(decodeURIComponent(whatsapp ?? "")).toContain(
    `/mock/e2e-share-mock-${stamp}/instructions`,
  );
  expect(whatsapp ?? "").not.toContain("/q/");

  await expect(timer).not.toHaveText("--:--:--");
  const before = ((await timer.textContent()) ?? "").trim();
  await expect
    .poll(async () => ((await timer.textContent()) ?? "").trim(), { timeout: 5_000 })
    .not.toBe(before);

  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const eventResponse = page.waitForResponse(
    (res) => res.url().endsWith("/api/share-events") && res.request().method() === "POST",
  );
  await dialog.locator("[data-mock-share-copy]").click();
  expect((await eventResponse).status()).toBe(202);
  await expect(dialog.locator("[data-mock-share-status]")).toContainText("Link copied.");

  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();

  setAttemptShareSetting("false");
  await page.reload();
  await expect(page.locator("[data-mock-share-trigger]")).toHaveCount(0);
  // The option buttons exist in the server HTML before the island hydrates, so
  // wait for the timer to leave its SSR placeholder before clicking an answer.
  await expect(timer).not.toHaveText("--:--:--");

  const saveResponse = page.waitForResponse((res) => {
    if (
      !res.url().includes(`/api/attempts/${attemptId}/answers`) ||
      res.request().method() !== "PUT"
    ) {
      return false;
    }
    const body = res.request().postData() ?? "";
    return body.includes(`"question_id":${fixture.id}`) && body.includes('"selected":0');
  });
  await page.locator('#question-area [data-option="0"]').click();
  expect((await saveResponse).status()).toBe(200);

  await expect
    .poll(() =>
      localD1Rows<{ selected: number }>(
        `SELECT selected FROM attempt_answers
         WHERE attempt_id = ${attemptId} AND question_id = ${fixture.id}`,
      ),
    )
    .toEqual([{ selected: 0 }]);

  await expect
    .poll(() =>
      localD1Rows<{ public_id: string | null; context: string; channel: string }>(
        `SELECT public_id, context, channel FROM share_events WHERE mock_id = ${mockId}`,
      ),
    )
    .toEqual([{ public_id: null, context: "attempt", channel: "copy" }]);
});

test("share-event API rejects missing, unknown and live-attempt question events", async ({
  request,
}) => {
  const headers = { "cf-connecting-ip": testClientIp() };
  const missingIdentifier = await request.post("/api/share-events", {
    headers,
    data: { context: "public_page", channel: "copy" },
  });
  expect(missingIdentifier.status()).toBe(400);

  const attemptWithoutMock = await request.post("/api/share-events", {
    headers,
    data: { context: "attempt", channel: "copy" },
  });
  expect(attemptWithoutMock.status()).toBe(400);

  const unknownQuestion = await request.post("/api/share-events", {
    headers,
    data: { publicId: generatePublicId(), context: "public_page", channel: "copy" },
  });
  expect(unknownQuestion.status()).toBe(404);

  const unknownMock = await request.post("/api/share-events", {
    headers,
    data: { mockId: 987654321, context: "attempt", channel: "copy" },
  });
  expect(unknownMock.status()).toBe(404);

  const questionDuringAttempt = await request.post("/api/share-events", {
    headers,
    data: {
      publicId: generatePublicId(),
      mockId: 987654321,
      context: "attempt",
      channel: "copy",
    },
  });
  expect(questionDuringAttempt.status()).toBe(400);
});

test("the public-page copy fallback records a public-page event", async ({
  page,
  context,
}) => {
  const stamp = uniqueStamp();
  const fixture = createFixture({
    text: `E2E public copy ${stamp}: which option is Gamma?`,
    correctOption: 2,
  });
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto(fixture.path);

  const eventResponse = page.waitForResponse(
    (res) => res.url().endsWith("/api/share-events") && res.request().method() === "POST",
  );
  await page.locator("[data-copy-link]").click();
  expect((await eventResponse).status()).toBe(202);
  await expect(page.locator("[data-copy-status]")).toHaveText("Link copied");

  await expect
    .poll(() =>
      localD1Rows<{ context: string; channel: string }>(
        `SELECT context, channel FROM share_events
         WHERE public_id = ${sqlString(fixture.publicId)}`,
      ),
    )
    .toEqual([{ context: "public_page", channel: "copy" }]);
});

type AxeViolation = {
  id: string;
  impact: string | null;
  help: string;
  nodes: Array<{ target: string[] }>;
};

async function axeViolations(page: Page): Promise<AxeViolation[]> {
  return page.evaluate(async (tags) => {
    const axe = (
      window as unknown as {
        axe: {
          run: (
            context: Document,
            options: unknown,
          ) => Promise<{ violations: AxeViolation[] }>;
        };
      }
    ).axe;
    const results = await axe.run(document, {
      runOnly: { type: "tag", values: tags },
    });
    return results.violations.map((violation) => ({
      id: violation.id,
      impact: violation.impact,
      help: violation.help,
      nodes: violation.nodes.map((node) => ({ target: node.target })),
    }));
  }, WCAG_TAGS);
}

async function auditShareThemes(page: Page, surface: string): Promise<void> {
  for (const theme of ["light", "dark"]) {
    await page.evaluate((mode) => {
      document.documentElement.setAttribute("data-theme", mode);
    }, theme);
    // The cards use a 150ms color transition; let computed colors settle.
    await page.waitForTimeout(300);
    const violations = await axeViolations(page);
    expect(violations, `${surface} in ${theme} theme`).toEqual([]);
  }
  await page.evaluate(() => document.documentElement.removeAttribute("data-theme"));
}

test("the public page and share sheet pass axe in light and dark themes", async ({ page }) => {
  test.slow();
  const stamp = uniqueStamp();
  const fixture = createFixture({
    text: `E2E axe share ${stamp}: which option is Gamma?`,
    revealPolicy: "public",
    rightsOk: 1,
    seoIndexable: 1,
  });

  const response = await page.goto(fixture.path);
  expect(response?.status()).toBe(200);
  await page.addScriptTag({ path: AXE_PATH });
  await auditShareThemes(page, "public question page");

  await page.locator("[data-share-trigger]").click();
  await expect(page.locator("[data-share-dialog]")).toBeVisible();
  await expect(page.locator("[data-share-dialog]")).toHaveAttribute("aria-hidden", "false");
  await auditShareThemes(page, "share sheet");

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-share-dialog]")).toBeHidden();
});
