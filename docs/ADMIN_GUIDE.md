# Admin guide

**Site:** https://cuet-astro.cuet-platform.workers.dev
**Admin area:** `/admin` (Google sign-in, then the account email must exist in the `admins` table)
**Owner account:** `rajpal010304@gmail.com` — role `super`, active

This guide covers the full-control admin panel added in migration `0009_admin_full_control.sql`.
It is written for day-to-day editorial and operational use, not for development.

---

## 1. Signing in

1. Open `/login` and continue with the Google account whose email is listed in `admins`.
2. After sign-in, open `/admin`. If the account is not an active admin, `/admin` redirects to
   `/forbidden` and `/api/admin/*` returns `403`.
3. Use **Log out** in the admin band to end the session.

Passwords are only used for the seeded local/staging admin. Production staff should use Google.
The layout exposes the current role and an appearance toggle; both are read from the server
session, not from client state.

### First-admin bootstrap

Bootstrap is one-shot. It only runs while **no active super admin exists**:

```bash
# Promote an existing or new email after a fresh database is created.
npm run admin:create -- --email=owner@example.com --role=super
```

`BOOTSTRAP_SUPER_ADMIN_EMAIL` does the same on the first request. A second attempt is refused,
so this is not a permanent backdoor. Add further admins from **Admin → Admins**.

---

## 2. Roles and permissions

`GET /api/admin/me` is the authoritative capability list. The API guard and the UI both use the
same matrix in `src/lib/auth/admin.ts`.

| Capability | Super | Editor | Moderator | Contributor |
| --- | --- | --- | --- | --- |
| Questions write / publish / delete | ✓ | ✓ | — | write only |
| Taxonomy (subjects, topics, passages) | ✓ | ✓ | — | — |
| Mocks write / publish | ✓ | ✓ | — | — |
| Media | ✓ | ✓ | — | ✓ |
| SEO, exam info, announcements | ✓ | ✓ | — | — |
| Leaderboards | ✓ | ✓ | — | — |
| Moderation | ✓ | ✓ | ✓ | — |
| Attempts view / void / rescore | ✓ | view | — | — |
| Users view / mute / manage | ✓ | view | view + mute | — |
| Admins manage | ✓ | — | — | — |
| Settings | ✓ | — | — | — |
| Data manager | ✓ | — | — | — |
| Trash and purge | ✓ | — | — | — |
| Revisions restore | ✓ | ✓ | — | — |
| Audit log | ✓ | own actions | — | — |

Super is the only role that can manage admins, use the data manager, empty the trash, or
void/rescore attempts. Editors cannot purge. Contributors can only work on questions and media.

---

## 3. Screen map

| Screen | What it is for |
| --- | --- |
| `/admin` | Counts, health, recent activity |
| `/admin/review` | Papers and questions that still need a key, explanation or flag review |
| `/admin/questions` | Filter, paginate, bulk-edit, export, duplicate, delete |
| `/admin/questions/new` | Create a question |
| `/admin/questions/[id]` | Edit, revision history, direct hotfix, delete/restore |
| `/admin/questions/import` | CSV/JSON preview then import |
| `/admin/passages` | CRUD for reading passages used by comprehension questions |
| `/admin/mocks` | List, duplicate, archive, publish, validate |
| `/admin/mocks/[id]` | Builder, version, preview, slug/redirect handling |
| `/admin/pyq` | Previous-year paper metadata and public visibility |
| `/admin/attempts` | Search attempts, inspect answers, void/restore, rescore |
| `/admin/users` | Search users, mute, edit, anonymise |
| `/admin/admins` | Add/promote/deactivate admins with the last-super guard |
| `/admin/data` | Allow-listed table browser/editor and CSV export |
| `/admin/trash` | Restore soft-deleted rows; Super-only permanent purge |
| `/admin/search` | Global search for questions, mocks, users and attempts |
| `/admin/audit-log` | Filterable write history with before/after snapshots |
| `/admin/moderation` | Reports, comments and discussion actions |
| `/admin/announcements`, `/admin/blog`, `/admin/seo`, `/admin/exam-info` | Content and metadata |
| `/admin/leaderboard`, `/admin/settings` | Ranking controls and site settings |

---

## 4. Everyday workflows

### 4.1 Review queue

`/admin/review` is the editorial dashboard. It reports:

- total questions, keyed questions and questions with an explanation;
- papers that still have unscored questions;
- per-paper pending counts and current flags;
- keyed questions that have no explanation.

Rows with no authoritative key stay **unscored**. Do not enter a guessed letter to clear the
counter. The practice player shows these as pending and excludes them from the score.

When a paper needs correction, open it from the queue. A super admin (the `data.manage`
permission) gets these actions in the paper detail:

- **Edit paper** opens the row in the Data manager. Change the title, description, source
  metadata or `publication_status`. Set it to `published` when the paper is ready for the public
  library.
- **Edit questions** opens the Data manager filtered to that paper. Use `per=100` to see the full
  question set.
- **Edit passages** does the same for the paper's reading passages.
- **Edit Q…** on each pending or unexplained row opens that exact question.

In a practice question, set `correct_option` to the printed option id (`A`, `B`, `C` or `D`) to
make the row scorable. Add the printed reasoning to `explanation`. Both fields are validated and
every save is written to the audit log. The public paper reads the change immediately; the review
counts refresh within about 30 seconds. Leave the key blank when the source cannot be verified.

Editors without `data.manage` can still see the queue and its findings, but cannot open these
editing links. Ask a super admin to make the correction or to grant the needed access.

### 4.2 Correcting a published question (hotfix)

Open the question from the review queue or the question list. The **Direct hotfix** panel:

1. Requires a reason of at least 10 characters.
2. Snapshots the question before writing.
3. Refuses to change publication status.
4. Shows the impact before saving.
5. Optionally starts a batched rescore for affected submitted attempts.

Use a normal edit for ordinary drafts. Use hotfix only for a live question that must change now.
Every hotfix is auditable and restorable from **Revision history**.

### 4.3 Bulk question actions

Select rows on `/admin/questions` to publish, unpublish, change subject/topic/year, add flags or
soft-delete. Bulk actions are permission-checked and audited once per affected row.

### 4.4 Publishing and archiving mocks

- **Publish** freezes the current version and makes it visible with a public slug.
- **Duplicate** creates a new draft with the same sections/questions; the duplicate gets no
  attempts and no leaderboard history.
- **Archive** removes public visibility but keeps versions and attempts. It is the correct action
  for retiring a paper.
- **Delete** is a soft delete. Restore from **Trash**.
- Renaming a mock slug inserts a row in `slug_redirects`; old public URLs permanently redirect
  (301) to the current published slug.

The mock builder validates that marks, sections, question counts and keys are coherent before
publish. A failed validation blocks publish and lists the exact problems.

### 4.5 Revisions and restore

Versioned content writes store a full before/after snapshot in `revisions`. Open the item's
**Revision history** to compare and restore. Restoring writes a new revision first, so a restore
can itself be undone. Restores are limited to Super and Editor.

### 4.6 Trash

Soft-deleted rows from supported tables appear under `/admin/trash`:

- **Restore** clears `deleted_at` and returns the row to its normal screens.
- **Purge** is Super-only, requires an explicit confirmation, and permanently removes the row.
  Use it only for test data or legally required erasure.
- Trash is filtered by table and supports pagination; it never shows masked secrets.

### 4.7 Data manager

`/admin/data` is an explicit schema registry, not a raw SQL console. It lists allow-listed tables,
their columns and permitted actions. Sensitive columns (password hashes, session IDs, tokens,
OAuth secrets) are masked and read-only. Edits use optimistic concurrency: if another admin changed
the row after you loaded it, the save is refused and you must reload. Foreign keys are checked and
referential deletes are blocked unless the row is explicitly purgeable.

Use the purpose-built screen first; the data manager is the fallback for the long tail. CSV export
is available per table and respects the same allow-list.

### 4.8 Attempts

`/admin/attempts` searches by user, email, mock, status or date.

- **Inspect** shows answers, timing and score breakdown.
- **Void** removes an attempt from ranked views without deleting it; a reason is required.
- **Restore** un-voids it.
- **Rescore** starts a background job. Preview the impact first; jobs are batched, resumable and
  idempotent.

Never edit `attempt_answers` directly to “fix” a score unless you are deliberately repairing data;
use rescore so the audit trail stays intact.

### 4.9 Admins

`/admin/admins` lists active and inactive admins. Adding an email creates a row with the chosen
role. The panel refuses to deactivate or demote the last active Super, so the panel cannot lock
itself out. Prefer `is_active = 0` over deleting an admin; deactivated admins keep their audit
history.

### 4.10 Global search

`/admin/search` accepts a free-text query and returns questions, mocks, users and attempts.
Search input is treated as data (parameterised queries); wildcards do not grant access to
unpublished content or secrets.

---

## 5. API and security model

Every admin endpoint:

- requires an authenticated admin session;
- is protected by `isSameOrigin()` for writes;
- calls `requirePermission(...)` for the specific capability;
- writes an audit row with actor, action, entity, before/after and reason where relevant;
- returns only allow-listed columns (no password hashes, tokens or session IDs).

`GET /api/admin/me` returns:

```json
{
  "id": 3,
  "email": "rajpal010304@gmail.com",
  "role": "super",
  "permissions": ["questions.write", "..."],
  "isSuper": true
}
```

Public and pre-submit payloads still never include `correct_option` or explanations. The admin
data manager does not bypass that rule; it only exposes admin data to an authorised admin.

### Audit

Writes are recorded in `audit_log`. Editing an admin row, publishing a mock, restoring a revision,
voiding an attempt, purging trash and changing settings are all audit events. If an audit insert
fails, the request fails rather than silently succeeding without a trail.

---

## 6. Operating rules

1. **Do not invent content.** If a key or explanation is missing from the printed paper, leave it
   pending. The review queue is designed to show incomplete work rather than hide it.
2. **Prefer archive over delete.** Archive keeps attempts and versions; delete removes public
   visibility but still keeps a trash copy.
3. **Never purge history** unless it is test data or erasure is required.
4. **Read the impact preview** before a hotfix, rescore or bulk action.
5. **Use a reason.** Reasons are mandatory for hotfixes, voids and purge; they are what makes the
   audit log useful months later.
6. **Do not share admin accounts.** Audit rows are tied to the admin id, not the Google display name.
7. **Export with care.** CSV exports contain user data; store them privately and delete them when
   the task is finished.

---

## 7. Troubleshooting

| Symptom | Check |
| --- | --- |
| `/admin` redirects to `/forbidden` | The signed-in email has no active row in `admins`, or the account is deactivated. |
| `/api/admin/me` returns 401 | You are not signed in, or the session expired. Sign in again. |
| A button is missing | Your role lacks that permission. The server would also reject the request; ask a Super to change the role. |
| A save is refused with “changed since you loaded it” | Another admin edited the row. Reload and reapply your change. |
| Publish is blocked | Open the validation panel; mark totals, section counts or missing keys must be fixed first. |
| Rescore is still running | Jobs are batched. Reload `/admin/attempts`; completed batches are persisted, so restarting is safe. |
| Old mock URL 404s | Check `slug_redirects` and confirm the mock is currently published. Archived mocks intentionally redirect away from public routes. |

For deployment, environment variables and provider setup, see `docs/LAUNCH-RUNBOOK.md` and
`docs/EXTERNAL_SETUP.md`.
