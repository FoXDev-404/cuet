/**
 * Staging smoke test for the deployed Astro Worker.
 *
 * Usage:
 *   STAGING_BASE_URL=https://cuet-astro.cuet-platform.workers.dev \
 *   STAGING_ADMIN_EMAIL=... STAGING_ADMIN_PASSWORD=... \
 *   node scripts/staging-smoke.mjs
 *
 * Admin checks are skipped when credentials are not provided. The script never
 * prints credentials or private API payloads.
 */
import { request as playwrightRequest } from "@playwright/test";

const baseURL = (process.env.STAGING_BASE_URL ?? "https://cuet-astro.cuet-platform.workers.dev").replace(/\/$/, "");
const adminEmail = process.env.STAGING_ADMIN_EMAIL;
const adminPassword = process.env.STAGING_ADMIN_PASSWORD;

const context = await playwrightRequest.newContext({
  baseURL,
  extraHTTPHeaders: { origin: baseURL },
  timeout: 30_000,
});

const failures = [];
let checks = 0;

function record(name, condition, detail = "") {
  checks += 1;
  if (condition) {
    console.log(`PASS  ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failures.push(name);
    console.log(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function get(path) {
  const response = await context.get(path);
  return { response, status: response.status(), text: await response.text() };
}

function parseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

const ANSWER_KEY_FIELDS = new Set([
  "correct_option",
  "correctOption",
  "explanation",
  "explanationHtml",
  "explanation_hi",
  "explanationHiHtml",
  "is_correct",
  "isCorrect",
]);

/** Checks field names, not prose: instructions may legitimately mention explanations. */
function hasAnswerKeyField(value) {
  if (Array.isArray(value)) return value.some(hasAnswerKeyField);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(
    ([key, child]) => ANSWER_KEY_FIELDS.has(key) || hasAnswerKeyField(child),
  );
}

try {
  let rankedPublicId = null;
  let rankedSharePath = null;

  const health = await get("/api/health");
  const healthBody = parseJson(health.text);
  record("health endpoint", health.status === 200 && healthBody?.ok === true, `status ${health.status}`);

  const mocks = await get("/api/mocks?limit=5");
  const mockBody = parseJson(mocks.text);
  record(
    "public mock catalogue",
    mocks.status === 200 && mockBody?.ok === true && Array.isArray(mockBody?.mocks) && mockBody.mocks.length > 0,
    `${mockBody?.mocks?.length ?? 0} published mock(s)`,
  );

  const subjects = await get("/api/subjects");
  const subjectBody = parseJson(subjects.text);
  record(
    "public subject catalogue",
    subjects.status === 200 && subjectBody?.ok === true && Array.isArray(subjectBody?.subjects),
    `${subjectBody?.subjects?.length ?? 0} subject(s)`,
  );

  const mock = mockBody?.mocks?.[0];
  if (!mock) {
    record("public mock detail", false, "no published mock to inspect");
  } else {
    const detail = await get(`/api/mocks/${encodeURIComponent(mock.slug)}`);
    const detailBody = parseJson(detail.text);
    record(
      "public mock detail",
      detail.status === 200 &&
        detailBody?.ok === true &&
        detailBody?.mock?.slug === mock.slug &&
        Array.isArray(detailBody?.questions) &&
        detailBody.questions.length === detailBody?.mock?.questionCount,
      `${detailBody?.questions?.length ?? 0} question(s)`,
    );
    record(
      "public mock detail hides answer keys",
      detail.status === 200 && !hasAnswerKeyField(detailBody),
    );

    const board = await get(`/api/leaderboards/${encodeURIComponent(mock.slug)}`);
    const boardBody = parseJson(board.text);
    const entries = Array.isArray(boardBody?.entries) ? boardBody.entries : [];
    record(
      "public leaderboard contract",
      board.status === 200 &&
        boardBody?.ok === true &&
        boardBody?.rule === "first-attempt-only" &&
        entries.every(
          (entry) =>
            !("email" in entry) &&
            !("user_id" in entry) &&
            !("userId" in entry) &&
            "username" in entry &&
            "percentile" in entry,
        ),
      `${entries.length} ranked entr${entries.length === 1 ? "y" : "ies"}`,
    );
    record(
      "private API is noindex",
      (board.response.headers()["x-robots-tag"] ?? "").toLowerCase().includes("noindex"),
      board.response.headers()["x-robots-tag"] ?? "missing header",
    );
  }

  const privateHistory = await get("/api/me/history");
  record("private history requires login", privateHistory.status === 401, `status ${privateHistory.status}`);

  const unauthorizedPublish = await context.post("/api/admin/mocks/1/publish", { data: {} });
  record(
    "admin publish requires login",
    [401, 403].includes(unauthorizedPublish.status()),
    `status ${unauthorizedPublish.status()}`,
  );

  const robots = await get("/robots.txt");
  record(
    "robots excludes private routes",
    robots.status === 200 &&
      ["/admin", "/api/", "/attempt/", "/result/", "/dashboard", "/500"].every((path) =>
        robots.text.includes(`Disallow: ${path}`),
      ),
  );

  const errorPage = await get("/500");
  record(
    "/500 renders as noindex",
    errorPage.status === 500 &&
      /Something went wrong/i.test(errorPage.text) &&
      /noindex/i.test(errorPage.text),
    `status ${errorPage.status}`,
  );

  const home = await get("/");
  record("homepage renders", home.status === 200 && /CUET/i.test(home.text), `status ${home.status}`);

  const practice = await get("/mock-tests");
  const paperHref = practice.text.match(/href="(\/mock-tests\/[^"?#]+)"/)?.[1];
  record(
    "practice library renders",
    practice.status === 200 && Boolean(paperHref) && /ranked|previous-year/i.test(practice.text),
    paperHref ?? "no paper link",
  );

  if (paperHref) {
    const take = await get(`${paperHref}/take`);
    record(
      "local practice take view renders",
      take.status === 200 && /data-paper|local/i.test(take.text),
      `status ${take.status}`,
    );
  }

  const googleStart = await context.get("/api/auth/google", { maxRedirects: 0 });
  const googleLocation = googleStart.headers()["location"] ?? "";
  const loginPage = await get("/login");
  record(
    "Google OAuth initiation",
    [302, 303, 307].includes(googleStart.status()) &&
      googleLocation.startsWith("https://accounts.google.com/") &&
      /Continue with Google/i.test(loginPage.text),
    `status ${googleStart.status()}`,
  );

  const sitemap = await get("/sitemap.xml");
  const sharedLoc = sitemap.text.match(/<loc>([^<]*\/q\/[^<]+)<\/loc>/)?.[1] ?? "";
  const sharedPath = sharedLoc ? new URL(sharedLoc).pathname : "";
  if (!sharedPath) {
    record("sitemap lists an indexable shared question", false, "no /q/ URL in sitemap");
  } else {
    const sharedPage = await get(sharedPath);
    const publicId = sharedPath.split("-").at(-1);
    record(
      "shared question page is indexable",
      sharedPage.status === 200 &&
        sharedPage.text.includes(`<link rel="canonical" href="${baseURL}${sharedPath}">`) &&
        /<meta name="robots" content="index, follow">/.test(sharedPage.text),
      `status ${sharedPage.status}`,
    );

    const publicApi = await get(`/api/public-questions/${publicId}`);
    const publicBody = parseJson(publicApi.text);
    record(
      "public question API contract",
      publicApi.status === 200 &&
        publicBody?.ok === true &&
        publicBody?.question?.publicId === publicId &&
        publicBody?.question?.seoEligible === true &&
        publicBody?.question?.id === undefined &&
        publicBody?.question?.correctOption === undefined &&
        publicBody?.question?.explanation === undefined,
      `status ${publicApi.status}`,
    );

    const og = await context.get(`/og/questions/${publicId}.png`);
    record(
      "shared question OG image",
      og.status() === 200 &&
        (og.headers()["content-type"] ?? "").includes("image/png"),
      `status ${og.status()}`,
    );

    const sharedEvent = await context.post("/api/share-events", {
      data: { publicId, context: "public_page", channel: "copy" },
    });
    const sharedEventBody = parseJson(await sharedEvent.text());
    record(
      "share event accepted",
      sharedEvent.status() === 202 && sharedEventBody?.ok === true,
      `status ${sharedEvent.status()}`,
    );
  }

  if (adminEmail && adminPassword) {
    const login = await context.post("/api/auth/login", {
      data: { email: adminEmail, password: adminPassword, next: "/admin" },
    });
    record("admin login", login.status() === 200, `status ${login.status()}`);

    if (login.status() === 200) {
      const adminPage = await get("/admin");
      record(
        "admin dashboard renders",
        adminPage.status === 200 && /New users/i.test(adminPage.text) && /Pending reports/i.test(adminPage.text),
        `status ${adminPage.status}`,
      );

      const dashboard = await get("/dashboard");
      record(
        "learner dashboard analytics render",
        dashboard.status === 200 &&
          /Performance insights/i.test(dashboard.text) &&
          /Score trend/i.test(dashboard.text) &&
          /Topic-level weakness/i.test(dashboard.text),
        `status ${dashboard.status}`,
      );

      for (const [name, path] of [
        ["admin mocks API", "/api/admin/mocks"],
        ["admin questions API", "/api/admin/questions"],
        ["admin users API", "/api/admin/users"],
        ["admin reports API", "/api/admin/reports"],
        ["admin discussions API", "/api/admin/discussions"],
        ["admin audit log API", "/api/admin/audit-log?limit=5"],
      ]) {
        const response = await get(path);
        const body = parseJson(response.text);
        record(name, response.status === 200 && body?.ok === true, `status ${response.status}`);
      }

      const exportCsv = await get("/api/admin/questions/export?format=csv");
      record(
        "admin question CSV export",
        exportCsv.status === 200 &&
          (exportCsv.response.headers()["content-type"] ?? "").includes("text/csv") &&
          /subject_slug/.test(exportCsv.text),
        `status ${exportCsv.status}`,
      );

      const exportJson = await get("/api/admin/questions/export?format=json");
      const exportBody = parseJson(exportJson.text);
      record(
        "admin question JSON export",
        exportJson.status === 200 && Array.isArray(exportBody),
        `${Array.isArray(exportBody) ? exportBody.length : 0} question(s)`,
      );

      if (mock) {
        const detail = parseJson((await get(`/api/mocks/${encodeURIComponent(mock.slug)}`)).text);
        const questions = Array.isArray(detail?.questions) ? detail.questions : [];
        for (const question of questions) {
          const shareInfo = parseJson(
            (await get(`/api/admin/questions/${question.id}/share`)).text,
          );
          if (shareInfo?.share?.inPublishedMock && shareInfo.share.publicId) {
            rankedPublicId = shareInfo.share.publicId;
            rankedSharePath = shareInfo.share.path;
            break;
          }
        }
        record(
          "ranked question share mapping exists",
          Boolean(rankedPublicId),
          rankedPublicId ? "found one live ranked question" : "no ranked mapping found",
        );
        if (rankedSharePath) {
          const rankedPage = await get(rankedSharePath);
          record(
            "ranked share page stays noindex",
            rankedPage.status === 200 &&
              /<meta name="robots" content="noindex, follow">/.test(rankedPage.text) &&
              !/correct_option|correctOption/.test(rankedPage.text),
            `status ${rankedPage.status}`,
          );
        }
      }

      const yearFilter = await get("/api/admin/questions?year=2022&status=published");
      const yearBody = parseJson(yearFilter.text);
      record(
        "admin question subject/year/status filter",
        yearFilter.status === 200 &&
          yearBody?.ok === true &&
          Array.isArray(yearBody?.questions) &&
          yearBody.questions.every((row) => row.status === "published" && row.year === 2022),
        `${yearBody?.count ?? 0} question(s) in the 2022/published filter`,
      );

      if (mock) {
        const published = await context.post(`/api/admin/mocks/${mock.id}/publish`, {
          data: {},
          headers: { origin: baseURL },
        });
        const publishedBody = parseJson(await published.text());
        record(
          "admin publish endpoint is idempotent for a live mock",
          published.status() === 200 && publishedBody?.alreadyPublished === true,
          `status ${published.status()}`,
        );
      }
    }
  } else {
    console.log("SKIP  admin checks — set STAGING_ADMIN_EMAIL and STAGING_ADMIN_PASSWORD");
  }

  // Do not spoof cf-connecting-ip here: workers.dev rejects that header at the
  // Cloudflare edge (error 1000). Guest rate limits use the real client IP.
  const guest = await playwrightRequest.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL },
    timeout: 30_000,
  });
  try {
    if (rankedPublicId) {
      const locked = await guest.post(`/api/public-questions/${rankedPublicId}/check`, {
        data: { option: 0 },
      });
      record(
        "ranked question check requires an attempt",
        locked.status() === 403,
        `status ${locked.status()}`,
      );
    }

    if (mock) {
      const started = await guest.post("/api/attempts/start", { data: { mockId: mock.id } });
      const startedBody = parseJson(await started.text());
      const attemptId = startedBody?.attemptId ?? startedBody?.attempt?.id;
      record(
        "attempt start",
        [200, 201].includes(started.status()) && Boolean(attemptId),
        `status ${started.status()}`,
      );

      if (attemptId) {
        const attemptPage = await guest.get(`/attempt/${attemptId}`);
        const attemptHtml = await attemptPage.text();
        record(
          "attempt experience controls render",
          attemptPage.status() === 200 &&
            /id="fullscreen-toggle"/.test(attemptHtml) &&
            /id="timer-announcer"/.test(attemptHtml) &&
            /id="save-state"/.test(attemptHtml) &&
            /noindex/i.test(attemptHtml),
          `status ${attemptPage.status()}`,
        );
        const submitted = await guest.post(`/api/attempts/${attemptId}/submit`, { data: { answers: [] } });
        record("attempt cleanup submit", [200, 409].includes(submitted.status()), `status ${submitted.status()}`);
      }
    }
  } finally {
    await guest.dispose();
  }
} finally {
  await context.dispose();
}

console.log(`\n${checks - failures.length}/${checks} checks passed.`);
if (failures.length > 0) {
  console.error(`Failed: ${failures.join(", ")}`);
  process.exitCode = 1;
}
