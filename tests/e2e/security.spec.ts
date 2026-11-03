import { execFileSync } from "node:child_process";
import path from "node:path";
import {
  expect,
  test,
  type APIRequestContext,
} from "@playwright/test";

const DB_NAME = "cuet-blueprint-db";
const WRANGLER_BIN = path.resolve("node_modules/wrangler/bin/wrangler.js");

/** The subset of the Playwright fixture this spec needs. */
type ApiRequestFactory = {
  request: {
    newContext(options: {
      baseURL?: string;
      extraHTTPHeaders?: Record<string, string>;
    }): Promise<APIRequestContext>;
  };
};

type MockSummary = {
  id: number;
  slug: string;
  duration_min: number;
};

type Student = {
  email: string;
  username: string;
  password: string;
};

function testClientIp(): string {
  return `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
}

function uniqueStamp(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

/** Runs SQL against the same local D1 file the dev server uses. */
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
    { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  const start = output.indexOf("[");
  if (start < 0) throw new Error(`wrangler returned no JSON: ${output.slice(0, 200)}`);
  const parsed = JSON.parse(output.slice(start)) as Array<{ results?: T[] }>;
  return parsed[0]?.results ?? [];
}

async function firstPublishedMock(request: APIRequestContext): Promise<MockSummary | null> {
  const response = await request.get("/api/mocks?limit=1");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { mocks?: MockSummary[] };
  return body.mocks?.[0] ?? null;
}

async function newStudent(
  playwright: ApiRequestFactory,
  baseURL: string | undefined,
): Promise<{ context: APIRequestContext; student: Student }> {
  const context = await playwright.request.newContext({
    baseURL,
    extraHTTPHeaders: { "cf-connecting-ip": testClientIp() },
  });
  const stamp = uniqueStamp();
  const student: Student = {
    email: `e2e-security-${stamp}@example.com`,
    username: `sec_${stamp}`.slice(0, 30),
    password: "SecurityPass123!",
  };
  const response = await context.post("/api/auth/signup", {
    data: student,
    headers: { "cf-connecting-ip": testClientIp() },
  });
  if (response.status() !== 200) {
    await context.dispose();
    throw new Error(`Student signup failed: ${response.status()} ${await response.text()}`);
  }
  return { context, student };
}

/** Gives the student a completed attempt so comment endpoints accept them. */
function grantFinishedAttempt(student: Student, mockId: number): void {
  localD1(`
    INSERT INTO attempts
      (user_id, mock_id, version_id, status, score, correct, wrong, skipped, time_taken_sec,
       started_at, deadline_at, submitted_at, is_first_attempt)
    SELECT u.id, m.id, m.current_version_id, 'submitted', 0, 0, 0, 0, 0,
           '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z',
           '2026-01-01T00:30:00.000Z', 0
    FROM users u
    JOIN mock_tests m ON m.id = ${mockId}
    WHERE u.email = ${sqlString(student.email)}
  `);
}

/** Gives the student an in-progress attempt, which unlocks the live paper chat. */
function grantLiveAttempt(student: Student, mockId: number): void {
  localD1(`
    INSERT INTO attempts
      (user_id, mock_id, version_id, status, score, correct, wrong, skipped, time_taken_sec,
       started_at, deadline_at, is_first_attempt)
    SELECT u.id, m.id, m.current_version_id, 'in_progress', NULL, 0, 0, 0, 0,
           '2026-01-01T00:00:00.000Z', '2026-01-01T01:00:00.000Z', 0
    FROM users u
    JOIN mock_tests m ON m.id = ${mockId}
    WHERE u.email = ${sqlString(student.email)}
  `);
}

function setStudentCommentState(
  student: Student,
  state: { approvedComments?: number; mutedUntil?: string | null },
): void {
  const assignments: string[] = [];
  if (state.approvedComments !== undefined) {
    assignments.push(`approved_comments = ${Math.trunc(state.approvedComments)}`);
  }
  if (state.mutedUntil !== undefined) {
    assignments.push(
      `muted_until = ${state.mutedUntil === null ? "NULL" : sqlString(state.mutedUntil)}`,
    );
  }
  if (assignments.length === 0) return;
  localD1(
    `UPDATE users SET ${assignments.join(", ")} WHERE email = ${sqlString(student.email)}`,
  );
}

function cleanupStudent(student: Student): void {
  const email = sqlString(student.email);
  const user = `(SELECT id FROM users WHERE email = ${email})`;
  localD1(
    `DELETE FROM discussion_reports WHERE user_id IN ${user} OR discussion_id IN
       (SELECT id FROM discussions WHERE user_id IN ${user})`,
  );
  localD1(
    `DELETE FROM discussion_votes WHERE user_id IN ${user} OR discussion_id IN
       (SELECT id FROM discussions WHERE user_id IN ${user})`,
  );
  // Delete replies before their parents so the self-reference stays valid.
  localD1(
    `DELETE FROM discussions WHERE parent_id IN
       (SELECT id FROM discussions WHERE user_id IN ${user})`,
  );
  localD1(`DELETE FROM discussions WHERE user_id IN ${user}`);
  localD1(
    `DELETE FROM attempt_answers WHERE attempt_id IN
       (SELECT id FROM attempts WHERE user_id IN ${user})`,
  );
  localD1(`DELETE FROM attempts WHERE user_id IN ${user}`);
  localD1(`DELETE FROM sessions WHERE user_id IN ${user}`);
  localD1(`DELETE FROM bookmarks WHERE user_id IN ${user}`);
  localD1(`DELETE FROM user_stats WHERE user_id IN ${user}`);
  localD1(`DELETE FROM user_badges WHERE user_id IN ${user}`);
  localD1(`DELETE FROM question_reports WHERE user_id IN ${user}`);
  localD1(`DELETE FROM users WHERE email = ${email}`);
}

test.beforeEach(async ({ page }) => {
  test.skip(
    Boolean(process.env.PLAYWRIGHT_BASE_URL),
    "These tests create and remove accounts and attempts in the local D1 database.",
  );
  await page.setExtraHTTPHeaders({ "cf-connecting-ip": testClientIp() });
});

test("a signed-in student cannot read or mutate another student's attempt", async ({
  playwright,
  baseURL,
  request,
}) => {
  const mock = await firstPublishedMock(request);
  test.skip(!mock, "No published mock test is available in this environment.");
  if (!mock) return;

  const a = await newStudent(playwright, baseURL);
  const b = await newStudent(playwright, baseURL);
  try {
    const started = await a.context.post("/api/attempts/start", {
      data: { mockId: mock.id },
    });
    expect(started.status()).toBe(201);
    const { attemptId } = (await started.json()) as { attemptId: number };
    expect(attemptId).toBeGreaterThan(0);

    // The owner can read their own in-progress attempt.
    expect((await a.context.get(`/api/attempts/${attemptId}`)).status()).toBe(200);

    // A different signed-in student gets the same 404 as an anonymous guest.
    expect((await b.context.get(`/api/attempts/${attemptId}`)).status()).toBe(404);
    expect(
      (
        await b.context.put(`/api/attempts/${attemptId}/answers`, {
          data: { answers: [] },
        })
      ).status(),
    ).toBe(404);
    expect(
      (
        await b.context.post(`/api/attempts/${attemptId}/submit`, {
          data: {},
        })
      ).status(),
    ).toBe(404);
    expect((await b.context.get(`/result/${attemptId}`)).status()).toBe(404);

    // Submitting changes the status but not the ownership boundary.
    const submitted = await a.context.post(`/api/attempts/${attemptId}/submit`, {
      data: {},
    });
    expect(submitted.status()).toBe(200);
    expect(await submitted.json()).toMatchObject({ ok: true, status: "submitted" });

    expect((await b.context.get(`/api/attempts/${attemptId}`)).status()).toBe(404);
    expect((await b.context.get(`/result/${attemptId}`)).status()).toBe(404);
    expect((await a.context.get(`/result/${attemptId}`)).status()).toBe(200);
  } finally {
    await a.context.dispose();
    await b.context.dispose();
    cleanupStudent(a.student);
    cleanupStudent(b.student);
  }
});

test("repeated autosave requests keep one answer row per question", async ({
  playwright,
  baseURL,
  request,
}) => {
  const mock = await firstPublishedMock(request);
  test.skip(!mock, "No published mock test is available in this environment.");
  if (!mock) return;

  const student = await newStudent(playwright, baseURL);
  let attemptId = 0;
  try {
    const started = await student.context.post("/api/attempts/start", {
      data: { mockId: mock.id },
    });
    expect(started.status()).toBe(201);
    attemptId = ((await started.json()) as { attemptId: number }).attemptId;

    const loaded = await student.context.get(`/api/attempts/${attemptId}`);
    expect(loaded.status()).toBe(200);
    const attempt = (await loaded.json()) as {
      questions: Array<{ id: number; options: string }>;
    };
    expect(attempt.questions.length).toBeGreaterThan(0);
    const question = attempt.questions[0];
    const options = JSON.parse(question.options) as unknown[];
    const answer = {
      question_id: question.id,
      selected: options.length > 0 ? 0 : null,
      time_spent_sec: 42,
      marked_for_review: 1,
    };

    // PUT and PATCH are aliases; replaying the same payload must upsert, not duplicate.
    const first = await student.context.put(`/api/attempts/${attemptId}/answers`, {
      data: { answers: [answer] },
    });
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ ok: true, saved: 1 });

    const second = await student.context.patch(`/api/attempts/${attemptId}/answers`, {
      data: { answers: [answer] },
    });
    expect(second.status()).toBe(200);
    expect(await second.json()).toMatchObject({ ok: true, saved: 1 });

    const reloaded = await student.context.get(`/api/attempts/${attemptId}`);
    expect(reloaded.status()).toBe(200);
    const saved = (await reloaded.json()) as {
      answers: Array<{
        question_id: number;
        selected: number | null;
        time_spent_sec: number;
        marked_for_review: number;
      }>;
    };
    expect(saved.answers).toHaveLength(1);
    expect(saved.answers[0]).toMatchObject({
      question_id: question.id,
      selected: answer.selected,
      time_spent_sec: 42,
      marked_for_review: 1,
    });

    const rows = localD1Rows<{ count: number }>(
      `SELECT COUNT(*) AS count FROM attempt_answers WHERE attempt_id = ${attemptId}`,
    );
    expect(rows[0]?.count).toBe(1);
  } finally {
    await student.context.dispose();
    cleanupStudent(student.student);
  }
});

test("client-supplied deadline and scoring fields are ignored", async ({
  playwright,
  baseURL,
  request,
}) => {
  const mock = await firstPublishedMock(request);
  test.skip(!mock, "No published mock test is available in this environment.");
  if (!mock) return;

  const student = await newStudent(playwright, baseURL);
  try {
    const before = Date.now();
    const started = await student.context.post("/api/attempts/start", {
      data: {
        mockId: mock.id,
        startedAt: "2000-01-01T00:00:00.000Z",
        deadlineAt: "2000-01-01T00:01:00.000Z",
        duration_min: 1,
        remainingSec: 1,
        status: "submitted",
        score: 999,
      },
    });
    expect(started.status()).toBe(201);
    const payload = (await started.json()) as {
      attemptId: number;
      deadlineAt: string;
    };
    const after = Date.now();
    expect(payload.attemptId).toBeGreaterThan(0);

    const deadlineMs = Date.parse(payload.deadlineAt);
    expect(deadlineMs).toBeGreaterThanOrEqual(
      before + (mock.duration_min - 1) * 60_000,
    );
    expect(deadlineMs).toBeLessThanOrEqual(after + (mock.duration_min + 1) * 60_000);
    expect(payload.deadlineAt).not.toBe("2000-01-01T00:01:00.000Z");

    const loaded = await student.context.get(`/api/attempts/${payload.attemptId}`);
    expect(loaded.status()).toBe(200);
    const attempt = (await loaded.json()) as {
      status: string;
      deadlineAt: string;
      remainingSec: number;
    };
    expect(attempt.status).toBe("in_progress");
    expect(attempt.deadlineAt).toBe(payload.deadlineAt);
    expect(attempt.remainingSec).toBeGreaterThan((mock.duration_min - 1) * 60);

    const rows = localD1Rows<{
      started_at: string;
      deadline_at: string;
      status: string;
      score: number | null;
    }>(
      `SELECT started_at, deadline_at, status, score FROM attempts
       WHERE id = ${payload.attemptId}`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe("in_progress");
    expect(rows[0].score).toBeNull();
    expect(
      Date.parse(rows[0].deadline_at) - Date.parse(rows[0].started_at),
    ).toBe(mock.duration_min * 60_000);
  } finally {
    await student.context.dispose();
    cleanupStudent(student.student);
  }
});

test("comment HTML is escaped and replies stay one level deep", async ({
  playwright,
  baseURL,
  request,
}) => {
  const mock = await firstPublishedMock(request);
  test.skip(!mock, "No published mock test is available in this environment.");
  if (!mock) return;

  const student = await newStudent(playwright, baseURL);
  try {
    grantFinishedAttempt(student.student, mock.id);
    // A trusted contributor's comment is immediately visible, so the test
    // exercises the public rich-text rendering path rather than the pending box.
    setStudentCommentState(student.student, { approvedComments: 3 });

    const payload = '<script>alert("xss")</script><img src=x onerror=alert(1)>';
    const created = await student.context.post("/api/discussions", {
      data: { mockId: mock.id, body: payload },
    });
    expect(created.status()).toBe(201);
    const root = (await created.json()) as { id: number; status: string };
    expect(root.status).toBe("visible");

    const reply = await student.context.post("/api/discussions", {
      data: { mockId: mock.id, parentId: root.id, body: "First-level reply" },
    });
    expect(reply.status()).toBe(201);
    const replyRow = (await reply.json()) as { id: number; status: string };
    expect(replyRow.status).toBe("visible");

    const nested = await student.context.post("/api/discussions", {
      data: { mockId: mock.id, parentId: replyRow.id, body: "Nested reply" },
    });
    expect(nested.status()).toBe(400);
    expect(await nested.text()).toContain("one level deep");

    const page = await student.context.get(`/mock/${mock.slug}/discussion`);
    expect(page.status()).toBe(200);
    const html = await page.text();
    expect(html).not.toContain(payload);
    expect(html).toContain(
      '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(html).toContain("First-level reply");

    // The inline preview must count a reply once, even though the reply row is
    // fetched separately from the top-level thread.
    const preview = await student.context.get(`/mock/${mock.slug}`);
    expect(preview.status()).toBe(200);
    const previewHtml = await preview.text();
    const threadHtml = previewHtml
      .split("<li")
      .find((chunk) => chunk.includes("&lt;script&gt;alert(&quot;xss&quot;)"));
    expect(threadHtml).toBeTruthy();
    expect(threadHtml).toMatch(/>\s*1 reply\s*<\/span>/);
    expect(threadHtml).not.toMatch(/>\s*2 replies\s*<\/span>/);
  } finally {
    await student.context.dispose();
    cleanupStudent(student.student);
  }
});

test("a live attempt can post in the paper discussion", async ({
  playwright,
  baseURL,
  request,
}) => {
  const mock = await firstPublishedMock(request);
  test.skip(!mock, "No published mock test is available in this environment.");
  if (!mock) return;

  const student = await newStudent(playwright, baseURL);
  try {
    grantLiveAttempt(student.student, mock.id);
    setStudentCommentState(student.student, { approvedComments: 3 });

    const response = await student.context.post("/api/discussions", {
      data: { mockId: mock.id, body: `Live attempt comment ${uniqueStamp()}` },
    });
    expect(response.status()).toBe(201);
    const created = (await response.json()) as { status: string };
    expect(created.status).toBe("visible");
  } finally {
    await student.context.dispose();
    cleanupStudent(student.student);
  }
});

test("a student without an attempt cannot post in a paper discussion", async ({
  playwright,
  baseURL,
  request,
}) => {
  const mock = await firstPublishedMock(request);
  test.skip(!mock, "No published mock test is available in this environment.");
  if (!mock) return;

  const student = await newStudent(playwright, baseURL);
  try {
    const response = await student.context.post("/api/discussions", {
      data: { mockId: mock.id, body: `Unstarted comment ${uniqueStamp()}` },
    });
    expect(response.status()).toBe(403);
    expect(await response.text()).toContain("Start this mock test");
  } finally {
    await student.context.dispose();
    cleanupStudent(student.student);
  }
});

test("a muted student cannot post a comment", async ({
  playwright,
  baseURL,
  request,
}) => {
  const mock = await firstPublishedMock(request);
  test.skip(!mock, "No published mock test is available in this environment.");
  if (!mock) return;

  const student = await newStudent(playwright, baseURL);
  try {
    grantFinishedAttempt(student.student, mock.id);
    setStudentCommentState(student.student, {
      approvedComments: 3,
      mutedUntil: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    });

    const response = await student.context.post("/api/discussions", {
      data: { mockId: mock.id, body: `Muted comment ${uniqueStamp()}` },
    });
    expect(response.status()).toBe(403);
    expect(await response.text()).toContain("muted");
  } finally {
    setStudentCommentState(student.student, { mutedUntil: null });
    await student.context.dispose();
    cleanupStudent(student.student);
  }
});

test("comment posting is rate-limited per account", async ({
  playwright,
  baseURL,
  request,
}) => {
  const mock = await firstPublishedMock(request);
  test.skip(!mock, "No published mock test is available in this environment.");
  if (!mock) return;

  const student = await newStudent(playwright, baseURL);
  try {
    grantFinishedAttempt(student.student, mock.id);
    setStudentCommentState(student.student, { approvedComments: 3 });

    for (let index = 1; index <= 5; index += 1) {
      const response = await student.context.post("/api/discussions", {
        data: { mockId: mock.id, body: `Rate-limit comment ${index} ${uniqueStamp()}` },
      });
      expect(response.status(), `comment ${index}`).toBe(201);
    }

    const blocked = await student.context.post("/api/discussions", {
      data: { mockId: mock.id, body: `Rate-limit comment 6 ${uniqueStamp()}` },
    });
    expect(blocked.status()).toBe(429);
    expect(await blocked.text()).toContain("Too many comments");
  } finally {
    await student.context.dispose();
    cleanupStudent(student.student);
  }
});

test("robots.txt disallows /dev and /dev/ and sitemap excludes internal styleguide", async ({ request }) => {
  const robots = await request.get("/robots.txt");
  expect(robots.status()).toBe(200);
  const text = await robots.text();
  expect(text).toContain("Disallow: /dev");
  expect(text).toContain("Disallow: /dev/");

  const sitemap = await request.get("/sitemap.xml");
  expect(sitemap.status()).toBe(200);
  const xml = await sitemap.text();
  expect(xml).not.toContain("/dev/styleguide");
  expect(xml).not.toContain("<loc>http://localhost:4321/dev</loc>");
});

test("/dev/styleguide serves in development mode with noindex", async ({ request }) => {
  const res = await request.get("/dev/styleguide");
  // In development it serves 200 with noindex header
  expect(res.status()).toBe(200);
  expect(res.headers()["x-robots-tag"]).toContain("noindex");
});
