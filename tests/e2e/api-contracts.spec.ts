import { expect, test, type APIRequestContext } from "@playwright/test";

type MockSummary = {
  id: number;
  slug: string;
  href: string;
};

async function listPublishedMocks(request: APIRequestContext): Promise<MockSummary[]> {
  const response = await request.get("/api/mocks?limit=10");
  expect(response.status()).toBe(200);
  const body = (await response.json()) as { mocks: MockSummary[] };
  return body.mocks;
}

function collectKeys(value: unknown, keys = new Set<string>()): Set<string> {
  if (Array.isArray(value)) {
    for (const item of value) collectKeys(item, keys);
  } else if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      keys.add(key);
      collectKeys(child, keys);
    }
  }
  return keys;
}

test.describe("public API contract", () => {
  test("health and catalogue endpoints respond with documented shapes", async ({ request }) => {
    const health = await request.get("/api/health");
    expect(health.status()).toBe(200);
    expect(await health.json()).toMatchObject({ ok: true });

    const subjects = await request.get("/api/subjects");
    expect(subjects.status()).toBe(200);
    const subjectBody = (await subjects.json()) as { ok: boolean; subjects: unknown[] };
    expect(subjectBody.ok).toBe(true);
    expect(Array.isArray(subjectBody.subjects)).toBe(true);

    const mocks = await request.get("/api/mocks?limit=5");
    expect(mocks.status()).toBe(200);
    const mockBody = (await mocks.json()) as {
      ok: boolean;
      mocks: MockSummary[];
      pagination: { page: number; limit: number };
    };
    expect(mockBody.ok).toBe(true);
    expect(mockBody.pagination).toMatchObject({ page: 1, limit: 5 });
  });

  test("public mock detail never leaks answer keys or explanations", async ({ request }) => {
    const mocks = await listPublishedMocks(request);
    test.skip(mocks.length === 0, "No published mock test is available.");

    const response = await request.get(`/api/mocks/${mocks[0].slug}`);
    expect(response.status()).toBe(200);
    const raw = await response.text();

    const body = JSON.parse(raw) as {
      mock: { slug: string; questionCount: number; sections: unknown[] };
      questions: { options: unknown[] }[];
    };
    // Question and option text may legitimately contain words such as
    // "explanation", so scan the response keys instead of the raw payload.
    const forbidden = [...collectKeys(body)].filter((key) =>
      /^(correct_option|correctOption|explanation|explanation_en|explanationEn|is_correct|isCorrect)$/i.test(
        key,
      ),
    );
    expect(forbidden).toEqual([]);
    expect(body.mock.slug).toBe(mocks[0].slug);
    expect(body.questions.length).toBe(body.mock.questionCount);
    expect(body.mock.sections.length).toBeGreaterThan(0);
    expect(body.questions[0]?.options.length).toBeGreaterThan(0);
  });

  test("leaderboard feed is username-only and first-attempt-only", async ({ request }) => {
    const mocks = await listPublishedMocks(request);
    test.skip(mocks.length === 0, "No published mock test is available.");

    const response = await request.get(`/api/leaderboards/${mocks[0].slug}`);
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      rule: string;
      eligible: number;
      entries: Record<string, unknown>[];
    };
    expect(body.ok).toBe(true);
    expect(body.rule).toBe("first-attempt-only");
    for (const entry of body.entries) {
      expect(Object.keys(entry)).not.toContain("email");
      expect(Object.keys(entry)).not.toContain("user_id");
      expect(Object.keys(entry)).not.toContain("userId");
      expect(entry).toHaveProperty("username");
      expect(entry).toHaveProperty("percentile");
    }
  });

  test("robots.txt excludes private and transactional routes", async ({ request }) => {
    const response = await request.get("/robots.txt");
    expect(response.status()).toBe(200);
    const text = await response.text();
    for (const path of ["/admin", "/api/", "/attempt/", "/result/", "/dashboard", "/500"]) {
      expect(text).toContain(`Disallow: ${path}`);
    }
    expect(text).toContain("Sitemap:");
  });
});

test.describe("API security", () => {
  test("public filters treat SQL metacharacters as data", async ({ request }) => {
    const query = "' OR 1=1 --";
    const response = await request.get(
      `/api/mocks?q=${encodeURIComponent(query)}&subject=${encodeURIComponent(query)}`,
    );
    expect(response.status()).toBe(200);
    const body = (await response.json()) as {
      ok: boolean;
      mocks: unknown[];
      filters: { q: string; subject: string };
    };
    expect(body.ok).toBe(true);
    expect(body.filters.q).toBe(query);
    expect(Array.isArray(body.mocks)).toBe(true);
    expect(body.mocks).toHaveLength(0);
  });

  test("login attempts are rate-limited per IP and email", async ({ request }) => {
    const email = `rate-limit-${Date.now().toString(36)}@example.com`;
    const headers = {
      "cf-connecting-ip": `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
    };
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const response = await request.post("/api/auth/login", {
        headers,
        data: { email, password: "DefinitelyWrong123!" },
      });
      expect(response.status()).toBe(401);
    }
    const blocked = await request.post("/api/auth/login", {
      headers,
      data: { email, password: "DefinitelyWrong123!" },
    });
    expect(blocked.status()).toBe(429);
  });

  test("wrong-question retry requires a session and rejects unseen questions", async ({ request }) => {
    expect(
      (
        await request.post("/api/me/wrong-questions/retry", {
          data: { answers: [{ question_id: 1, selected: 0 }] },
        })
      ).status(),
    ).toBe(401);

    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const signup = await request.post("/api/auth/signup", {
      headers: {
        "cf-connecting-ip": `203.0.113.${Math.floor(Math.random() * 200) + 1}`,
      },
      data: {
        username: `retry_${stamp}`.slice(0, 30),
        email: `retry-${stamp}@example.com`,
        password: "RetryPass123!",
      },
    });
    expect(signup.status()).toBe(200);

    const rejected = await request.post("/api/me/wrong-questions/retry", {
      data: { answers: [{ question_id: 1, selected: 0 }] },
    });
    expect(rejected.status()).toBe(403);
    expect(await rejected.json()).toMatchObject({
      error: expect.stringContaining("previously answered incorrectly"),
    });
  });

  test("cross-origin writes are rejected", async ({ request }) => {
    const start = await request.post("/api/attempts/start", {
      headers: { origin: "https://evil.example" },
      data: { mockId: 1 },
    });
    expect(start.status()).toBe(403);

    const login = await request.post("/api/auth/login", {
      headers: { origin: "https://evil.example" },
      data: { email: "someone@example.com", password: "Password123!" },
    });
    expect(login.status()).toBe(403);

    const publish = await request.post("/api/admin/mocks/1/publish", {
      headers: { origin: "https://evil.example" },
      data: {},
    });
    expect([401, 403]).toContain(publish.status());
  });

  test("private endpoints require a session or admin role", async ({ request }) => {
    expect((await request.get("/api/me/history")).status()).toBe(401);
    expect((await request.get("/api/admin/questions")).status()).toBe(401);
    expect((await request.get("/api/admin/questions/export?format=csv")).status()).toBe(401);
    expect((await request.get("/api/admin/audit-log")).status()).toBe(401);
    expect((await request.post("/api/admin/mocks/1/publish", { data: {} })).status()).toBe(401);
  });

  test("another guest cannot read or write someone else's attempt", async ({ request, browser }) => {
    const mocks = await listPublishedMocks(request);
    test.skip(mocks.length === 0, "No published mock test is available.");

    const started = await request.post("/api/attempts/start", {
      headers: {
        "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 200) + 1}`,
      },
      data: { mockId: mocks[0].id },
    });
    expect([200, 201]).toContain(started.status());
    const startedBody = (await started.json()) as {
      attempt?: { id: number };
      attemptId?: number;
    };
    const attemptId = startedBody.attempt?.id ?? startedBody.attemptId;
    expect(attemptId).toBeTruthy();

    const stranger = await browser.newContext();
    try {
      const strangerRequest = stranger.request;
      const read = await strangerRequest.get(`/api/attempts/${attemptId}`);
      expect(read.status()).toBe(404);

      const write = await strangerRequest.put(`/api/attempts/${attemptId}/answers`, {
        data: { answers: [{ question_id: 1, selected: 0, time_spent_sec: 1 }] },
      });
      expect(write.status()).toBe(404);

      const submit = await strangerRequest.post(`/api/attempts/${attemptId}/submit`, {
        data: { answers: [] },
      });
      expect(submit.status()).toBe(404);
    } finally {
      await stranger.close();
    }

    // Clean up the in-progress guest attempt through its owner session.
    const submitted = await request.post(`/api/attempts/${attemptId}/submit`, {
      data: { answers: [] },
    });
    expect([200, 409]).toContain(submitted.status());
  });

  test("signed-in users can read their own attempt history", async ({ request }) => {
    const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const signup = await request.post("/api/auth/signup", {
      headers: { "cf-connecting-ip": `198.51.100.${Math.floor(Math.random() * 200) + 1}` },
      data: {
        username: `api_${stamp}`.slice(0, 30),
        email: `api-${stamp}@example.com`,
        password: "ApiPass123!",
      },
    });
    expect(signup.status()).toBe(200);

    const history = await request.get("/api/me/history");
    expect(history.status()).toBe(200);
    const body = (await history.json()) as { ok: boolean; attempts: unknown[] };
    expect(body.ok).toBe(true);
    expect(Array.isArray(body.attempts)).toBe(true);

    const bookmarks = await request.get("/api/me/bookmarks");
    expect(bookmarks.status()).toBe(200);
    expect(await bookmarks.json()).toMatchObject({ ok: true, count: 0 });
  });
});
