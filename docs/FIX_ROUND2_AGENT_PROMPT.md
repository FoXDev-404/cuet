# FIX ROUND 2 — VERIFICATION AND HONESTY GAPS (AGENT PROMPT)

Paste to your coding agent on branch `fix/review-1` (or a new branch `fix/review-2` from it). Round 1 fixed most product issues. Round 2 closes the places where the report claims more than the evidence shows, and a few real gaps. Companion to `FIX_PRIORITIES_AGENT_PROMPT.md` and the blueprint.

---

## GLOBAL RULES

1. Evidence first: every status claim must point to raw output you produced in THIS round (command, date, commit hash). If you could not run something, mark it `UNVERIFIED`. Never describe what a test asserts unless you derived it from the test code or the runner's output.
2. Do not edit product behaviour unless a fix below says so. Do not generate or "enrich" exam content.
3. Audit scripts must NOT mutate the working database. Run them against a temporary copy of the DB (or a seeded temp instance), never inserting test sessions, tokens, or rights flags into the real local data.
4. Never touch the REMOTE production database without explicit owner confirmation. Remote staging is allowed.
5. Record everything in `/docs/FIX_LOG.md` under "Round 2" with before/after evidence. Commit per fix.
6. No secrets or personal data in outputs.

## FIX R1 — RE-RUN THE FULL VERIFICATION SUITE (P0)

The attempt screen, autosave, result page, migrations 0017 to 0020 and sitemap logic changed in Round 1, but the full Playwright E2E suite and the axe audit are not in the new Appendix C.

- Build for production (`astro build`) and run the app production-like (`wrangler dev` on the build output or `astro preview`), not the dev server.
- Run the COMPLETE Playwright E2E suite (all specs, previous count was 71). Report passed/failed/skipped and durations. Fix regressions caused by Round 1 changes (do not delete or weaken tests; if a test must change because behaviour intentionally changed, explain why in the log).
- Run `scripts/a11y-audit.mjs` and save the raw output. Coverage required: public pages, attempt screen WITH palette open, result, solutions, dashboard (logged-in fixture), key admin pages, `/q/{id}` pages, login/signup; light and dark; 375px and 1280px.
- Add Appendix C sections generated from the runners' machine-readable output (Vitest JSON reporter, Playwright JSON reporter, axe JSON), not hand-written.
- Add the commit hash and run timestamp to each section.

DoD: Appendix C contains unit, E2E and axe results with raw counts and the commit hash.

## FIX R2 — LIGHTHOUSE DONE PROPERLY (P1)

Problems: runs were against `localhost:4321` (likely the dev server), results swing widely between runs (Home 65 then 78; Subject 67 then 44), the mock-detail target is an E2E fixture, and the attempt screen has LCP about 17 s and performance about 46.

- Run against the production build (see R1). 5 runs per route and theme; report the MEDIAN and the min/max. Record Lighthouse version, throttling, device emulation, machine.
- Use real content routes (a real mock, a real subject page), not fixtures. Use a temporary DB copy for audits (rule 3).
- Investigate and fix the worst offenders with measurable before/after:
  - Attempt screen LCP (identify the LCP element; likely payload size, hydration, fonts or KaTeX). Target LCP < 4 s on the simulated 4G/4x CPU profile, TBT < 600 ms.
  - Subject page TBT (3,040 ms in one run) and KaTeX-heavy pages: defer KaTeX CSS/fonts, subset and preload only needed fonts, lazy-hydrate islands, split bundles, avoid rendering hundreds of questions at once (paginate or virtualise).
- Add a performance budget file and a CI check for JS/CSS bytes per route.

DoD: median table for 9 routes x 2 themes; attempt-screen budget met or the gap documented with cause.

## FIX R3 — CAPACITY MEASURED ON REAL D1 (P1)

Problem: "autosave = 1 row read" was not shown to come from real D1 metadata, and rows WRITTEN are missing (the free write limit is smaller than the read limit, so writes are the likelier bottleneck).

- Use the remote STAGING D1 (migrated and seeded via `export-content`). Read `meta.rows_read` and `meta.rows_written` from the D1 results (log per request in staging only).
- Run `scripts/load-test.mjs` against the staging Worker: N concurrent attempts, full lifecycle (start, autosaves at 15 s, submit, result, leaderboard).
- Report per full test: rows read, rows written, requests, KV reads/writes. Report per action too.
- Update `docs/CAPACITY_MODEL.md` with a table for 1k / 3k / 10k DAU including WRITES, assumptions stated, compared with the CURRENT documented Cloudflare free limits (re-check the pricing/limits pages, state the date; mark `UNVERIFIED` if you cannot).
- State the upgrade trigger and alert thresholds.

DoD: numbers come from staging D1 metadata, include writes, and say which environment produced them.

## FIX R4 — ENVIRONMENT FACTS (P1)

The report shows only "local vs production" and calls the stage "staging" without evidence.

- Produce `docs/ENVIRONMENTS.md` table: environment | D1 name | KV namespaces | R2 or fallback | deployed? | last applied migration | seeded with content? | auth mode. For all of local, staging, production. Show ids partially masked.
- Add `npm run check:migrations-remote` that lists applied migrations per remote DB and fails on drift.
- Confirm staging has migrations 0001 to 0020 and content, and that production contains no user rows. If production is not provisioned, say so.

DoD: three real rows in the table, verified by commands.

## FIX R5 — FIXTURES AND TEST DATA (P0)

- The Lighthouse "Mock Detail" target was `/mock/e2e-local-fixture-mock`. Find every fixture/test record (mocks with `e2e`/`fixture` slugs, test users, test sessions, test admin sessions, attempts with injected guest tokens, rights flags set during audits). List them with counts.
- Mark fixtures explicitly (`is_fixture` column or a reserved slug prefix enforced by a constant). In production mode fixtures are 404, excluded from sitemap, listings, search, leaderboards, and from `export-content`.
- Verify whether the 2 indexable "original standalone mocks" in the sitemap are real content or fixtures. Report the true count of real, indexable, original mocks.
- Add tests: fixture exclusion in each surface; `export-content` output contains zero fixtures and zero user rows.
- Revert any audit-only changes made to real local data (for example rights enabled on question 1, injected tokens) and note what was reverted.

DoD: counts of fixtures and real content in the log; tests pass.

## FIX R6 — REPORT HONESTY BY CONSTRUCTION (P0)

Problems: the hand-written narrative still has wrong versions (TypeScript 5.8, Tailwind 3.4.19, Playwright 1.58.0, axe 4.11.1, Wrangler 4.65.0 versus the lockfile: Tailwind 4.3.3, Playwright 1.64.1, axe 4.14.0, Wrangler 4.156.0); Appendix C test descriptions look authored rather than derived (for example "rollback/forward", "DKIM/SPF", roles "reviewer, analyst" that do not match the role model); the scorecard says `DONE/HIGH` for areas the evidence contradicts.

Do:
- Render the tech stack and counts in the report ONLY from `facts.json` (templates), never typed by hand. Add a test that compares every version string in the report with the lockfile and fails on any mismatch.
- Derive test descriptions from test names in the runner JSON. Remove any claim about what a test checks unless the test name or code shows it.
- Implement `scripts/scorecard.mjs` that computes each area's status from rules over facts and raw results, and write the output into the report and `report.json`. Minimum rules:
  - Tests and CI = `DONE` only if unit, E2E and axe raw results exist, pass, and carry the current commit hash.
  - Accessibility = `DONE` only with axe raw output covering the listed routes and both themes.
  - Performance = `DONE` only if all key routes meet the budgets in R2; otherwise `PARTIAL`.
  - External integrations = `PARTIAL` while any production credential, domain, Access app or backup secret is unset.
  - Deployment and ops = `PARTIAL` until staging is verified (R4) and backup secrets are set and a backup run succeeded.
  - Content library = `PARTIAL` while rights are `unknown` or explanations are `unreviewed`.
  - Confidence is `HIGH` only if the evidence was produced this round on this commit.
- Fix wording: the next exam cycle year must not be hard-coded. Use the cycle stored in `exam_info` (keyword data suggests 2027) and do not say "2026 NTA bulletin" unless that is the verified cycle. Ask the owner to confirm the cycle.
- Extend `report:verify` to also check versions, counts (reconcile with the DB), and that every cited appendix section exists.

DoD: report regenerates from data; version-drift test passes; scorecard script output matches the report.

## FIX R7 — THIN INDEXABLE PAGES AND CONTENT GAP (P1)

Indexable URLs are 89: about 51 are PYQ year and year-subject list pages (their papers are `noindex`), 25 exam and syllabus pages, 11 subject pages, and about 2 mocks. List pages with little unique text are a thin-content and ad-eligibility risk.

- Define a minimum indexable-content rule in `docs/SEO_RULES.md`: unique body text above a set threshold (default 300 words excluding navigation and lists) AND at least one real, original, playable item or a verified information block. Enforce it in `seo-consistency.mjs`: pages below the rule are `noindex` and excluded from the sitemap automatically.
- Apply to `/pyq/{year}` and `/pyq/{year}/{subject}` pages first. Keep them usable for students.
- Produce `docs/CONTENT_GAP.md` (no content generation): real original mocks per subject, subjects with 0 questions (8), indexable page counts by group, explanation review status, rights status, and the minimum original content needed per subject to qualify the subject page. This is input for the owner's content plan.

DoD: gate enforced and tested; gap document generated from the database.

## FIX R8 — SECURITY NOTES (P2)

- Document the real password hashing algorithm and parameters in `docs/SECURITY.md` (report says "PBKDF2/scrypt"; pick the truth). Workers WebCrypto limits PBKDF2 iterations, so document the cap, the rate-limit compensation, and a rehash-on-login upgrade path. Add a unit test that asserts the stored hash format and parameters.
- List the admin role names actually implemented, and make the report use those names.
- Confirm in the log that `ADMIN_AUTH_MODE=session` is refused in production (test exists) and that the bootstrap script is blocked in production.

## ORDER OF WORK

R5 (clean data first) -> R1 -> R4 -> R3 -> R2 -> R7 -> R8 -> R6 (regenerate report last).

## OUTPUT FORMAT (after each fix)

1. Fix id and status (`DONE` / `PARTIAL` / `BLOCKED`).
2. Evidence: commands, raw numbers, commit hash.
3. What is still unverified.
4. Owner decisions needed.

## STOP CONDITIONS

Ask the owner only for: confirming the exam cycle year, any action on remote production, credentials or domain, and content/rights decisions. Otherwise continue.

## START NOW

Begin with R5, then R1.
