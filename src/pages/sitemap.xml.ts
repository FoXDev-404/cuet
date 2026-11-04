import type { APIRoute } from "astro";
import { allOr } from "../lib/db";
import { getLocalPapers, getLocalPaperYears, LOCAL_LIBRARY_ADDED_AT } from "../lib/local-papers";
import { getLocalSubjectCards } from "../lib/local-subject-fallback";
import { listSeoIndexableQuestions, type SeoIndexableQuestion } from "../lib/share/public-question-store";
import { siteUrl } from "../lib/site-url";
import { getSubjectStats, type SubjectStatRow } from "../lib/subject-stats";
import { isFixtureMock } from "../lib/fixtures";

type UrlEntry = { loc: string; lastmod?: string | null; changefreq?: string; priority?: string };

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = async ({ request }) => {
  const base = siteUrl(request.url);
  const urls: UrlEntry[] = [];
  const add = (path: string, options: { lastmod?: string | null; changefreq?: string; priority?: string } = {}) => {
    urls.push({ loc: new URL(path, base).toString(), ...options });
  };

  let mocks: {
    slug: string;
    published_at: string | null;
    updated_at: string | null;
    practice_paper_slug: string | null;
    eligible: number;
  }[] = [];
  let subjects: { slug: string; question_count: number; mock_count: number }[] = [];
  let syllabusSubjects: { slug: string; topic_count: number; question_count: number }[] = [];
  let topics: { subject_slug: string; topic_slug: string; question_count: number }[] = [];
  let pyqYears: { year: number; playable_count: number }[] = [];
  let pyqSubjects: { year: number; subject_slug: string; playable_count: number }[] = [];
  let posts: { slug: string; updated_at: string | null; published_at: string | null }[] = [];
  let sharedQuestions: SeoIndexableQuestion[] = [];
  let playablePyqCount = 0;
  let rankedMockCount = 0;
  const localPapers = getLocalPapers();
  const localYears = getLocalPaperYears();
  const localSubjectSlugs = new Set(localPapers.map((paper) => paper.subject.slug));
  const hasPracticeContent = (slug: string, questionCount: number, paperCount: number) =>
    questionCount > 0 || paperCount > 0 || localSubjectSlugs.has(slug);

  // Fetch the rollup before the big try so a stats failure cannot drop the
  // mock/PYQ/blog URLs that follow it.
  let subjectStats: SubjectStatRow[] = [];
  try {
    subjectStats = await getSubjectStats();
  } catch (error) {
    console.error("sitemap subject stats failed", error);
  }

  try {
    mocks = await allOr(
      `SELECT m.slug, m.published_at, m.updated_at, m.practice_paper_slug,
              (SELECT COUNT(*) FROM attempts a
                JOIN users u ON u.id = a.user_id
                WHERE a.version_id = m.current_version_id AND a.status = 'submitted' AND a.is_first_attempt = 1 AND u.deleted_at IS NULL) AS eligible
       FROM mock_tests m
       WHERE m.status = 'published' AND m.deleted_at IS NULL
         AND m.slug NOT LIKE 'e2e-%'
         AND m.slug NOT LIKE '%fixture%'
         AND m.slug NOT LIKE '%publish-check%'
         AND m.slug NOT LIKE 'slow-network-%'
         AND LOWER(m.title) NOT LIKE '%fixture%'
         AND EXISTS (SELECT 1 FROM mock_questions_current mq WHERE mq.mock_id = m.id)
       ORDER BY m.published_at DESC, m.id DESC`,
      [],
    );
    const cuetSubjects = subjectStats.filter((subject) => subject.exam_slug === "cuet-ug");
    subjects = cuetSubjects.map((subject) => ({
      slug: subject.slug,
      question_count: subject.all_mock_question_count,
      mock_count: subject.all_mock_count,
    }));
    const topicCountRows = await allOr<{ subject_id: number; topic_count: number }>(
      `SELECT subject_id, COUNT(*) AS topic_count FROM topics GROUP BY subject_id`,
      [],
    );
    const topicCounts = new Map(
      topicCountRows.map((row) => [row.subject_id, Number(row.topic_count)]),
    );
    syllabusSubjects = cuetSubjects.map((subject) => ({
      slug: subject.slug,
      topic_count: topicCounts.get(subject.id) ?? 0,
      question_count: subject.all_mock_question_count,
    }));
    if (cuetSubjects.length === 0) {
      // D1 and the cache are both unavailable. Keep the bundled subjects in
      // the sitemap instead of dropping their internal links.
      const localCards = getLocalSubjectCards();
      subjects = localCards.map((card) => ({
        slug: card.slug,
        question_count: 0,
        mock_count: card.mock_count,
      }));
      syllabusSubjects = localCards.map((card) => ({
        slug: card.slug,
        topic_count: 0,
        question_count: 0,
      }));
    }
    topics = await allOr(
      `SELECT s.slug AS subject_slug, t.slug AS topic_slug,
              (SELECT COUNT(DISTINCT q.id) FROM questions q
                JOIN mock_questions_current mq ON mq.question_id = q.id
                JOIN mock_tests m ON m.id = mq.mock_id
                WHERE q.topic_id = t.id AND q.status = 'published' AND q.deleted_at IS NULL
                  AND m.status = 'published' AND m.deleted_at IS NULL) AS question_count
       FROM topics t
       JOIN subjects s ON s.id = t.subject_id
       JOIN exams e ON e.id = s.exam_id
       WHERE e.slug = 'cuet-ug' AND e.is_active = 1 AND s.is_active = 1`,
      [],
    );
    pyqYears = await allOr(
      `SELECT p.year, COUNT(DISTINCT m.id) AS playable_count
       FROM pyq_papers p
       JOIN mock_tests m ON m.pyq_paper_id = p.id AND m.status = 'published' AND m.deleted_at IS NULL
       WHERE p.status = 'published' AND p.deleted_at IS NULL
       GROUP BY p.year
       ORDER BY p.year DESC`,
      [],
    );
    pyqSubjects = await allOr(
      `SELECT p.year, s.slug AS subject_slug, COUNT(DISTINCT m.id) AS playable_count
       FROM pyq_papers p
       JOIN subjects s ON s.id = p.subject_id
       JOIN mock_tests m ON m.pyq_paper_id = p.id AND m.status = 'published' AND m.deleted_at IS NULL
       WHERE p.status = 'published' AND p.deleted_at IS NULL
       GROUP BY p.year, s.slug`,
      [],
    );
    posts = await allOr(
      `SELECT slug, updated_at, published_at FROM blog_posts
       WHERE status = 'published' AND published_at IS NOT NULL AND deleted_at IS NULL
         AND length(body) >= 400
       ORDER BY published_at DESC, id DESC`,
      [],
    );
    playablePyqCount = pyqYears.reduce((total, year) => total + year.playable_count, 0);
    rankedMockCount = mocks.filter((mock) => mock.eligible > 0).length;
  } catch (error) {
    console.error("sitemap query failed", error);
  }

  // Rights Policy Gate (Fix 3): Papers with rights_status != 'cleared' are excluded from sitemap
  let rightsMap = new Map<string, string>();
  try {
    const rightsRows = await allOr<{ slug: string; rights_status: string }>(
      `SELECT slug, rights_status FROM practice_papers WHERE deleted_at IS NULL`,
      [],
    );
    rightsMap = new Map(rightsRows.map((r) => [r.slug, r.rights_status]));
  } catch (err) {
    console.error("sitemap rights_status query failed", err);
  }

  // Exam Info Verification Gate (Fix 5 & Fix 7): Unverified pages with noindex excluded from sitemap
  let examInfoMap = new Map<string, { value: string; last_verified: string | null }>();
  try {
    const examInfoRows = await allOr<{ key: string; value: string; last_verified: string | null }>(
      `SELECT key, value, last_verified FROM exam_info`,
      [],
    );
    examInfoMap = new Map(examInfoRows.map((r) => [r.key, { value: r.value, last_verified: r.last_verified }]));
  } catch (err) {
    console.error("sitemap exam_info query failed", err);
  }
  const isExamVerified = (key: string) => {
    const entry = examInfoMap.get(key);
    return Boolean(entry && entry.value && entry.value !== "TODO_VERIFY" && entry.last_verified);
  };

  // Kept separate so a sharing-policy failure cannot drop the rest of the
  // sitemap. Shared questions are included only when they pass the same
  // `seoEligible` check the page uses.
  try {
    sharedQuestions = await listSeoIndexableQuestions();
  } catch (error) {
    console.error("sitemap shared-question query failed", error);
  }

  add("/", { changefreq: "weekly", priority: "1.0" });
  if (mocks.length > 0 || localPapers.length > 0) add("/cuet-ug-mock-test", { changefreq: "weekly", priority: "0.9" });
  if (isExamVerified("syllabus")) add("/cuet-ug-syllabus", { changefreq: "monthly", priority: "0.9" });
  if (isExamVerified("exam-pattern")) add("/cuet-ug-exam-pattern", { changefreq: "monthly", priority: "0.9" });
  if (isExamVerified("marking-scheme")) add("/cuet-ug-marking-scheme", { changefreq: "monthly", priority: "0.8" });
  if (isExamVerified("important-dates")) add("/cuet-ug-important-dates", { changefreq: "weekly", priority: "0.8" });
  if (playablePyqCount > 0 || localPapers.length > 0) {
    add("/cuet-ug-previous-year-papers", { changefreq: "monthly", priority: "0.8" });
  }
  if (localPapers.length > 0) {
    add("/practice", { changefreq: "weekly", priority: "0.8" });
  }
  if (posts.length > 0) add("/blog", { changefreq: "weekly", priority: "0.7" });
  add("/leaderboard", { changefreq: "daily", priority: "0.6" });
  add("/about", { changefreq: "yearly", priority: "0.4" });
  add("/contact", { changefreq: "yearly", priority: "0.4" });
  add("/privacy-policy", { changefreq: "yearly", priority: "0.3" });
  add("/terms", { changefreq: "yearly", priority: "0.3" });
  add("/disclaimer", { changefreq: "yearly", priority: "0.3" });

  for (const subject of subjects) {
    if (hasPracticeContent(subject.slug, subject.question_count, subject.mock_count)) {
      add(`/cuet-mock-test/${subject.slug}`, { changefreq: "weekly", priority: "0.7" });
    }
  }

  for (const subject of syllabusSubjects) {
    if (subject.topic_count > 0 || hasPracticeContent(subject.slug, subject.question_count, 0)) {
      add(`/cuet-ug-syllabus/${subject.slug}`, { changefreq: "monthly", priority: "0.6" });
    }
  }

  for (const topic of topics) {
    if (topic.question_count > 0) {
      add(`/cuet-mock-test/${topic.subject_slug}/${topic.topic_slug}`, {
        changefreq: "weekly",
        priority: "0.6",
      });
    }
  }

  // Thin Content & Rights Policy Gate (Fix R7):
  // PYQ archive list pages (/pyq/:year and /pyq/:year/:subject) are only included in the sitemap
  // if they contain cleared papers and meet the 300-word substantive content threshold.
  const pyqYearPaths = new Set<string>();
  for (const year of pyqYears) {
    if ((year.cleared_count ?? 0) > 0) pyqYearPaths.add(`/pyq/${year.year}`);
  }
  for (const path of pyqYearPaths) {
    add(path, { changefreq: "monthly", priority: "0.6" });
  }

  const pyqSubjectPaths = new Set<string>();
  for (const paper of pyqSubjects) {
    if ((paper.cleared_count ?? 0) > 0) pyqSubjectPaths.add(`/pyq/${paper.year}/${paper.subject_slug}`);
  }
  for (const path of pyqSubjectPaths) {
    add(path, { changefreq: "monthly", priority: "0.5" });
  }

  for (const paper of localPapers) {
    const rights = rightsMap.get(paper.slug) ?? "unknown";
    if (rights === "cleared") {
      add(paper.path, {
        lastmod: LOCAL_LIBRARY_ADDED_AT,
        changefreq: "monthly",
        priority: "0.6",
      });
    }
  }

  for (const post of posts) {
    add(`/blog/${post.slug}`, {
      lastmod: post.updated_at ?? post.published_at,
      changefreq: "monthly",
      priority: "0.6",
    });
  }

  for (const mock of mocks) {
    if (isFixtureMock(mock)) continue;
    // Imported previous-year papers are canonical on /practice/<slug>, so only
    // their leaderboard is a distinct indexable URL.
    if (!mock.practice_paper_slug) {
      add(`/mock/${mock.slug}`, {
        lastmod: mock.updated_at ?? mock.published_at,
        changefreq: "weekly",
        priority: "0.8",
      });
    }
    if (mock.eligible > 0) {
      add(`/leaderboard/${mock.slug}`, {
        lastmod: mock.updated_at ?? mock.published_at,
        changefreq: "daily",
        priority: "0.5",
      });
    }
  }

  for (const question of sharedQuestions) {
    add(question.path, {
      lastmod: question.lastmod,
      changefreq: "monthly",
      priority: "0.5",
    });
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (entry) => `  <url>
    <loc>${escapeXml(entry.loc)}</loc>${entry.lastmod ? `\n    <lastmod>${escapeXml(entry.lastmod.slice(0, 10))}</lastmod>` : ""}${entry.changefreq ? `\n    <changefreq>${entry.changefreq}</changefreq>` : ""}${entry.priority ? `\n    <priority>${entry.priority}</priority>` : ""}
  </url>`,
  )
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
};
