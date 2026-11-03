# Appendix A: Full Route Inventory

> Auto-generated from `src/pages` by technical audit tools. Total routes: **170** (82 UI pages, 88 API endpoints).

## 1. UI Pages (HTML / Astro)

| Route Path | Source File | HTTP Methods | Prerender | Access Level | Description |
|---|---|---|---|---|---|
| `/` | `index.astro` | GET | SSR | Public / Session Optional | Public page: / |
| `/404` | `404.astro` | GET | SSR | Public | Public page: /404 |
| `/500` | `500.astro` | GET | SSR | Public | Public page: /500 |
| `/about` | `about.astro` | GET | SSR | Public | Public page: /about |
| `/admin` | `admin/index.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin |
| `/admin/admins` | `admin/admins.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/admins |
| `/admin/announcements` | `admin/announcements.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/announcements |
| `/admin/attempts` | `admin/attempts/index.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/attempts |
| `/admin/attempts/:id` | `admin/attempts/[id].astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/attempts/:id |
| `/admin/audit-log` | `admin/audit-log.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/audit-log |
| `/admin/blog` | `admin/blog.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/blog |
| `/admin/data` | `admin/data/index.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/data |
| `/admin/data/:table` | `admin/data/[table]/index.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/data/:table |
| `/admin/data/:table/row` | `admin/data/[table]/row.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/data/:table/row |
| `/admin/discussions` | `admin/discussions.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/discussions |
| `/admin/exam-info` | `admin/exam-info.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/exam-info |
| `/admin/leaderboard` | `admin/leaderboard.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/leaderboard |
| `/admin/mocks` | `admin/mocks/index.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/mocks |
| `/admin/mocks/:id` | `admin/mocks/[id].astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/mocks/:id |
| `/admin/mocks/:id/preview` | `admin/mocks/[id]/preview.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/mocks/:id/preview |
| `/admin/mocks/new` | `admin/mocks/new.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/mocks/new |
| `/admin/moderation` | `admin/moderation.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/moderation |
| `/admin/passages` | `admin/passages.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/passages |
| `/admin/pyq` | `admin/pyq.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/pyq |
| `/admin/questions` | `admin/questions/index.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/questions |
| `/admin/questions/:id` | `admin/questions/[id].astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/questions/:id |
| `/admin/questions/:id/preview` | `admin/questions/[id]/preview.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/questions/:id/preview |
| `/admin/questions/import` | `admin/questions/import.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/questions/import |
| `/admin/questions/new` | `admin/questions/new.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/questions/new |
| `/admin/review` | `admin/review.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/review |
| `/admin/search` | `admin/search.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/search |
| `/admin/seo` | `admin/seo.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/seo |
| `/admin/settings` | `admin/settings.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/settings |
| `/admin/trash` | `admin/trash.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/trash |
| `/admin/users` | `admin/users.astro` | GET | SSR | Admin / Role-gated | Admin console page: /admin/users |
| `/attempt/:id` | `attempt/[id].astro` | GET | SSR | Authenticated / Guest Claimable | Active exam attempt screen |
| `/blog` | `blog/index.astro` | GET | SSR | Public | Public page: /blog |
| `/blog/:slug` | `blog/[slug].astro` | GET | SSR | Public | Public page: /blog/:slug |
| `/contact` | `contact.astro` | GET | SSR | Public | Public page: /contact |
| `/cuet-mock-test` | `cuet-mock-test.astro` | GET | SSR | Public / Session Optional | Public page: /cuet-mock-test |
| `/cuet-mock-test/:slug` | `cuet-mock-test/[slug].astro` | GET | SSR | Public | Public page: /cuet-mock-test/:slug |
| `/cuet-mock-test/:subject/:topic` | `cuet-mock-test/[subject]/[topic].astro` | GET | SSR | Public | Public page: /cuet-mock-test/:subject/:topic |
| `/cuet-ug-exam-pattern` | `cuet-ug-exam-pattern.astro` | GET | SSR | Public / Session Optional | Public page: /cuet-ug-exam-pattern |
| `/cuet-ug-important-dates` | `cuet-ug-important-dates.astro` | GET | SSR | Public / Session Optional | Public page: /cuet-ug-important-dates |
| `/cuet-ug-marking-scheme` | `cuet-ug-marking-scheme.astro` | GET | SSR | Public / Session Optional | Public page: /cuet-ug-marking-scheme |
| `/cuet-ug-mock-test` | `cuet-ug-mock-test.astro` | GET | SSR | Public | Public page: /cuet-ug-mock-test |
| `/cuet-ug-previous-year-papers` | `cuet-ug-previous-year-papers.astro` | GET | SSR | Public / Session Optional | Public page: /cuet-ug-previous-year-papers |
| `/cuet-ug-syllabus` | `cuet-ug-syllabus.astro` | GET | SSR | Public / Session Optional | Public page: /cuet-ug-syllabus |
| `/cuet-ug-syllabus/:subject` | `cuet-ug-syllabus/[subject].astro` | GET | SSR | Public / Session Optional | Public page: /cuet-ug-syllabus/:subject |
| `/dashboard` | `dashboard.astro` | GET | SSR | Authenticated / Guest Claimable | Public page: /dashboard |
| `/dashboard/bookmarks` | `dashboard/bookmarks.astro` | GET | SSR | Authenticated / Guest Claimable | Public page: /dashboard/bookmarks |
| `/dashboard/discussions` | `dashboard/discussions.astro` | GET | SSR | Authenticated / Guest Claimable | Public page: /dashboard/discussions |
| `/dashboard/history` | `dashboard/history.astro` | GET | SSR | Authenticated / Guest Claimable | Public page: /dashboard/history |
| `/dashboard/settings` | `dashboard/settings.astro` | GET | SSR | Authenticated / Guest Claimable | Public page: /dashboard/settings |
| `/dashboard/wrong-questions` | `dashboard/wrong-questions.astro` | GET | SSR | Authenticated / Guest Claimable | Public question share and solution viewer |
| `/dashboard/wrong-questions/retry` | `dashboard/wrong-questions/retry.astro` | GET | SSR | Authenticated / Guest Claimable | Public question share and solution viewer |
| `/dev/styleguide` | `dev/styleguide.astro` | GET | SSR | Public | Public page: /dev/styleguide |
| `/dev/styleguide/frame` | `dev/styleguide/frame.astro` | GET | SSR | Public | Public page: /dev/styleguide/frame |
| `/disclaimer` | `disclaimer.astro` | GET | SSR | Public / Session Optional | Public page: /disclaimer |
| `/forbidden` | `forbidden.astro` | GET | SSR | Public | Public page: /forbidden |
| `/forgot-password` | `forgot-password.astro` | GET | SSR | Public | Public page: /forgot-password |
| `/leaderboard` | `leaderboard/index.astro` | GET | SSR | Public | Rankings and competitive leaderboards |
| `/leaderboard/:slug` | `leaderboard/[slug].astro` | GET | SSR | Public / Session Optional | Rankings and competitive leaderboards |
| `/login` | `login.astro` | GET | SSR | Public / Session Optional | Public page: /login |
| `/maintenance` | `maintenance.astro` | GET | SSR | Public | Public page: /maintenance |
| `/mock/:slug` | `mock/[slug]/index.astro` | GET | SSR | Public / Session Optional | Mock exam player / instructions |
| `/mock/:slug/discussion` | `mock/[slug]/discussion.astro` | GET | SSR | Public / Session Optional | Mock exam player / instructions |
| `/mock/:slug/instructions` | `mock/[slug]/instructions.astro` | GET | SSR | Public / Session Optional | Mock exam player / instructions |
| `/practice` | `practice/index.astro` | GET | SSR | Public | Previous-year practice paper explorer / paper view |
| `/practice/:slug` | `practice/[slug].astro` | GET | SSR | Public | Previous-year practice paper explorer / paper view |
| `/practice/:slug/take` | `practice/[slug]/take.astro` | GET | SSR | Public | Previous-year practice paper explorer / paper view |
| `/privacy-policy` | `privacy-policy.astro` | GET | SSR | Public / Session Optional | Public page: /privacy-policy |
| `/pyq/:year` | `pyq/[year].astro` | GET | SSR | Public / Session Optional | Public page: /pyq/:year |
| `/pyq/:year/:subject` | `pyq/[year]/[subject].astro` | GET | SSR | Public | Public page: /pyq/:year/:subject |
| `/q/:slug` | `q/[slug].astro` | GET | SSR | Public / Session Optional | Public question share and solution viewer |
| `/reset-password/:token` | `reset-password/[token].astro` | GET | SSR | Public | Public page: /reset-password/:token |
| `/result/:attemptId` | `result/[attemptId].astro` | GET | SSR | Authenticated / Guest Claimable | Exam submission score & review screen |
| `/result/:attemptId/solutions` | `result/[attemptId]/solutions.astro` | GET | SSR | Authenticated / Guest Claimable | Exam submission score & review screen |
| `/search` | `search.astro` | GET | SSR | Public | Public page: /search |
| `/signup` | `signup.astro` | GET | SSR | Public / Session Optional | Public page: /signup |
| `/terms` | `terms.astro` | GET | SSR | Public / Session Optional | Public page: /terms |
| `/u/:username` | `u/[username].astro` | GET | SSR | Public | Public page: /u/:username |

## 2. API Endpoints (Serverless Handlers)

| Route Path | Source File | HTTP Methods | Prerender | Access Level | Description |
|---|---|---|---|---|---|
| `/ads.txt` | `ads.txt.ts` | GET | SSR | Public | Public page: /ads.txt |
| `/api/account` | `api/account/index.ts` | PATCH | SSR | Public / Session Optional | API endpoint for account |
| `/api/account/delete` | `api/account/delete.ts` | POST | SSR | Public / Session Optional | API endpoint for account/delete |
| `/api/account/export` | `api/account/export.ts` | GET | SSR | Public / Session Optional | API endpoint for account/export |
| `/api/account/password` | `api/account/password.ts` | POST | SSR | Public / Session Optional | API endpoint for account/password |
| `/api/admin/admins` | `api/admin/admins/index.ts` | GET, POST | SSR | Admin / Role-gated | API endpoint for admin/admins |
| `/api/admin/admins/:id` | `api/admin/admins/[id].ts` | DELETE, PATCH | SSR | Admin / Role-gated | API endpoint for admin/admins/:id |
| `/api/admin/announcements` | `api/admin/announcements/index.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/announcements |
| `/api/admin/announcements/:id` | `api/admin/announcements/[id].ts` | DELETE, PATCH | SSR | Admin / Role-gated | API endpoint for admin/announcements/:id |
| `/api/admin/attempts/:id` | `api/admin/attempts/[id].ts` | GET, PATCH | SSR | Admin / Role-gated | API endpoint for admin/attempts/:id |
| `/api/admin/audit-log` | `api/admin/audit-log.ts` | GET | SSR | Admin / Role-gated | API endpoint for admin/audit-log |
| `/api/admin/blog` | `api/admin/blog/index.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/blog |
| `/api/admin/blog/:id` | `api/admin/blog/[id].ts` | DELETE, PATCH | SSR | Admin / Role-gated | API endpoint for admin/blog/:id |
| `/api/admin/data/:table` | `api/admin/data/[table].ts` | GET, POST | SSR | Admin / Role-gated | API endpoint for admin/data/:table |
| `/api/admin/data/:table/:id` | `api/admin/data/[table]/[id].ts` | GET, POST, DELETE, PATCH | SSR | Admin / Role-gated | API endpoint for admin/data/:table/:id |
| `/api/admin/data/:table/export` | `api/admin/data/[table]/export.ts` | GET | SSR | Admin / Role-gated | API endpoint for admin/data/:table/export |
| `/api/admin/discussions` | `api/admin/discussions/index.ts` | GET | SSR | Admin / Role-gated | API endpoint for admin/discussions |
| `/api/admin/discussions/:id` | `api/admin/discussions/[id].ts` | PATCH | SSR | Admin / Role-gated | API endpoint for admin/discussions/:id |
| `/api/admin/exam-info` | `api/admin/exam-info/index.ts` | PUT, DELETE | SSR | Admin / Role-gated | API endpoint for admin/exam-info |
| `/api/admin/leaderboard` | `api/admin/leaderboard/index.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/leaderboard |
| `/api/admin/me` | `api/admin/me.ts` | GET | SSR | Admin / Role-gated | API endpoint for admin/me |
| `/api/admin/media` | `api/admin/media.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/media |
| `/api/admin/mocks` | `api/admin/mocks/index.ts` | GET, POST | SSR | Admin / Role-gated | API endpoint for admin/mocks |
| `/api/admin/mocks/:id` | `api/admin/mocks/[id].ts` | DELETE, PATCH | SSR | Admin / Role-gated | API endpoint for admin/mocks/:id |
| `/api/admin/mocks/:id/archive` | `api/admin/mocks/[id]/archive.ts` | POST, DELETE | SSR | Admin / Role-gated | API endpoint for admin/mocks/:id/archive |
| `/api/admin/mocks/:id/duplicate` | `api/admin/mocks/[id]/duplicate.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/mocks/:id/duplicate |
| `/api/admin/mocks/:id/publish` | `api/admin/mocks/[id]/publish.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/mocks/:id/publish |
| `/api/admin/mocks/:id/versions` | `api/admin/mocks/[id]/versions.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/mocks/:id/versions |
| `/api/admin/passages` | `api/admin/passages/index.ts` | GET, POST | SSR | Admin / Role-gated | API endpoint for admin/passages |
| `/api/admin/passages/:id` | `api/admin/passages/[id].ts` | DELETE, PATCH | SSR | Admin / Role-gated | API endpoint for admin/passages/:id |
| `/api/admin/pyq` | `api/admin/pyq/index.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/pyq |
| `/api/admin/pyq/:id` | `api/admin/pyq/[id].ts` | GET, DELETE, PATCH | SSR | Admin / Role-gated | API endpoint for admin/pyq/:id |
| `/api/admin/questions` | `api/admin/questions/index.ts` | GET, POST | SSR | Admin / Role-gated | API endpoint for admin/questions |
| `/api/admin/questions/:id` | `api/admin/questions/[id].ts` | DELETE, PATCH | SSR | Admin / Role-gated | API endpoint for admin/questions/:id |
| `/api/admin/questions/:id/duplicate` | `api/admin/questions/[id]/duplicate.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/questions/:id/duplicate |
| `/api/admin/questions/:id/share` | `api/admin/questions/[id]/share.ts` | GET, PATCH | SSR | Admin / Role-gated | API endpoint for admin/questions/:id/share |
| `/api/admin/questions/bulk` | `api/admin/questions/bulk.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/questions/bulk |
| `/api/admin/questions/export` | `api/admin/questions/export.ts` | GET | SSR | Admin / Role-gated | API endpoint for admin/questions/export |
| `/api/admin/questions/import` | `api/admin/questions/import.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/questions/import |
| `/api/admin/reports` | `api/admin/reports/index.ts` | GET | SSR | Admin / Role-gated | API endpoint for admin/reports |
| `/api/admin/reports/:id` | `api/admin/reports/[id].ts` | PATCH | SSR | Admin / Role-gated | API endpoint for admin/reports/:id |
| `/api/admin/rescore` | `api/admin/rescore/index.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/rescore |
| `/api/admin/rescore/:id` | `api/admin/rescore/[id].ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/rescore/:id |
| `/api/admin/revisions` | `api/admin/revisions/index.ts` | GET | SSR | Admin / Role-gated | API endpoint for admin/revisions |
| `/api/admin/revisions/:id/restore` | `api/admin/revisions/[id]/restore.ts` | POST | SSR | Admin / Role-gated | API endpoint for admin/revisions/:id/restore |
| `/api/admin/search` | `api/admin/search.ts` | GET | SSR | Admin / Role-gated | API endpoint for admin/search |
| `/api/admin/seo` | `api/admin/seo/index.ts` | PUT | SSR | Admin / Role-gated | API endpoint for admin/seo |
| `/api/admin/settings` | `api/admin/settings/index.ts` | PUT | SSR | Admin / Role-gated | API endpoint for admin/settings |
| `/api/admin/trash/:table` | `api/admin/trash/[table].ts` | POST, DELETE | SSR | Admin / Role-gated | API endpoint for admin/trash/:table |
| `/api/admin/trash/:table/:id` | `api/admin/trash/[table]/[id].ts` | POST, DELETE | SSR | Admin / Role-gated | API endpoint for admin/trash/:table/:id |
| `/api/admin/users` | `api/admin/users/index.ts` | GET | SSR | Admin / Role-gated | API endpoint for admin/users |
| `/api/admin/users/:id` | `api/admin/users/[id].ts` | GET, POST | SSR | Admin / Role-gated | API endpoint for admin/users/:id |
| `/api/attempts/:id` | `api/attempts/[id]/index.ts` | GET | SSR | Authenticated / Guest Claimable | API endpoint for attempts/:id |
| `/api/attempts/:id/answers` | `api/attempts/[id]/answers.ts` | PUT, PATCH | SSR | Authenticated / Guest Claimable | API endpoint for attempts/:id/answers |
| `/api/attempts/:id/submit` | `api/attempts/[id]/submit.ts` | POST | SSR | Authenticated / Guest Claimable | API endpoint for attempts/:id/submit |
| `/api/attempts/start` | `api/attempts/start.ts` | POST | SSR | Authenticated / Guest Claimable | API endpoint for attempts/start |
| `/api/auth/forgot` | `api/auth/forgot.ts` | POST | SSR | Public / Session Optional | API endpoint for auth/forgot |
| `/api/auth/google` | `api/auth/google/index.ts` | GET | SSR | Public / Session Optional | API endpoint for auth/google |
| `/api/auth/google/callback` | `api/auth/google/callback.ts` | GET | SSR | Public / Session Optional | API endpoint for auth/google/callback |
| `/api/auth/login` | `api/auth/login.ts` | POST | SSR | Public / Session Optional | API endpoint for auth/login |
| `/api/auth/logout` | `api/auth/logout.ts` | POST | SSR | Public / Session Optional | API endpoint for auth/logout |
| `/api/auth/reset` | `api/auth/reset.ts` | POST | SSR | Public / Session Optional | API endpoint for auth/reset |
| `/api/auth/signup` | `api/auth/signup.ts` | POST | SSR | Public / Session Optional | API endpoint for auth/signup |
| `/api/bookmarks` | `api/bookmarks/index.ts` | GET, POST | SSR | Public / Session Optional | API endpoint for bookmarks |
| `/api/bookmarks/:questionId` | `api/bookmarks/[questionId].ts` | DELETE | SSR | Public / Session Optional | API endpoint for bookmarks/:questionId |
| `/api/discussions` | `api/discussions/index.ts` | POST | SSR | Public / Session Optional | API endpoint for discussions |
| `/api/discussions/:id` | `api/discussions/[id].ts` | DELETE | SSR | Public / Session Optional | API endpoint for discussions/:id |
| `/api/discussions/:id/report` | `api/discussions/[id]/report.ts` | POST | SSR | Public / Session Optional | API endpoint for discussions/:id/report |
| `/api/discussions/:id/vote` | `api/discussions/[id]/vote.ts` | POST | SSR | Public / Session Optional | API endpoint for discussions/:id/vote |
| `/api/health` | `api/health.ts` | GET | SSR | Public | API endpoint for health |
| `/api/leaderboards/:mockSlug` | `api/leaderboards/[mockSlug].ts` | GET | SSR | Public | API endpoint for leaderboards/:mockSlug |
| `/api/me/bookmarks` | `api/me/bookmarks/index.ts` | GET, POST | SSR | Public / Session Optional | API endpoint for me/bookmarks |
| `/api/me/history` | `api/me/history.ts` | GET | SSR | Public / Session Optional | API endpoint for me/history |
| `/api/me/wrong-questions/retry` | `api/me/wrong-questions/retry.ts` | POST | SSR | Public / Session Optional | API endpoint for me/wrong-questions/retry |
| `/api/media/:id` | `api/media/[id].ts` | GET | SSR | Public | API endpoint for media/:id |
| `/api/mocks` | `api/mocks/index.ts` | GET | SSR | Public | API endpoint for mocks |
| `/api/mocks/:id/discussions` | `api/mocks/[id]/discussions.ts` | GET | SSR | Public / Session Optional | API endpoint for mocks/:id/discussions |
| `/api/mocks/:slug` | `api/mocks/[slug].ts` | GET | SSR | Public | API endpoint for mocks/:slug |
| `/api/public-questions/:publicId` | `api/public-questions/[publicId].ts` | GET | SSR | Public / Session Optional | API endpoint for public-questions/:publicId |
| `/api/public-questions/:publicId/check` | `api/public-questions/[publicId]/check.ts` | POST | SSR | Public / Session Optional | API endpoint for public-questions/:publicId/check |
| `/api/questions/:id/discussions` | `api/questions/[id]/discussions.ts` | GET | SSR | Public / Session Optional | API endpoint for questions/:id/discussions |
| `/api/questions/:id/report` | `api/questions/[id]/report.ts` | POST | SSR | Public / Session Optional | API endpoint for questions/:id/report |
| `/api/results/:attemptId` | `api/results/[attemptId].ts` | GET | SSR | Authenticated / Guest Claimable | API endpoint for results/:attemptId |
| `/api/share-events` | `api/share-events.ts` | POST | SSR | Public / Session Optional | API endpoint for share-events |
| `/api/subjects` | `api/subjects.ts` | GET | SSR | Public | API endpoint for subjects |
| `/pyq` | `pyq/index.ts` | GET | SSR | Public | Public page: /pyq |
| `/robots.txt` | `robots.txt.ts` | GET | SSR | Public | Public page: /robots.txt |
| `/sitemap.xml` | `sitemap.xml.ts` | GET | SSR | Public | Public page: /sitemap.xml |