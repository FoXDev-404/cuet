# FIX PRIORITIES — AGENT PROMPT (post-report review)

Paste to your coding agent. It fixes the problems found when the project report was reviewed. Companion to the earlier prompts (`FULL_AGENT_PROMPT.md`, `DESIGN_AGENT_PROMPT.md`, `ADMIN_PANEL_AGENT_PROMPT.md`, `QUESTION_SHARE_AGENT_PROMPT.md`, `PROJECT_REPORT_PROMPT.md`) and the blueprint `/docs/CUET_MOCK_TEST_BLUEPRINT_v2.md`.

---

## ROLE

You are a senior engineer fixing a nearly finished product. Work one fix at a time, prove each fix with evidence, and never claim more than you verified. The earlier report overclaimed in places; this time honesty matters more than a green scorecard.

## GLOBAL RULES

1. One fix = one branch and one commit series, with tests added or updated. Run type-check, lint, unit, integration, E2E and a11y before declaring a fix done.
2. Evidence for every fix: before/after numbers, command output summaries, test names, file paths. If you cannot verify something, write `UNVERIFIED`.
3. Take a safety snapshot FIRST (Phase 0). Never delete or overwrite data on the REMOTE production database without explicit owner confirmation. Local test-data cleanup is fine after a backup.
4. Do NOT generate, rewrite or "enrich" exam content (questions, answers, explanations) in bulk. If content needs work, build tooling and queues for human review instead.
5. No marketing language in code, copy or reports ("flawless", "100% compliant", "largest", "authentic" unless proven). Use the status legend: `DONE`, `PARTIAL`, `MISSING`, `BROKEN`, `UNVERIFIED`.
6. No secrets in output. Env var names only.
7. Every migration is a new numbered file, tested on an empty DB and on a copy of the current local data. Never edit applied migrations.
8. Keep the working test engine, scoring and admin intact. Change behaviour only where a fix says so.

## PHASE 0 — SAFETY SNAPSHOT

- Create branch `fix/review-1`. Tag the current commit `pre-review-fixes`.
- Export a full local D1 backup (`wrangler d1 export`) to a private folder outside the repo (never commit it).
- Run the full test suite once and record baseline results in `/docs/FIX_LOG.md`.
- Start `/docs/FIX_LOG.md` with a table: Fix id | status | evidence | follow-ups.

## FIX 1 — ENVIRONMENT SEPARATION (P0)

Problem: staging and production share the same remote D1 (`cuet-d1-prod`); local test data (users, sessions, attempts, audit log, discussions) could leak into production.

Do:
- Create separate resources per environment: D1, KV namespaces, R2 (if enabled) for `local`, `staging`, `production`. Configure `wrangler` environments so each binding resolves per environment. Document the mapping in `/docs/ENVIRONMENTS.md`.
- Write `scripts/export-content.mjs` that exports ONLY content tables (subjects, topics, exams, passages, questions, practice_papers, practice_passages, practice_questions, mock_tests, mock_test_versions, mock_questions, media metadata, blog_posts, exam_info, page_seo, question_public_ids) with foreign-key order, no user data.
- Write `scripts/purge-test-data.mjs` (local/staging only) that removes users, sessions, attempts, attempt_answers, discussions, votes, reports, bookmarks, user_stats, user_badges, share_events, audit_log test entries, email/password-reset tables. Keep the bootstrap super admin only if the owner wants it.
- Add a guard: any destructive script refuses to run against a remote production binding unless `--confirm-production` and an interactive confirmation are provided.
- Add a startup/CI check that fails if staging and production bindings point to the same database id.

DoD: three distinct DB ids documented; production-bound import contains zero user rows; guard tested.

## FIX 2 — PRODUCTION GUARDS (P0)

- `/dev/*` (styleguide) must return 404 when `ENV=production`. Add an E2E test for both environments and remove them from sitemap and robots allowlists.
- If `ENV=production` and `ADMIN_AUTH_MODE=session`, admin routes refuse to serve (503 with a clear message) unless `ADMIN_ALLOW_SESSION_IN_PROD=1` is explicitly set. Document that Cloudflare Access (JWT verified: signature, audience, expiry) is the production mode. Add tests for both modes.
- Bootstrap super-admin creation is disabled in production once any super admin exists.

DoD: tests prove all three guards.

## FIX 3 — PAPER PROVENANCE AND RIGHTS (P0)

Problem: 214 practice papers are public, `pyq_papers` has 0 rows, and there is no provenance record per paper. Rights status is unknown; this is a legal and ad-policy risk. Do not give legal conclusions; build the controls and let the owner decide.

Do:
- Migration: add to `practice_papers` (or a linked table) `source_url`, `source_type` (`official_public`,`licensed`,`original`,`unknown`), `rights_status` (`unknown`,`cleared`,`restricted`), `rights_note`, `verified_by`, `verified_at`. Backfill `source_url`/`source_type` from import metadata where the scripts recorded it; otherwise `unknown`.
- Policy gates (configurable, default ON): papers with `rights_status != 'cleared'` are `noindex`, excluded from the sitemap, and show NO ad slots. They stay usable by students.
- Each paper page shows a "Source" line with the official source link when known, a short plain-language notice, and a link to a "Report a problem / takedown" page (`/contact` section) with a documented response process in `/docs/TAKEDOWN_PROCESS.md`.
- Admin: filterable list and bulk action to set source/rights fields; counts dashboard (unknown / cleared / restricted); audit-logged.
- Tests: policy gates (noindex, sitemap exclusion, no ad markup) for `unknown` and `restricted`; cleared papers behave normally.
- Update the risk register: copyright risk severity = High until the counts of `unknown` reach 0.

DoD: report counts per rights status; gates verified by tests.

## FIX 4 — EXPLANATION HONESTY AND REVIEW QUEUE (P0)

Problem: "100% explained" counts placeholder banners and 1,204 bulk-written explanations described as "verified" without human review.

Do:
- Migration: add `explanation_source` (`official`,`human`,`ai_draft`,`banner`,`none`) and `explanation_status` (`unreviewed`,`reviewed`,`flagged`) to practice and mock questions, plus `reviewed_by`, `reviewed_at`.
- Backfill: banner text -> `banner`; the 1,204 enriched ones -> `ai_draft` + `unreviewed` (identify via audit_log/revisions/scripts/timestamps; if not identifiable, mark `unreviewed` and say so); others -> `unreviewed`.
- Student-facing: show a small "Unreviewed explanation" label for `ai_draft`/`unreviewed`; never show a banner as an explanation count.
- Redefine metrics everywhere (admin, reports): "explained" = source in (`official`,`human`) or `reviewed`. Show separate counts per source and status.
- Admin review queue: filter by status/source/subject/paper, randomized sample generator (default 100 questions) exported as CSV and a review UI with Approve / Edit / Flag; keyed and unkeyed questions separated. Unkeyed questions (`correct_option` NULL) cannot be marked `reviewed` explanation.
- Tests: label rendering, metric definitions, queue actions, audit log entries.

DoD: counts by source/status published in the fix log; a 100-question sample file generated for the owner. Do NOT mark anything `reviewed` yourself.

## FIX 5 — EXAM FACTS AND SCORING FROM DATA (P1)

- Populate `exam_info` keys used by the exam pages (dates, pattern, marking scheme, syllabus links, eligibility, subject combination) with `source_url` and `last_verified`. If you cannot verify a value from an official NTA source in this environment, store it as `TODO_VERIFY`, show "verification pending" on the page, and set the page `noindex` until verified. Pages render values only from `exam_info`/data, with `last_verified` and source link visible.
- Scoring must read the marking scheme from `mock_test_versions.marking_scheme` (and the practice paper's scheme). Remove hard-coded `+5/-1` from logic; keep it only as the default seed when creating a new version, flagged `TODO_VERIFY`. Support per-section schemes if the schema allows.
- Unit tests with at least three different schemes, including zero negative marking and a different positive value; golden tests for existing attempts show scores unchanged.

DoD: no hard-coded marking numbers in `src/lib/scoring.ts`; exam pages display source and verification date or the pending notice.

## FIX 6 — STRUCTURED DATA (P1)

- Remove `Quiz`, `Course` and `FAQPage` JSON-LD from mock, practice, subject, standalone-question and exam-info pages. Keep `Organization`, `WebSite`, `BreadcrumbList`, and `Article` only on real editorial guides.
- Markup must match visible content. Add a test that crawls each page group and fails if a disallowed type appears (allow-list per route group).
- Document eligibility rules in `/docs/SEO_RULES.md`.

DoD: JSON-LD inventory table per route group in the fix log.

## FIX 7 — DUPLICATE HUBS AND SITEMAP CONSISTENCY (P1)

- Canonical map (default, matches the keyword map): `/cuet-ug-mock-test` is the mock hub; `/cuet-mock-test` (index only) 301-redirects to it while `/cuet-mock-test/{subject}` stays. `/pyq` 301-redirects to `/cuet-ug-previous-year-papers`. Check `slug_redirects` and canonicals for any other duplicates.
- Write `scripts/seo-consistency.mjs` that crawls the local/staging site and outputs: every URL with status, canonical, robots meta, JSON-LD types, title length, h1 count. Rules: every indexable URL (200, no noindex, self-canonical) is in the sitemap; every sitemap URL is 200, indexable and self-canonical; no private URL in the sitemap.
- Explain and fix the gap between 243 sitemap URLs and the ~550 pages marked `index, follow` (mocks, papers, subjects). Decide per group which pages should be indexable, consistent with Fix 3 gates and thin-content rules (no near-empty pages).
- Run the script in CI.

DoD: mismatch count = 0; table of indexable URL counts per page group.

## FIX 8 — HONEST LABELS AND CLAIMS (P1)

- Percentiles and ranks: label "among users of this site", show participant count and date. Remove the word "national" and any implication of NTA data. Remove "verified percentiles" from public profiles. Keep profiles private by default.
- Grep the whole site copy (pages, components, SEO, JSON, emails) for: `national`, `official`, `verified`, `authentic`, `largest`, `100%`, `guarantee`, `NTA`. Replace claims you cannot prove with accurate wording (for example "previous-year papers, practice mode" instead of "largest verified archive").
- Keep the "independent, not affiliated with NTA" disclaimer visible in the footer and on paper pages.
- Test: a copy-lint script with an allow-list fails the build on banned phrases.

DoD: list of replaced strings in the fix log.

## FIX 9 — AUTOSAVE AND D1 CAPACITY (P1)

Problem: capacity claims were unsupported (autosave every 30s reading ~8 rows; ~400 rows per user average).

Do:
- Instrument D1 calls to record `meta.rows_read` and `meta.rows_written` per request (dev/staging logging, aggregated per endpoint).
- Optimise autosave: send only changed answers (delta), interval about 15s plus on question change, on `visibilitychange` hidden and `pagehide` via `sendBeacon`; server upserts only changed rows with a PK lookup; no per-autosave loading of the full question set; verify idempotency and ordering (last write wins by client sequence number).
- Cache immutable mock version question payloads (without answers or explanations) in KV, keyed by `version_id`, with invalidation on new version.
- Budgets (fail tests if exceeded): autosave <= 3 rows read; result view <= 40 rows read; leaderboard <= 120 rows read.
- Build a load script (`scripts/load-test.mjs`) that simulates N concurrent attempts (start, N autosaves, submit, result) against local/staging and prints total rows read/written per attempt.
- Produce a capacity model: rows read and written per full test, and per DAU assumption (1k, 3k, 10k) with stated assumptions, compared with the current documented free limits (re-check the Cloudflare pricing and limits pages; state the date). Set alert thresholds and an upgrade trigger.

DoD: measured numbers replace the old claim; budgets enforced in tests.

## FIX 10 — SMALLER ITEMS (P2)

1. **Deadline grace:** make it `ATTEMPT_GRACE_SECONDS` (default 15). Timer syncs from server remaining time; document clock-skew handling. Tests for on-time, within grace, after grace (`expired`).
2. **Leaderboard tie-breakers:** align with the blueprint (score desc, time asc, accuracy desc) unless the owner chooses otherwise; update unit tests and the blueprint note either way.
3. **SVG uploads:** disallow SVG in the admin upload API (default). If an SVG must stay, require sanitising, serve with `Content-Security-Policy: sandbox` and `nosniff`, and test script injection.
4. **Rate limits:** confirm login, signup, reset, discussion, public question check and share-event endpoints use KV-backed counters (not per-isolate memory). Add a test using two separate request contexts.
5. **Accessibility coverage:** extend axe to attempt (with palette open), result, solutions, dashboard (logged-in fixture), key admin pages, `/q/{id}` pages, in light and dark, desktop and mobile. Fix violations found.
6. **Lighthouse:** run for home, hubs, mock detail, instructions, attempt, result, subject page, public question page, admin page, in BOTH themes. Record tool version and throttling settings. Store raw JSON in `/docs/report/lighthouse/`.
7. **CI:** add GitHub Actions workflows for pull requests and pushes: install with cache, type-check, lint, unit/integration, build, Playwright E2E, axe, SEO consistency script. Upload failure artifacts. Keep the backup workflow separate and make it skip with a clear notice if repo secrets are missing.
8. **Repo hygiene:** confirm `.dev.vars`, `.wrangler/`, `*.sqlite`, backups and `.env*` are git-ignored; run a secrets scan over the working tree and git history (e.g. gitleaks); report counts only; list any finding for rotation.
9. **Claims cleanup:** remove "Cloudflare Bot Fight Mode enabled" and similar unverifiable operational claims from docs; move them into the launch runbook as post-domain steps.
10. **Dev dependencies:** assess the 2 moderate dev vulnerabilities; apply patch updates in a separate commit with the full suite green.
11. **Data reconciliation:** explain and document the counts: 337 mocks vs 443 versions, 12,009 questions vs 11,552 `mock_questions` rows, 20 tables catalogued vs 39 tables. Add an integrity script that prints these relationships.

## FIX 11 — REPORT REGENERATION (P1, do last)

- Add `npm run report:facts` that outputs a JSON of facts: dependency versions from the lockfile, route inventory from the router, table list with counts, test counts, migration list, env var names.
- Add `scripts/check-report-evidence.mjs` that scans the report for cited file paths and routes and fails if any do not exist.
- Regenerate `/docs/report/PROJECT_REPORT.md` and appendices from those facts. Correct stack versions, routes, table catalogue (all tables), counts. Remove superlatives. Use the strict legend. Add sections: "What changed since the previous report", "Unverified items", "Open owner decisions". Report the earlier content changes honestly (1,204 explanations) and their new status from Fix 4.
- Overall status may not exceed `PARTIAL` while any P0/P1 fix is incomplete or any rights/explanation counts remain `unknown`/`unreviewed`.

## ORDER OF WORK

Phase 0 -> Fix 1 -> Fix 2 -> Fix 3 -> Fix 4 -> Fix 9 -> Fix 5 -> Fix 6 -> Fix 7 -> Fix 8 -> Fix 10 -> Fix 11.

## OUTPUT FORMAT (after each fix, append to `/docs/FIX_LOG.md` and tell the owner)

1. Fix id and status (`DONE`/`PARTIAL`/`BLOCKED`).
2. What changed (files, migrations).
3. Evidence: tests, before/after numbers, command outputs (summarised).
4. Remaining work and risks.
5. Owner decisions needed, if any.

## STOP CONDITIONS (ask the owner only for these)

- What to do with papers whose rights remain `unknown` beyond the default (noindex, no ads). 
- Tie-breaker preference, if different from the blueprint.
- Any action on the REMOTE production database.
- Anything needing credentials or a registered domain.

Otherwise continue.

## START NOW

Begin with Phase 0, then Fix 1.
