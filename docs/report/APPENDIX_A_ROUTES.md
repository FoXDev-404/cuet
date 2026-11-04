# Appendix A: Complete Route Inventory

_Auto-generated from `src/pages` router on 2026-11-04T20:12:11.329Z._

## Summary Counts

- **Total Endpoints & Pages:** 173
- **SSR Pages (`.astro`):** 82
- **API Endpoints (`.ts`/`.js`):** 91
- **Dynamic Parameter Routes:** 65

## Public Web Pages

| Route Path | Type | Dynamic? | Source File | Description / Guard |
| :--- | :---: | :---: | :--- | :--- |
| `/` | Page | No | [`src\pages\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\index.astro) | Public |
| `/404` | Page | No | [`src\pages\404.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\404.astro) | Public |
| `/500` | Page | No | [`src\pages\500.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\500.astro) | Public |
| `/about` | Page | No | [`src\pages\about.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\about.astro) | Public |
| `/admin` | Page | No | [`src\pages\admin\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\index.astro) | Admin (Cloudflare Access / Session) |
| `/admin/admins` | Page | No | [`src\pages\admin\admins.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\admins.astro) | Admin (Cloudflare Access / Session) |
| `/admin/announcements` | Page | No | [`src\pages\admin\announcements.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\announcements.astro) | Admin (Cloudflare Access / Session) |
| `/admin/attempts` | Page | No | [`src\pages\admin\attempts\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\attempts\index.astro) | Admin (Cloudflare Access / Session) |
| `/admin/attempts/[id]` | Page | Yes | [`src\pages\admin\attempts\[id].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\attempts\[id].astro) | Admin (Cloudflare Access / Session) |
| `/admin/audit-log` | Page | No | [`src\pages\admin\audit-log.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\audit-log.astro) | Admin (Cloudflare Access / Session) |
| `/admin/blog` | Page | No | [`src\pages\admin\blog.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\blog.astro) | Admin (Cloudflare Access / Session) |
| `/admin/data` | Page | No | [`src\pages\admin\data\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\data\index.astro) | Admin (Cloudflare Access / Session) |
| `/admin/data/[table]` | Page | Yes | [`src\pages\admin\data\[table]\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\data\[table]\index.astro) | Admin (Cloudflare Access / Session) |
| `/admin/data/[table]/row` | Page | Yes | [`src\pages\admin\data\[table]\row.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\data\[table]\row.astro) | Admin (Cloudflare Access / Session) |
| `/admin/discussions` | Page | No | [`src\pages\admin\discussions.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\discussions.astro) | Admin (Cloudflare Access / Session) |
| `/admin/exam-info` | Page | No | [`src\pages\admin\exam-info.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\exam-info.astro) | Admin (Cloudflare Access / Session) |
| `/admin/leaderboard` | Page | No | [`src\pages\admin\leaderboard.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\leaderboard.astro) | Admin (Cloudflare Access / Session) |
| `/admin/mocks` | Page | No | [`src\pages\admin\mocks\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\mocks\index.astro) | Admin (Cloudflare Access / Session) |
| `/admin/mocks/[id]` | Page | Yes | [`src\pages\admin\mocks\[id].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\mocks\[id].astro) | Admin (Cloudflare Access / Session) |
| `/admin/mocks/[id]/preview` | Page | Yes | [`src\pages\admin\mocks\[id]\preview.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\mocks\[id]\preview.astro) | Admin (Cloudflare Access / Session) |
| `/admin/mocks/new` | Page | No | [`src\pages\admin\mocks\new.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\mocks\new.astro) | Admin (Cloudflare Access / Session) |
| `/admin/moderation` | Page | No | [`src\pages\admin\moderation.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\moderation.astro) | Admin (Cloudflare Access / Session) |
| `/admin/passages` | Page | No | [`src\pages\admin\passages.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\passages.astro) | Admin (Cloudflare Access / Session) |
| `/admin/pyq` | Page | No | [`src\pages\admin\pyq.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\pyq.astro) | Admin (Cloudflare Access / Session) |
| `/admin/questions` | Page | No | [`src\pages\admin\questions\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\questions\index.astro) | Admin (Cloudflare Access / Session) |
| `/admin/questions/[id]` | Page | Yes | [`src\pages\admin\questions\[id].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\questions\[id].astro) | Admin (Cloudflare Access / Session) |
| `/admin/questions/[id]/preview` | Page | Yes | [`src\pages\admin\questions\[id]\preview.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\questions\[id]\preview.astro) | Admin (Cloudflare Access / Session) |
| `/admin/questions/import` | Page | No | [`src\pages\admin\questions\import.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\questions\import.astro) | Admin (Cloudflare Access / Session) |
| `/admin/questions/new` | Page | No | [`src\pages\admin\questions\new.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\questions\new.astro) | Admin (Cloudflare Access / Session) |
| `/admin/review` | Page | No | [`src\pages\admin\review.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\review.astro) | Admin (Cloudflare Access / Session) |
| `/admin/search` | Page | No | [`src\pages\admin\search.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\search.astro) | Admin (Cloudflare Access / Session) |
| `/admin/seo` | Page | No | [`src\pages\admin\seo.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\seo.astro) | Admin (Cloudflare Access / Session) |
| `/admin/settings` | Page | No | [`src\pages\admin\settings.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\settings.astro) | Admin (Cloudflare Access / Session) |
| `/admin/trash` | Page | No | [`src\pages\admin\trash.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\trash.astro) | Admin (Cloudflare Access / Session) |
| `/admin/users` | Page | No | [`src\pages\admin\users.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\admin\users.astro) | Admin (Cloudflare Access / Session) |
| `/attempt/[id]` | Page | Yes | [`src\pages\attempt\[id].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\attempt\[id].astro) | User Session or Guest Token (Active) |
| `/blog` | Page | No | [`src\pages\blog\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\blog\index.astro) | Public |
| `/blog/[slug]` | Page | Yes | [`src\pages\blog\[slug].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\blog\[slug].astro) | Public |
| `/contact` | Page | No | [`src\pages\contact.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\contact.astro) | Public |
| `/cuet-mock-test` | Page | No | [`src\pages\cuet-mock-test.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\cuet-mock-test.astro) | Public |
| `/cuet-mock-test/[slug]` | Page | Yes | [`src\pages\cuet-mock-test\[slug].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\cuet-mock-test\[slug].astro) | Public |
| `/cuet-mock-test/[subject]/[topic]` | Page | Yes | [`src\pages\cuet-mock-test\[subject]\[topic].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\cuet-mock-test\[subject]\[topic].astro) | Public |
| `/cuet-ug-exam-pattern` | Page | No | [`src\pages\cuet-ug-exam-pattern.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\cuet-ug-exam-pattern.astro) | Public |
| `/cuet-ug-important-dates` | Page | No | [`src\pages\cuet-ug-important-dates.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\cuet-ug-important-dates.astro) | Public |
| `/cuet-ug-marking-scheme` | Page | No | [`src\pages\cuet-ug-marking-scheme.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\cuet-ug-marking-scheme.astro) | Public |
| `/cuet-ug-mock-test` | Page | No | [`src\pages\cuet-ug-mock-test.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\cuet-ug-mock-test.astro) | Public |
| `/cuet-ug-previous-year-papers` | Page | No | [`src\pages\cuet-ug-previous-year-papers.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\cuet-ug-previous-year-papers.astro) | Public |
| `/cuet-ug-syllabus` | Page | No | [`src\pages\cuet-ug-syllabus.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\cuet-ug-syllabus.astro) | Public |
| `/cuet-ug-syllabus/[subject]` | Page | Yes | [`src\pages\cuet-ug-syllabus\[subject].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\cuet-ug-syllabus\[subject].astro) | Public |
| `/dashboard` | Page | No | [`src\pages\dashboard.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\dashboard.astro) | User Session |
| `/dashboard/bookmarks` | Page | No | [`src\pages\dashboard\bookmarks.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\dashboard\bookmarks.astro) | User Session |
| `/dashboard/discussions` | Page | No | [`src\pages\dashboard\discussions.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\dashboard\discussions.astro) | User Session |
| `/dashboard/history` | Page | No | [`src\pages\dashboard\history.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\dashboard\history.astro) | User Session |
| `/dashboard/settings` | Page | No | [`src\pages\dashboard\settings.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\dashboard\settings.astro) | User Session |
| `/dashboard/wrong-questions` | Page | No | [`src\pages\dashboard\wrong-questions.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\dashboard\wrong-questions.astro) | User Session |
| `/dashboard/wrong-questions/retry` | Page | No | [`src\pages\dashboard\wrong-questions\retry.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\dashboard\wrong-questions\retry.astro) | User Session |
| `/dev/styleguide` | Page | No | [`src\pages\dev\styleguide.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\dev\styleguide.astro) | Dev Only (404 in Production) |
| `/dev/styleguide/frame` | Page | No | [`src\pages\dev\styleguide\frame.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\dev\styleguide\frame.astro) | Dev Only (404 in Production) |
| `/disclaimer` | Page | No | [`src\pages\disclaimer.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\disclaimer.astro) | Public |
| `/forbidden` | Page | No | [`src\pages\forbidden.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\forbidden.astro) | Public |
| `/forgot-password` | Page | No | [`src\pages\forgot-password.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\forgot-password.astro) | Public |
| `/leaderboard` | Page | No | [`src\pages\leaderboard\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\leaderboard\index.astro) | Public |
| `/leaderboard/[slug]` | Page | Yes | [`src\pages\leaderboard\[slug].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\leaderboard\[slug].astro) | Public |
| `/login` | Page | No | [`src\pages\login.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\login.astro) | Public |
| `/maintenance` | Page | No | [`src\pages\maintenance.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\maintenance.astro) | Public |
| `/mock-tests` | Page | No | [`src\pages\mock-tests\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\mock-tests\index.astro) | Public |
| `/mock-tests/[slug]` | Page | Yes | [`src\pages\mock-tests\[slug].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\mock-tests\[slug].astro) | Public |
| `/mock-tests/[slug]/take` | Page | Yes | [`src\pages\mock-tests\[slug]\take.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\mock-tests\[slug]\take.astro) | Public |
| `/mock/[slug]` | Page | Yes | [`src\pages\mock\[slug]\index.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\mock\[slug]\index.astro) | Public |
| `/mock/[slug]/discussion` | Page | Yes | [`src\pages\mock\[slug]\discussion.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\mock\[slug]\discussion.astro) | Public |
| `/mock/[slug]/instructions` | Page | Yes | [`src\pages\mock\[slug]\instructions.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\mock\[slug]\instructions.astro) | Public |
| `/privacy-policy` | Page | No | [`src\pages\privacy-policy.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\privacy-policy.astro) | Public |
| `/pyq/[year]` | Page | Yes | [`src\pages\pyq\[year].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\pyq\[year].astro) | Public |
| `/pyq/[year]/[subject]` | Page | Yes | [`src\pages\pyq\[year]\[subject].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\pyq\[year]\[subject].astro) | Public |
| `/q/[slug]` | Page | Yes | [`src\pages\q\[slug].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\q\[slug].astro) | Public |
| `/reset-password/[token]` | Page | Yes | [`src\pages\reset-password\[token].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\reset-password\[token].astro) | Public |
| `/result/[attemptId]` | Page | Yes | [`src\pages\result\[attemptId].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\result\[attemptId].astro) | User Session or Guest Token (Submitted) |
| `/result/[attemptId]/solutions` | Page | Yes | [`src\pages\result\[attemptId]\solutions.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\result\[attemptId]\solutions.astro) | User Session or Guest Token (Submitted) |
| `/search` | Page | No | [`src\pages\search.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\search.astro) | Public |
| `/signup` | Page | No | [`src\pages\signup.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\signup.astro) | Public |
| `/terms` | Page | No | [`src\pages\terms.astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\terms.astro) | Public |
| `/u/[username]` | Page | Yes | [`src\pages\u\[username].astro`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\u\[username].astro) | Public |

## API & Backend Endpoints

| Endpoint Path | Type | Dynamic? | Source File | Auth / Rate Limit Guard |
| :--- | :---: | :---: | :--- | :--- |
| `/ads.txt` | API | No | [`src\pages\ads.txt.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\ads.txt.ts) | Public |
| `/api/account` | API | No | [`src\pages\api\account\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\account\index.ts) | Session User |
| `/api/account/delete` | API | No | [`src\pages\api\account\delete.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\account\delete.ts) | Session User |
| `/api/account/export` | API | No | [`src\pages\api\account\export.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\account\export.ts) | Session User |
| `/api/account/password` | API | No | [`src\pages\api\account\password.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\account\password.ts) | Session User |
| `/api/admin/admins` | API | No | [`src\pages\api\admin\admins\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\admins\index.ts) | Admin Role Gate |
| `/api/admin/admins/[id]` | API | Yes | [`src\pages\api\admin\admins\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\admins\[id].ts) | Admin Role Gate |
| `/api/admin/announcements` | API | No | [`src\pages\api\admin\announcements\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\announcements\index.ts) | Admin Role Gate |
| `/api/admin/announcements/[id]` | API | Yes | [`src\pages\api\admin\announcements\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\announcements\[id].ts) | Admin Role Gate |
| `/api/admin/attempts/[id]` | API | Yes | [`src\pages\api\admin\attempts\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\attempts\[id].ts) | Admin Role Gate |
| `/api/admin/audit-log` | API | No | [`src\pages\api\admin\audit-log.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\audit-log.ts) | Admin Role Gate |
| `/api/admin/blog` | API | No | [`src\pages\api\admin\blog\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\blog\index.ts) | Admin Role Gate |
| `/api/admin/blog/[id]` | API | Yes | [`src\pages\api\admin\blog\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\blog\[id].ts) | Admin Role Gate |
| `/api/admin/data/[table]` | API | Yes | [`src\pages\api\admin\data\[table].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\data\[table].ts) | Admin Role Gate |
| `/api/admin/data/[table]/[id]` | API | Yes | [`src\pages\api\admin\data\[table]\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\data\[table]\[id].ts) | Admin Role Gate |
| `/api/admin/data/[table]/export` | API | Yes | [`src\pages\api\admin\data\[table]\export.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\data\[table]\export.ts) | Admin Role Gate |
| `/api/admin/discussions` | API | No | [`src\pages\api\admin\discussions\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\discussions\index.ts) | Admin Role Gate |
| `/api/admin/discussions/[id]` | API | Yes | [`src\pages\api\admin\discussions\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\discussions\[id].ts) | Admin Role Gate |
| `/api/admin/exam-info` | API | No | [`src\pages\api\admin\exam-info\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\exam-info\index.ts) | Admin Role Gate |
| `/api/admin/leaderboard` | API | No | [`src\pages\api\admin\leaderboard\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\leaderboard\index.ts) | Admin Role Gate |
| `/api/admin/me` | API | No | [`src\pages\api\admin\me.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\me.ts) | Admin Role Gate |
| `/api/admin/media` | API | No | [`src\pages\api\admin\media.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\media.ts) | Admin Role Gate |
| `/api/admin/mocks` | API | No | [`src\pages\api\admin\mocks\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\mocks\index.ts) | Admin Role Gate |
| `/api/admin/mocks/[id]` | API | Yes | [`src\pages\api\admin\mocks\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\mocks\[id].ts) | Admin Role Gate |
| `/api/admin/mocks/[id]/archive` | API | Yes | [`src\pages\api\admin\mocks\[id]\archive.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\mocks\[id]\archive.ts) | Admin Role Gate |
| `/api/admin/mocks/[id]/duplicate` | API | Yes | [`src\pages\api\admin\mocks\[id]\duplicate.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\mocks\[id]\duplicate.ts) | Admin Role Gate |
| `/api/admin/mocks/[id]/publish` | API | Yes | [`src\pages\api\admin\mocks\[id]\publish.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\mocks\[id]\publish.ts) | Admin Role Gate |
| `/api/admin/mocks/[id]/versions` | API | Yes | [`src\pages\api\admin\mocks\[id]\versions.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\mocks\[id]\versions.ts) | Admin Role Gate |
| `/api/admin/passages` | API | No | [`src\pages\api\admin\passages\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\passages\index.ts) | Admin Role Gate |
| `/api/admin/passages/[id]` | API | Yes | [`src\pages\api\admin\passages\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\passages\[id].ts) | Admin Role Gate |
| `/api/admin/practice-papers/rights` | API | No | [`src\pages\api\admin\practice-papers\rights.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\practice-papers\rights.ts) | Admin Role Gate |
| `/api/admin/pyq` | API | No | [`src\pages\api\admin\pyq\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\pyq\index.ts) | Admin Role Gate |
| `/api/admin/pyq/[id]` | API | Yes | [`src\pages\api\admin\pyq\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\pyq\[id].ts) | Admin Role Gate |
| `/api/admin/questions` | API | No | [`src\pages\api\admin\questions\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\questions\index.ts) | Admin Role Gate |
| `/api/admin/questions/[id]` | API | Yes | [`src\pages\api\admin\questions\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\questions\[id].ts) | Admin Role Gate |
| `/api/admin/questions/[id]/duplicate` | API | Yes | [`src\pages\api\admin\questions\[id]\duplicate.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\questions\[id]\duplicate.ts) | Admin Role Gate |
| `/api/admin/questions/[id]/share` | API | Yes | [`src\pages\api\admin\questions\[id]\share.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\questions\[id]\share.ts) | Admin Role Gate |
| `/api/admin/questions/bulk` | API | No | [`src\pages\api\admin\questions\bulk.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\questions\bulk.ts) | Admin Role Gate |
| `/api/admin/questions/export` | API | No | [`src\pages\api\admin\questions\export.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\questions\export.ts) | Admin Role Gate |
| `/api/admin/questions/import` | API | No | [`src\pages\api\admin\questions\import.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\questions\import.ts) | Admin Role Gate |
| `/api/admin/reports` | API | No | [`src\pages\api\admin\reports\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\reports\index.ts) | Admin Role Gate |
| `/api/admin/reports/[id]` | API | Yes | [`src\pages\api\admin\reports\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\reports\[id].ts) | Admin Role Gate |
| `/api/admin/rescore` | API | No | [`src\pages\api\admin\rescore\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\rescore\index.ts) | Admin Role Gate |
| `/api/admin/rescore/[id]` | API | Yes | [`src\pages\api\admin\rescore\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\rescore\[id].ts) | Admin Role Gate |
| `/api/admin/review/action` | API | No | [`src\pages\api\admin\review\action.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\review\action.ts) | Admin Role Gate |
| `/api/admin/review/sample.csv` | API | No | [`src\pages\api\admin\review\sample.csv.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\review\sample.csv.ts) | Admin Role Gate |
| `/api/admin/revisions` | API | No | [`src\pages\api\admin\revisions\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\revisions\index.ts) | Admin Role Gate |
| `/api/admin/revisions/[id]/restore` | API | Yes | [`src\pages\api\admin\revisions\[id]\restore.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\revisions\[id]\restore.ts) | Admin Role Gate |
| `/api/admin/search` | API | No | [`src\pages\api\admin\search.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\search.ts) | Admin Role Gate |
| `/api/admin/seo` | API | No | [`src\pages\api\admin\seo\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\seo\index.ts) | Admin Role Gate |
| `/api/admin/settings` | API | No | [`src\pages\api\admin\settings\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\settings\index.ts) | Admin Role Gate |
| `/api/admin/trash/[table]` | API | Yes | [`src\pages\api\admin\trash\[table].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\trash\[table].ts) | Admin Role Gate |
| `/api/admin/trash/[table]/[id]` | API | Yes | [`src\pages\api\admin\trash\[table]\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\trash\[table]\[id].ts) | Admin Role Gate |
| `/api/admin/users` | API | No | [`src\pages\api\admin\users\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\users\index.ts) | Admin Role Gate |
| `/api/admin/users/[id]` | API | Yes | [`src\pages\api\admin\users\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\admin\users\[id].ts) | Admin Role Gate |
| `/api/attempts/[id]` | API | Yes | [`src\pages\api\attempts\[id]\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\attempts\[id]\index.ts) | Guest / Session + Monotonic Seq |
| `/api/attempts/[id]/answers` | API | Yes | [`src\pages\api\attempts\[id]\answers.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\attempts\[id]\answers.ts) | Guest / Session + Monotonic Seq |
| `/api/attempts/[id]/submit` | API | Yes | [`src\pages\api\attempts\[id]\submit.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\attempts\[id]\submit.ts) | Guest / Session + Monotonic Seq |
| `/api/attempts/start` | API | No | [`src\pages\api\attempts\start.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\attempts\start.ts) | Guest / Session + Monotonic Seq |
| `/api/auth/forgot` | API | No | [`src\pages\api\auth\forgot.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\auth\forgot.ts) | KV Rate Limited |
| `/api/auth/google` | API | No | [`src\pages\api\auth\google\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\auth\google\index.ts) | KV Rate Limited |
| `/api/auth/google/callback` | API | No | [`src\pages\api\auth\google\callback.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\auth\google\callback.ts) | KV Rate Limited |
| `/api/auth/login` | API | No | [`src\pages\api\auth\login.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\auth\login.ts) | KV Rate Limited |
| `/api/auth/logout` | API | No | [`src\pages\api\auth\logout.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\auth\logout.ts) | KV Rate Limited |
| `/api/auth/reset` | API | No | [`src\pages\api\auth\reset.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\auth\reset.ts) | KV Rate Limited |
| `/api/auth/signup` | API | No | [`src\pages\api\auth\signup.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\auth\signup.ts) | KV Rate Limited |
| `/api/bookmarks` | API | No | [`src\pages\api\bookmarks\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\bookmarks\index.ts) | Public |
| `/api/bookmarks/[questionId]` | API | Yes | [`src\pages\api\bookmarks\[questionId].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\bookmarks\[questionId].ts) | Public |
| `/api/discussions` | API | No | [`src\pages\api\discussions\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\discussions\index.ts) | Public |
| `/api/discussions/[id]` | API | Yes | [`src\pages\api\discussions\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\discussions\[id].ts) | Public |
| `/api/discussions/[id]/report` | API | Yes | [`src\pages\api\discussions\[id]\report.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\discussions\[id]\report.ts) | Public |
| `/api/discussions/[id]/vote` | API | Yes | [`src\pages\api\discussions\[id]\vote.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\discussions\[id]\vote.ts) | Public |
| `/api/health` | API | No | [`src\pages\api\health.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\health.ts) | Public |
| `/api/leaderboards/[mockSlug]` | API | Yes | [`src\pages\api\leaderboards\[mockSlug].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\leaderboards\[mockSlug].ts) | Public |
| `/api/me/bookmarks` | API | No | [`src\pages\api\me\bookmarks\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\me\bookmarks\index.ts) | Session User |
| `/api/me/history` | API | No | [`src\pages\api\me\history.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\me\history.ts) | Session User |
| `/api/me/wrong-questions/retry` | API | No | [`src\pages\api\me\wrong-questions\retry.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\me\wrong-questions\retry.ts) | Session User |
| `/api/media/[id]` | API | Yes | [`src\pages\api\media\[id].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\media\[id].ts) | Session User |
| `/api/mocks` | API | No | [`src\pages\api\mocks\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\mocks\index.ts) | Public |
| `/api/mocks/[id]/discussions` | API | Yes | [`src\pages\api\mocks\[id]\discussions.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\mocks\[id]\discussions.ts) | Public |
| `/api/mocks/[slug]` | API | Yes | [`src\pages\api\mocks\[slug].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\mocks\[slug].ts) | Public |
| `/api/public-questions/[publicId]` | API | Yes | [`src\pages\api\public-questions\[publicId].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\public-questions\[publicId].ts) | KV Rate Limited |
| `/api/public-questions/[publicId]/check` | API | Yes | [`src\pages\api\public-questions\[publicId]\check.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\public-questions\[publicId]\check.ts) | KV Rate Limited |
| `/api/questions/[id]/discussions` | API | Yes | [`src\pages\api\questions\[id]\discussions.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\questions\[id]\discussions.ts) | Public |
| `/api/questions/[id]/report` | API | Yes | [`src\pages\api\questions\[id]\report.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\questions\[id]\report.ts) | Public |
| `/api/results/[attemptId]` | API | Yes | [`src\pages\api\results\[attemptId].ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\results\[attemptId].ts) | Public |
| `/api/share-events` | API | No | [`src\pages\api\share-events.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\share-events.ts) | KV Rate Limited |
| `/api/subjects` | API | No | [`src\pages\api\subjects.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\api\subjects.ts) | Public |
| `/pyq` | API | No | [`src\pages\pyq\index.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\pyq\index.ts) | Public |
| `/robots.txt` | API | No | [`src\pages\robots.txt.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\robots.txt.ts) | Public |
| `/sitemap.xml` | API | No | [`src\pages\sitemap.xml.ts`](file:///E:/AA Projects/New Full/CUET Mock/src\pages\sitemap.xml.ts) | Public |