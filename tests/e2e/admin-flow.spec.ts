import { execFileSync } from "node:child_process";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const WRANGLER_BIN = path.resolve("node_modules/wrangler/bin/wrangler.js");
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL ?? "admin@cuetfreemocktest.com";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "AdminPass123!";

function testClientIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
}

/** Runs SQL against the same local D1 file the dev server uses. */
function localD1(sql: string): void {
  execFileSync(
    process.execPath,
    [
      WRANGLER_BIN,
      "d1",
      "execute",
      "cuet-blueprint-db",
      "--local",
      "--command",
      sql,
    ],
    { cwd: process.cwd(), stdio: "pipe", timeout: 120_000 },
  );
}

async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto("/login?next=%2Fadmin");
  await page.getByLabel("Email").fill(ADMIN_EMAIL);
  await page.getByLabel("Password").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL(/\/admin/);
}

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": testClientIp() });
});

test("an editor creates, publishes and sees a mock test", async ({ page }) => {
  test.slow();
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test writes a QA mock into the local D1 database.",
  );

  await loginAsAdmin(page);
  await page.goto("/admin/mocks/new");

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const title = `E2E publish check ${stamp}`;

  await page.locator('[data-field="title"]').fill(title);
  await expect(page.locator('[data-field="slug"]')).toHaveValue(/e2e-publish-check/);
  await page.locator("#section-order").fill("General Test, Language");
  await page.locator("[data-question-checkbox]").first().check();
  await page.getByRole("button", { name: "Create mock" }).click();
  await page.waitForURL(/\/admin\/mocks\/\d+$/);

  const mockId = Number(page.url().match(/\/admin\/mocks\/(\d+)$/)?.[1]);
  expect(mockId).toBeGreaterThan(0);
  const slug = await page.locator('[data-field="slug"]').inputValue();

  try {
    await expect(page.getByText("not published yet")).toBeVisible();

    const preview = await page.request.get(`/admin/mocks/${mockId}/preview`);
    expect(preview.status()).toBe(200);
    const previewHtml = await preview.text();
    expect(previewHtml).toContain(title);
    expect(previewHtml).toContain("Correct options, answer keys and explanations are intentionally hidden.");
    expect(previewHtml).not.toContain("Correct answer</span>");

    // Publish through the builder, which is the same validated server path
    // used by the explicit publish endpoint.
    await page.locator('[data-field="status"]').selectOption("published");
    await page.getByRole("button", { name: "Save mock" }).click();
    await expect(
      page.getByText("Published versions are immutable. The public site continues to serve"),
    ).toBeVisible({ timeout: 15_000 });

    const response = await page.goto(`/mock/${slug}`);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
  } finally {
    // Keep repeated local runs from adding another public mock.
    localD1(`UPDATE mock_tests SET status = 'archived' WHERE id = ${mockId}`);
  }
});

test("an editor copies a public link and toggles sharing", async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test writes sharing flags into the local D1 database.",
  );

  await loginAsAdmin(page);

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const created = await page.request.post("/api/admin/questions", {
    data: {
      subject_id: 1,
      text: `E2E sharing toggle ${stamp}: which option is correct?`,
      options: [{ text: "Option A" }, { text: "Option B" }],
      correct_option: 0,
      explanation: "Option A is correct because this is a fixture.",
      status: "published",
    },
  });
  expect(created.status()).toBe(201);
  const questionId = Number(((await created.json()) as { id: number }).id);
  expect(questionId).toBeGreaterThan(0);

  try {
    await page.goto(`/admin/questions/${questionId}`);

    const panel = page.locator("[data-share-panel]");
    await expect(panel).toBeVisible();
    const pathInput = panel.locator("[data-share-path]");
    const publicPath = await pathInput.inputValue();
    expect(publicPath).toMatch(/^\/q\/[a-z0-9-]+-[0-9A-Za-z]{10}$/);
    expect(publicPath.endsWith(`-${questionId}`)).toBe(false);

    await panel.getByRole("button", { name: "Copy link" }).click();
    await expect(panel.locator("[data-copy-status]")).toContainText("Copied");

    const shareBox = panel.locator('[data-share-field="share_enabled"]');
    const original = await shareBox.isChecked();
    try {
      if (original) await shareBox.uncheck();
      else await shareBox.check();
      await panel.getByRole("button", { name: "Save sharing settings" }).click();
      await expect(panel.locator("[data-share-status]")).toContainText("Saved", { timeout: 10_000 });
      const reloaded = page.locator('[data-share-panel] [data-share-field="share_enabled"]');
      await expect(reloaded).toBeVisible({ timeout: 10_000 });
      await expect
        .poll(async () => reloaded.isChecked(), { timeout: 10_000 })
        .toBe(!original);
    } finally {
      await page.request.patch(`/api/admin/questions/${questionId}/share`, {
        data: { share_enabled: original },
      });
    }
  } finally {
    await page.request.delete(`/api/admin/questions/${questionId}`);
  }
});

test("question creation and revisions keep one public id and enforce indexing rules", async ({
  page,
}) => {
  test.slow();
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test writes questions into the local D1 database.",
  );

  await loginAsAdmin(page);
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const text = `E2E share lifecycle ${stamp}: which option is correct?`;
  const payload = {
    subject_id: 1,
    text,
    text_hi: null,
    options: [{ text: "Option A" }, { text: "Option B" }],
    correct_option: 0,
    explanation: "Option A is correct because this is a fixture.",
    difficulty: null,
    year: null,
    status: "draft",
  };

  const created = await page.request.post("/api/admin/questions", { data: payload });
  expect(created.status()).toBe(201);
  const createdBody = (await created.json()) as { id: number };
  const questionId = createdBody.id;
  let revisionId: number | null = null;

  try {
    const first = await page.request.get(`/api/admin/questions/${questionId}/share`);
    expect(first.status()).toBe(200);
    const firstShare = (await first.json()) as {
      share: {
        publicId: string;
        path: string;
        flags: { shareEnabled: boolean; seoIndexable: boolean; rightsOk: boolean };
      };
    };
    expect(firstShare.share.publicId).toMatch(/^[0-9A-Za-z]{10}$/);
    expect(firstShare.share.path.endsWith(`-${firstShare.share.publicId}`)).toBe(true);
    expect(firstShare.share.flags.shareEnabled).toBe(true);
    expect(firstShare.share.flags.rightsOk).toBe(false);

    const blocked = await page.request.patch(
      `/api/admin/questions/${questionId}/share`,
      { data: { seo_indexable: true } },
    );
    expect(blocked.status()).toBe(422);
    expect(await blocked.text()).toMatch(/rights/i);

    const published = await page.request.patch(`/api/admin/questions/${questionId}`, {
      data: { ...payload, status: "published" },
    });
    expect(published.ok()).toBeTruthy();

    const allowed = await page.request.patch(`/api/admin/questions/${questionId}/share`, {
      data: { rights_ok: true, reveal_policy: "public", seo_indexable: true },
    });
    expect(allowed.ok()).toBeTruthy();
    const allowedBody = (await allowed.json()) as {
      share: { flags: { seoIndexable: boolean; revealPolicy: string } };
    };
    expect(allowedBody.share.flags.seoIndexable).toBe(true);
    expect(allowedBody.share.flags.revealPolicy).toBe("public");

    const edited = await page.request.patch(`/api/admin/questions/${questionId}`, {
      data: { ...payload, text: `${text} (revised)`, status: "draft" },
    });
    expect(edited.ok()).toBeTruthy();
    const editedBody = (await edited.json()) as { superseded?: boolean; id: number };
    expect(editedBody.superseded).toBe(true);
    revisionId = editedBody.id;

    const revised = await page.request.get(`/api/admin/questions/${revisionId}/share`);
    expect(revised.status()).toBe(200);
    const revisedShare = (await revised.json()) as {
      share: { publicId: string; currentQuestionId: number };
    };
    expect(revisedShare.share.publicId).toBe(firstShare.share.publicId);
    expect(revisedShare.share.currentQuestionId).toBe(revisionId);
  } finally {
    await page.request.delete(`/api/admin/questions/${questionId}`);
    if (revisionId) await page.request.delete(`/api/admin/questions/${revisionId}`);
  }
});

test("PYQ questions stay off until rights are confirmed", async ({ page }) => {
  test.slow();
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test writes questions into the local D1 database.",
  );

  await loginAsAdmin(page);
  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const created = await page.request.post("/api/admin/questions", {
    data: {
      subject_id: 1,
      text: `E2E PYQ rights ${stamp}: which option is correct?`,
      options: [{ text: "Option A" }, { text: "Option B" }],
      correct_option: 0,
      explanation: "Printed key.",
      year: 2024,
      status: "draft",
    },
  });
  expect(created.status()).toBe(201);
  const questionId = Number(((await created.json()) as { id: number }).id);

  try {
    const share = await page.request.get(`/api/admin/questions/${questionId}/share`);
    const body = (await share.json()) as {
      share: { isPyq: boolean; flags: { shareEnabled: boolean } };
    };
    expect(body.share.isPyq).toBe(true);
    expect(body.share.flags.shareEnabled).toBe(false);

    const blocked = await page.request.patch(
      `/api/admin/questions/${questionId}/share`,
      { data: { share_enabled: true } },
    );
    expect(blocked.status()).toBe(422);
    expect(await blocked.text()).toMatch(/rights/i);

    const allowed = await page.request.patch(
      `/api/admin/questions/${questionId}/share`,
      { data: { rights_ok: true, share_enabled: true } },
    );
    expect(allowed.ok()).toBeTruthy();
    const allowedBody = (await allowed.json()) as {
      share: { flags: { shareEnabled: boolean; rightsOk: boolean } };
    };
    expect(allowedBody.share.flags.shareEnabled).toBe(true);
    expect(allowedBody.share.flags.rightsOk).toBe(true);
  } finally {
    await page.request.delete(`/api/admin/questions/${questionId}`);
  }
});

test("an editor saves a canonical URL and the public page renders it", async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test writes and removes a page_seo row in the local D1 database.",
  );

  await loginAsAdmin(page);
  const canonical = `https://cuetfreemocktest.com/e2e-canonical-${Date.now().toString(36)}`;

  try {
    await page.goto("/admin/seo?path=%2Fabout");
    await page.locator("#seo-canonical").fill(canonical);
    await page.getByRole("button", { name: "Save SEO record" }).click();
    await expect(page.locator("#seo-message")).toContainText("Saved.");

    const response = await page.request.get("/about");
    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(`<link rel="canonical" href="${canonical}">`);
  } finally {
    localD1("DELETE FROM page_seo WHERE path = '/about'");
  }
});

test("media upload rejects a file that only claims to be an image", async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test uses the local D1 admin account.",
  );

  await loginAsAdmin(page);
  const response = await page.request.post("/api/admin/media", {
    multipart: {
      file: {
        name: "spoof.png",
        mimeType: "image/png",
        buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
      },
      alt: "Spoofed upload",
    },
  });

  expect(response.status()).toBe(400);
  expect(await response.text()).toContain("Only PNG, JPEG and WebP images are allowed.");
});

test("media upload rejects a file above the 500 KB limit", async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test uses the local D1 admin account.",
  );

  await loginAsAdmin(page);
  const response = await page.request.post("/api/admin/media", {
    multipart: {
      file: {
        name: "large.png",
        mimeType: "image/png",
        buffer: Buffer.alloc(501 * 1024, 0),
      },
      alt: "Oversize upload",
    },
  });

  expect(response.status()).toBe(400);
  expect(await response.text()).toContain("Image is larger than 500 KB.");
});

test("an editor sees which previous-year papers need review", async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test uses the local D1 admin account.",
  );

  await loginAsAdmin(page);

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Review queue" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open review queue" })).toBeVisible();

  await page.goto("/admin/review");
  await expect(
    page.getByRole("heading", { name: "Previous-year review queue" }),
  ).toBeVisible();
  await expect(page.locator("#queue-heading")).toContainText("Papers needing review");
  await expect(page.getByRole("link", { name: "Review queue", exact: true })).toBeVisible();

  const detailLinks = page.locator('a[href^="/admin/review?paper="]');
  if ((await detailLinks.count()) === 0) {
    test.skip(true, "No papers currently pending in /admin/review queue (332 unkeyed questions reside in unconfirmed practice papers).");
    return;
  }

  await detailLinks.first().click();
  await expect(page).toHaveURL(/\/admin\/review\?paper=/);
  await expect(page.locator("#detail-heading")).toBeVisible();
  await expect(page.getByRole("heading", { name: /Pending questions/ })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open paper" })).toHaveAttribute(
    "href",
    /^\/mock-tests\//,
  );

  const editPaper = page.getByRole("link", { name: "Edit paper" });
  const editQuestions = page.getByRole("link", { name: "Edit questions" });
  await expect(editPaper).toBeVisible();
  await expect(editQuestions).toBeVisible();

  const editPaperHref = await editPaper.getAttribute("href");
  expect(editPaperHref).toMatch(/^\/admin\/data\/practice_papers\/row\?id=\d+$/);
  const paperForm = await page.request.get(editPaperHref!);
  expect(paperForm.status()).toBe(200);
  expect(await paperForm.text()).toContain("publication_status");

  const editQuestionsHref = await editQuestions.getAttribute("href");
  expect(editQuestionsHref).toMatch(/^\/admin\/data\/practice_questions\?q=.+&per=100$/);
  expect((await page.request.get(editQuestionsHref!)).status()).toBe(200);

  const editQuestion = page
    .locator('a[href^="/admin/data/practice_questions/row?id="]')
    .first();
  await expect(editQuestion).toBeVisible();
  const editQuestionHref = await editQuestion.getAttribute("href");
  expect(editQuestionHref).toMatch(/^\/admin\/data\/practice_questions\/row\?id=\d+$/);
  const questionForm = await page.request.get(editQuestionHref!);
  expect(questionForm.status()).toBe(200);
  expect(await questionForm.text()).toContain("correct_option");
  expect(await questionForm.text()).toContain("explanation");
});

test("a super admin fixes a pending practice question from the review queue", async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test writes to the local D1 practice library.",
  );

  await loginAsAdmin(page);
  await page.goto("/admin/review");

  const detailLink = page.locator('a[href^="/admin/review?paper="]').first();
  if ((await detailLink.count()) === 0) {
    test.skip(true, "No papers currently pending in /admin/review queue (332 unkeyed questions reside in unconfirmed practice papers).");
    return;
  }
  await detailLink.click();
  await expect(page.locator("#detail-heading")).toBeVisible();

  const editLink = page
    .locator('a[href^="/admin/data/practice_questions/row?id="]')
    .first();
  if ((await editLink.count()) === 0) {
    test.skip(true, "The selected paper has no pending or unexplained rows.");
    return;
  }

  const editHref = await editLink.getAttribute("href");
  const questionId = Number(editHref?.match(/id=(\d+)/)?.[1]);
  expect(questionId).toBeGreaterThan(0);
  const paperSlug = new URL(page.url()).searchParams.get("paper");
  expect(paperSlug).toBeTruthy();

  const rowResponse = await page.request.get(
    `/api/admin/data/practice_questions/${questionId}`,
  );
  expect(rowResponse.status()).toBe(200);
  const { row } = (await rowResponse.json()) as {
    row: {
      options_json: string;
      correct_option: string | null;
      explanation: string | null;
    };
  };
  const options = JSON.parse(row.options_json) as Array<{ id: string }>;
  if (options.length === 0) {
    test.skip(true, "This pending question has no text options to key.");
    return;
  }

  const original = {
    correct_option: row.correct_option,
    explanation: row.explanation,
  };

  try {
    await page.goto(`/admin/data/practice_questions/row?id=${questionId}`);
    await page.locator("#field-correct_option").fill(options[0].id);
    await page.locator("#field-explanation").fill("Temporary review-queue verification.");
    await page.getByRole("button", { name: "Save changes" }).click();
    await expect(page.locator("#form-success")).toContainText("Saved", {
      timeout: 15_000,
    });

    await page.goto(`/admin/review?paper=${paperSlug}#detail-heading`);
    await expect(
      page.locator(`a[href="/admin/data/practice_questions/row?id=${questionId}"]`),
    ).toHaveCount(0);
  } finally {
    const restored = await page.request.post("/api/admin/data/practice_questions", {
      data: {
        _action: "update",
        _id: questionId,
        correct_option: original.correct_option,
        explanation: original.explanation,
      },
    });
    expect(restored.ok()).toBeTruthy();
  }

  await page.goto(`/admin/review?paper=${paperSlug}#detail-heading`);
  await page.reload();
  await expect(
    page.locator(`a[href="/admin/data/practice_questions/row?id=${questionId}"]`),
  ).toHaveCount(1);
});

test("a moderator cannot use editor-only endpoints", async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test creates and removes a local admin account.",
  );

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const email = `moderator-${stamp}@example.com`;
  const username = `mod_${stamp}`.slice(0, 30);

  const signup = await page.request.post("/api/auth/signup", {
    headers: { "cf-connecting-ip": testClientIp() },
    data: { username, email, password: "ModeratorPass123!" },
  });
  expect(signup.status()).toBe(200);

  try {
    localD1(
      `INSERT INTO admins (email, role) VALUES ('${email}', 'moderator')`,
    );

    const moderation = await page.request.get("/api/admin/discussions?status=pending");
    expect(moderation.status()).toBe(200);

    expect((await page.request.get("/api/admin/questions")).status()).toBe(403);
    expect(
      (await page.request.put("/api/admin/seo", { data: { path: "/about" } })).status(),
    ).toBe(403);
    expect(
      (await page.request.post("/api/admin/mocks", { data: {} })).status(),
    ).toBe(403);
    expect((await page.request.get("/api/admin/audit-log")).status()).toBe(403);

    await page.goto("/admin/moderation");
    await expect(page.getByRole("heading", { name: "Moderation" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Mock builder" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "SEO", exact: true })).toHaveCount(0);

    await page.goto("/admin/seo");
    await expect(page).toHaveURL(/\/forbidden$/);
  } finally {
    localD1(`DELETE FROM admins WHERE email = '${email}'`);
    localD1(
      `DELETE FROM sessions WHERE user_id IN (SELECT id FROM users WHERE email = '${email}')`,
    );
    localD1(`DELETE FROM users WHERE email = '${email}'`);
  }
});

test("a moderator hides a reported comment", async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "This test writes and removes discussion rows in the local D1 database.",
  );

  await loginAsAdmin(page);

  const list = await page.request.get("/api/mocks?limit=1");
  expect(list.status()).toBe(200);
  const mock = ((await list.json()) as { mocks?: { id: number }[] }).mocks?.[0];
  if (!mock) {
    test.skip(true, "No published mock test is available in this environment.");
    return;
  }

  const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const body = `E2E moderation check ${stamp}`;
  const headers = { "cf-connecting-ip": testClientIp() };

  const created = await page.request.post("/api/discussions", {
    headers,
    data: { mockId: mock.id, body },
  });
  expect(created.status()).toBe(201);
  const discussion = (await created.json()) as { id: number; status: string };
  expect(discussion.id).toBeGreaterThan(0);

  try {
    if (discussion.status !== "visible") {
      const approved = await page.request.patch(
        `/api/admin/discussions/${discussion.id}`,
        { headers, data: { action: "approve" } },
      );
      expect(approved.status()).toBe(200);
    }

    const reported = await page.request.post(
      `/api/discussions/${discussion.id}/report`,
      { headers, data: { reason: "E2E moderation check" } },
    );
    expect(reported.status()).toBe(201);

    await page.goto("/admin/moderation?tab=reported");
    const card = page.locator(`[data-comment-card="${discussion.id}"]`);
    await expect(card).toContainText(body);
    await card.getByRole("button", { name: "Hide" }).click();

    await expect(card.locator("header")).toContainText("hidden", { timeout: 15_000 });
    await expect(card.getByRole("button", { name: "Hide" })).toHaveCount(0);
  } finally {
    localD1(`DELETE FROM discussion_reports WHERE discussion_id = ${discussion.id}`);
    localD1(`DELETE FROM discussions WHERE id = ${discussion.id}`);
  }
});
