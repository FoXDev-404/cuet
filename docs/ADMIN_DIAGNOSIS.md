# Admin panel diagnosis (Step 0)

**Date:** 2026-11-01
**Site:** https://cuet-astro.cuet-platform.workers.dev
**Runtime:** Astro + Cloudflare Workers + D1 (`cuet-blueprint-db`)
**Auth mode in production:** `ADMIN_AUTH_MODE=session` (admin identity is the signed-in user's email matched against `admins`)

This document is the Step 0 deliverable required by `ADMIN_PANEL_AGENT_PROMPT.md`. No new screens were built before completing it.

---

## 1. Why the owner could not see edit options

| Check | Finding |
|---|---|
| How an admin is resolved | `src/middleware.ts` → `resolveAdmin()`. In `session` mode it reads the logged-in user and calls `getAdminByEmail(user.email)`. |
| Condition for admin access | A row in `admins` with the same email and `is_active = 1`. A normal `users` row does **not** grant admin access. |
| What happens without an admin row | `/admin/*` redirects to `/forbidden`; `/api/admin/*` returns `403 "This account is not an admin."` |
| Was the owner's email present? | **No.** `admins` contained only `admin@cuetfreemocktest.com`. The owner signed in with Google as `rajpal010304@gmail.com`, so the middleware correctly treated them as a normal user. |
| Was `ADMIN_AUTH_MODE` wrong? | No. `session` mode works: sessions are created by the Google callback, and the middleware resolves the email. The missing link was the `admins` row. |
| Was the UI hidden by a role check? | Partly. Sidebar links and row actions are gated with `can(role, permission)`. With no admin row, the whole `/admin` area is blocked first. |
| Was there a way to create the first admin? | **No.** There was no bootstrap, no CLI, and no `/admin/admins` screen. Admins could only be inserted with raw SQL. |

### Root causes

1. **First-admin bootstrapping was missing.** The only admin was a seeded email whose password is unknown, and no supported flow promoted a Google account.
2. **There is no `GET /api/admin/me`.** The UI infers permissions from server-rendered role checks; client code has no authoritative permission list.
3. **Permission checks are inconsistent.** `can()` exists, but several screens/APIs use `requireAdmin()` or a broader permission than the action needs. There is no single endpoint-level matrix test.
4. **Many entities have no admin UI at all.** The long tail (subjects, topics, passages, attempts, admins, sessions, media, badges, user stats) can only be changed with SQL.
5. **No restore/trash or revision history.** Deletes are soft in some tables but there is no way to see or restore them from the UI.
6. **No data manager.** “Complete database access” was not implemented.

### Actions taken for the first-admin problem

- Added a safe CLI: `npm run admin:create -- --email=<email> [--role=super]`.
- Added env bootstrap: `BOOTSTRAP_SUPER_ADMIN_EMAIL`. It only promotes when **no active super admin exists**, so a second bootstrap attempt in production is refused.
- `rajpal010304@gmail.com` was inserted as `super` / `is_active = 1` in remote D1 (id 3) and local D1 (id 13).

---

## 2. Roles and permissions as found

`src/lib/auth/admin.ts` defines four roles and a 13-permission set:

`questions.write`, `questions.publish`, `mocks.write`, `mocks.publish`, `media.write`, `seo.write`, `exam_info.write`, `announcements.write`, `leaderboards.write`, `moderation.write`, `settings.write`, `admins.manage`, `audit.view`.

Problems versus the master prompt:

- No `attempts.*`, `users.*`, `data.manage`, `trash.*`, `revisions.*`, `questions.delete`, `contributors.own_drafts` capabilities.
- Contributors can write any question, not only their own drafts.
- Editors cannot moderate discussions (prompt says they can).
- Moderators cannot view content data, and cannot mute users.
- Super has no distinct “direct hotfix” permission.
- The permission list is not exposed to the client.

---

## 3. Table-by-table coverage (before this work)

Legend: **L** list · **C** create · **E** edit · **D** soft delete · **R** restore · **X** export.
`—` = no UI. `API` = server endpoint exists without a screen. `RO` = read-only.

| # | Table | L | C | E | D | R | X | Notes |
|---|---|---|---|---|---|---|---|---|
| 1 | `exams` | — | — | — | — | — | — | Seeded only. |
| 2 | `subjects` | RO | — | — | — | — | — | Read from questions/mock forms. |
| 3 | `topics` | RO | — | — | — | — | — | Read from question form. |
| 4 | `users` | ✓ | — | API | ✓ | — | — | `/admin/users`; delete anonymises and is irreversible in UI. |
| 5 | `sessions` | — | — | — | — | — | — | Reset only via ban. |
| 6 | `admins` | — | — | — | — | — | — | Raw SQL only. |
| 7 | `password_resets` | — | — | — | — | — | — | No admin view. |
| 8 | `email_verifications` | — | — | — | — | — | — | No admin view. |
| 9 | `passages` | — | — | — | — | — | — | Question form accepts a passage id only. |
| 10 | `questions` | ✓ | ✓ | ✓ | ✓ | — | ✓ | `/admin/questions`; no history, duplicate, bulk, restore. |
| 11 | `mock_tests` | ✓ | ✓ | ✓ | API | — | — | `/admin/mocks`; no archive/duplicate/restore. |
| 12 | `mock_questions` | ✓ | ✓ | ✓ | ✓ | — | — | Edited inside mock versions. |
| 13 | `attempts` | — | — | — | — | — | — | No UI, no void/rescore. |
| 14 | `attempt_answers` | — | — | — | — | — | — | No UI. |
| 15 | `question_reports` | ✓ | — | ✓ | — | — | — | `/admin/moderation` + `/api/admin/reports`. |
| 16 | `discussions` | ✓ | — | ✓ | ✓ | — | — | `/admin/moderation`. |
| 17 | `discussion_votes` | — | — | — | — | — | — | No UI. |
| 18 | `discussion_reports` | ✓ | — | ✓ | — | — | — | `/admin/moderation`. |
| 19 | `bookmarks` | — | — | — | — | — | — | No UI. |
| 20 | `user_stats` | — | — | — | — | — | — | No UI. |
| 21 | `badges` | — | — | — | — | — | — | Seed only. |
| 22 | `user_badges` | — | — | — | — | — | — | Seed only. |
| 23 | `page_seo` | ✓ | ✓ | ✓ | — | — | — | `/admin/seo`. |
| 24 | `exam_info` | ✓ | ✓ | ✓ | ✓ | — | — | `/admin/exam-info`. |
| 25 | `announcements` | ✓ | ✓ | ✓ | ✓ | — | — | `/admin/announcements`. |
| 26 | `site_settings` | ✓ | — | ✓ | — | — | — | `/admin/settings`. |
| 27 | `audit_log` | ✓ | — | — | — | — | — | `/admin/audit-log`; no filters/diff/export. |
| 28 | `media_assets` | — | ✓ | — | — | — | — | Upload only; no library. |
| 29 | `pyq_papers` | ✓ | ✓ | ✓ | ✓ | — | — | `/admin/pyq`. |
| 30 | `mock_test_versions` | ✓ | ✓ | ✓ | RO | — | — | Version history is read-only. |
| 31 | `blog_posts` | ✓ | ✓ | ✓ | ✓ | — | — | `/admin/blog`. |
| 32 | `revisions` | — | — | — | — | — | — | **Table missing.** |
| 33 | `rescore_jobs` | — | — | — | — | — | — | **Table missing.** |
| 34 | `slug_redirects` | — | — | — | — | — | — | **Table missing.** |

**Before score:** 10 of 31 existing tables had any create/edit UI; 7 had delete; **0 had restore or export** (questions had export only).

**Gaps that blocked “complete control”:** attempts, admins, passages, subjects, topics, media library, user sessions, badges, revisions, trash, data manager, SQL console.

---

## 4. Existing admin screens and APIs

Screens (`src/pages/admin/`):
`index`, `review`, `questions` (list/new/[id]/import), `mocks` (list/new/[id]/[id]/preview), `pyq`, `users`, `moderation`, `discussions` (read-only queue), `leaderboard`, `announcements`, `blog`, `seo`, `exam-info`, `settings`, `audit-log`.

APIs (`src/pages/api/admin/`):
`questions` (GET/POST, [id] PATCH/DELETE, import, export), `mocks` (GET/POST, [id] PATCH/DELETE, publish, versions), `pyq`, `users`, `reports`, `discussions`, `announcements`, `blog`, `seo`, `exam-info`, `leaderboard`, `settings`, `media`, `audit-log`.

Missing APIs: `/api/admin/me`, `/api/admin/admins`, `/api/admin/attempts`, `/api/admin/passages`, `/api/admin/subjects`, `/api/admin/topics`, `/api/admin/data/*`, `/api/admin/trash`, `/api/admin/revisions`, `/api/admin/rescore`, `/api/admin/search`, `/api/admin/export`.

---

## 5. Security and data findings

| Area | Finding | Risk |
|---|---|---|
| Authorization | Every existing mutating API calls `requirePermission` or `requireAdmin`. | Low, but inconsistent and untested per endpoint. |
| CSRF | `isSameOrigin()` is present on most mutations. | Some endpoints need a re-check. |
| Audit | `audit()` logs most writes, but logging failures are swallowed. | Medium: a write can succeed with no trail. |
| Soft delete | `questions`, `mock_tests`, `users`, `passages`, `pyq_papers`, `announcements`, `blog_posts` have `deleted_at`. | No restore UI. |
| Immutability | `0004_immutability_guards.sql` protects submitted attempts. | Direct hotfix must snapshot first. |
| Answer leakage | Public and pre-submit payloads exclude `correct_option`. | Must remain a regression test. |
| Secrets | `users.password_hash`, `sessions.id`, OAuth secrets are never returned by current admin APIs. | Data manager must enforce this by allow-list. |
| Pagination | Questions list is hard-capped at 100 with no pagination. Users capped at 200. | Medium: data manager needs real pagination. |
| Exports | Only questions export exists. | No users/attempts/audit exports. |

---

## 6. Remediation plan (executed after this document)

1. **Bootstrap** — CLI + one-shot env promotion, tests for “second attempt refused”.
2. **Permission source of truth** — expand `PERMISSIONS`, add `GET /api/admin/me`, drive the shell from it, add an endpoint-matrix test.
3. **Questions** — filters, pagination, bulk actions, duplicate, preview, history/restore, direct hotfix with reason + snapshot + optional rescore.
4. **Mocks/PYQ** — duplicate, archive, delete/restore, slug redirects, validation panel.
5. **Attempts** — search/detail/void/restore/rescore jobs (dry-run first).
6. **People** — admins CRUD with last-super-admin guard, user edit/session reset, subjects/topics/passages CRUD.
7. **Data manager + Trash + Audit** — explicit schema registry, masked sensitive columns, optimistic concurrency, referential safety, restore/purge, filtered audit with diff export.
8. **Verification** — permission matrix, IDOR/CSRF/XSS/SQLi, sensitive-column, bootstrap, rescore idempotency, Playwright role visibility, mobile 360 px, both themes.

Coverage target: **100% of tables reachable by Super Admin** either through a purpose-built screen or the schema-registry data manager, with restore where the table has `deleted_at`.
