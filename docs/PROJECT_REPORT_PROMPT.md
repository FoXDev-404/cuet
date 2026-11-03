# PROJECT REPORT PROMPT — Complete, evidence-based report of CUETFreeMockTest.com

Paste this whole file to your coding agent (the one that has access to the repository). The agent produces a report that you then upload to Claude for review and change suggestions.

---

## ROLE

You are a senior engineer and technical auditor with full access to this repository, its tests and its local tooling. Produce a COMPLETE, HONEST, EVIDENCE-BASED project report. A second reviewer (another AI and the site owner) will read ONLY your report, not the code, so everything they need to judge the project must be inside it.

## ABSOLUTE RULES

1. Evidence over claims. Every statement of status must cite proof: a file path (with line range when useful), a command and its summarized output, a test name, or a measured number. If you did not verify it, label it `UNVERIFIED`. Never write "should work".
2. Run things. Install dependencies if needed, then actually run: type-check, lint, unit tests, integration tests, E2E tests, production build, dependency audit, and Lighthouse (or equivalent) on key pages. Report real results, including failures. Do not hide or fix failures silently while reporting; if you fix something small to proceed, list it under "Changes made during reporting".
3. No secrets. Never print tokens, API keys, client secrets, password hashes, session ids, or real user emails/personal data. Env vars: names only, plus whether each is set (`set` / `unset`). Redact anything sensitive as `[REDACTED]`.
4. No data dumps. Schema and aggregate counts only. No row contents except harmless examples (seed/demo data).
5. Do not inflate. Use the status legend below exactly. If something is half-done, say `PARTIAL` and state what is missing.
6. Do not modify product behaviour while reporting. Read-only audit, except running tests/builds and writing report files.
7. If a command cannot run (missing credentials, offline, tool missing), say so and mark the dependent items `UNVERIFIED`.

## STATUS LEGEND (use only these)

`DONE` (implemented and verified by evidence) | `PARTIAL` | `MISSING` | `BROKEN` (exists but fails) | `UNVERIFIED` (exists, could not verify) | `N/A`

## OUTPUT FILES

Write everything to `/docs/report/`:

1. `PROJECT_REPORT.md`: the main report (structure below). Aim for completeness with clear tables; keep prose short. Target 4,000 to 10,000 words.
2. `APPENDIX_A_ROUTES.md`: full route inventory (auto-generated from the code/router, not typed by hand).
3. `APPENDIX_B_SCHEMA.md`: actual current schema (DDL from migrations or `sqlite_master`), table row counts, indexes.
4. `APPENDIX_C_TEST_RESULTS.md`: summarized raw outputs (counts passed/failed/skipped, failing test names with error message, durations).
5. `APPENDIX_D_DEPENDENCIES.md`: dependency list with versions, outdated packages, `npm audit` summary.
6. `APPENDIX_E_FILE_TREE.md`: file tree (depth 4) with one-line purpose of each top-level folder.
7. `report.json`: machine-readable summary (scorecard, counts, open issues with ids).

Finish by telling the owner the exact files to upload (normally `PROJECT_REPORT.md` plus appendices if size allows; the main file must stand alone).

## STRUCTURE OF `PROJECT_REPORT.md`

### 0. Executive summary (max one page)
- What the product is, current stage (prototype / staging / launch-ready), and an honest overall verdict.
- Scorecard table: area | status | confidence (high/med/low) | one-line reason. Areas: Test engine, Scoring and leaderboard, Auth and sessions, Admin panel, Content library, Public pages and SEO, Design system and dark/light theme, Question sharing, Media/images, Security, Performance, Accessibility, Tests and CI, Deployment and ops, Legal and AdSense readiness, External integrations.
- Top 10 problems ranked by severity (P0 breaks trust/security, P1 blocks launch or SEO, P2 improvement), each with an id (e.g. `ISSUE-001`).
- Top 5 things working well.

### 1. Project overview
Purpose, audience, goals, scope. What is intentionally NOT built. Links to the planning documents in the repo (blueprint, keyword map, prompts) and whether the code matches them.

### 2. Tech stack and environments
Languages, frameworks, runtime (Astro version, Workers/Pages, Node version), libraries with versions, build tooling, package manager. Environments: local, staging, production: what exists and how they differ (bindings, env vars, auth mode). Cloudflare resources used: D1, KV, R2 (enabled or fallback), Access, cron, workflows. For each, state `in use` / `configured` / `fallback` / `missing`.

### 3. Architecture
- Component diagram (ASCII or Mermaid): browser, Astro pages, API layer, D1, KV, R2/fallback, auth, admin gate.
- Request flows: public page, attempt start/autosave/submit, share page, admin edit.
- Folder structure and where each concern lives (pages, API handlers, shared libs, migrations, tests, scripts).
- Key design decisions and where they deviate from the blueprint, with reasons.

### 4. Data model
- ER overview and table catalogue: table | purpose | rows (count) | key constraints | indexes | soft delete (yes/no).
- Migration history: list, whether all apply on an empty DB, whether the latest apply on a copy of current data (state how you checked).
- Data integrity checks you ran (orphan rows, duplicate slugs, questions without explanation, invalid `correct_option`, mocks without questions). Report counts.
- Versioning model for mocks/questions and how published content is protected.

### 5. Feature inventory (the core of the report)
A table per module with columns: feature | status | evidence | notes/gaps. Modules:
1. Public site: home, hubs, subject pages, mock list/detail, PYQ pages, exam-info pages, blog, legal pages, search.
2. Test engine: instructions, attempt screen, timer, autosave, resume, palette, language toggle, submit, result, solutions, retry wrong questions.
3. Scoring and ranking: marking scheme source, formula, tie-breakers, first-attempt rule, leaderboard scopes.
4. Auth: signup/login, Google OAuth, sessions, password reset, guest attempts and claiming, account deletion/export.
5. User dashboard and profile: each metric/page, privacy settings, public profile.
6. Discussion and moderation: posting, replies, votes, reports, rate limits, auto-approve, mute.
7. Admin panel: coverage matrix of EVERY table versus list/create/edit/delete/restore/export UI; roles and permission matrix as implemented; direct-edit/hotfix and rescore; data manager; trash; audit log. State whether the Super Admin can really edit questions, papers, mocks, users and all data from the UI (yes/no per entity).
8. Question sharing: public ids, public page, share sheet, image generation, reveal policy, SEO policy, admin controls.
9. Media: upload pipeline, validation, storage (R2 or KV fallback), alt text, KaTeX.
10. Design system: tokens file, theme engine (system/light/dark), no-flash behaviour, toggle, component list, hard-coded colour violations (count and files).
11. SEO: per page group, see section 8.
12. Monetisation readiness: ad slots, privacy policy accuracy.

### 6. Content status
Counts: subjects, topics, questions (by status, with/without explanation, with image, EN only vs EN+HI), passages, mocks (by status/type), versions, PYQ papers (with source URL and rights note or not), published ranked mocks, unranked practice sets, OCR drafts. Which content is ranked, unranked, noindex. Review/provenance status of each paper. List what content is needed to reach launch quality.

### 7. Security review
Table of each gate (from the blueprint section 16 and the admin/share prompts) | status | evidence. Must include:
- Answer-key leakage test result (what endpoints and HTML were scanned).
- Timer/deadline enforcement, double submit, autosave idempotency.
- IDOR checks (attempt/result/dashboard), role bypass checks on admin APIs, CSRF, rate limits, XSS and SQL injection checks, upload validation (type spoofing, SVG), CORS, cookie flags, session rotation, password hashing method.
- Admin auth mode currently used and what changes when Cloudflare Access is enabled.
- Secrets handling (confirm none committed; scan the repo and git history for patterns, report only counts and file names).
- Dependency vulnerabilities (`npm audit` summary).

### 8. SEO review
- Per page group: title and description uniqueness (report duplicates and over-length counts), single `h1`, canonical, noindex rules, JSON-LD types used and whether they are eligible, internal links, breadcrumbs.
- `sitemap.xml` and `robots.txt`: URL count, any private or noindex URL included (must be 0), any indexable page missing.
- Keyword map coverage: for each target page in `/docs/CUET_KEYWORD_MAP.md` say exists/missing, primary keyword used in title/h1, content length, originality status.
- Thin or empty indexable pages (list), duplicate content risks, canonical issues.
- Rendering check: is main content present in server HTML (fetch with JS disabled and report).

### 9. Performance and accessibility
- Lighthouse mobile scores (Performance, Accessibility, Best Practices, SEO) for: home, mock list, mock detail, instructions, attempt screen, result, a subject page, a public question page, an admin page, in BOTH light and dark themes. Table with real numbers, plus the top 3 issues per page.
- Core Web Vitals proxies (LCP, CLS, TBT), JS bundle sizes per route, image weights, font loading.
- Accessibility: axe results in both themes (violation counts by severity), keyboard test of the attempt flow, contrast failures, focus visibility.
- Free-tier safety: measured D1 rows read per key action (page view, attempt start, autosave, submit, leaderboard, share check), top 5 heaviest queries with `EXPLAIN QUERY PLAN` notes, estimated capacity at 100, 1,000 and 10,000 daily users versus documented free limits (state the limits you used and the date checked, mark them UNVERIFIED if not re-checked).

### 10. Testing and CI
Test inventory by layer: unit, integration, E2E, security, accessibility, performance. For each: number of tests, pass/fail/skip, coverage figure if available, flaky tests, notable gaps (which blueprint test requirements have no test). Describe CI (workflows, triggers, secrets needed), whether CI is green, build time.

### 11. Deployment and operations
How to build and deploy (exact commands), environment variable inventory (name | purpose | set/unset | required for which feature | behaviour when missing), migrations process, rollback procedure, backups (workflow present? secrets set? last successful run), monitoring/logging, error reporting, analytics. Domain/DNS status.

### 12. External dependencies and blockers
Table: item | needed for | free option | owner action required | current fallback in code. Cover domain, Google OAuth, email provider, Cloudflare Access, R2, Analytics, Search Console, AdSense, backup secrets, content rights.

### 13. Known bugs, TODOs and tech debt
Table: id | area | description | severity | how to reproduce | suggested fix | effort (S/M/L). Pull from code (`TODO`, `FIXME`, `HACK`), failing tests, console errors, and your own findings. Include dead code, duplicated logic, oversized files, missing types, inconsistent naming.

### 14. Gap analysis versus planning documents
- Blueprint v2: list each section and status.
- Admin panel prompt, design prompt, share prompt, full-agent prompt: for each requirement group give status.
- Anything built that is NOT in the plans (scope creep), and anything in the plans that contradicts reality.

### 15. Risk register
Table: risk | likelihood | impact | mitigation | owner. Include wrong answers, answer leakage, copyright of papers/images, free-tier exhaustion, thin content and AdSense rejection, privacy, admin misuse, single point of failure, data loss.

### 16. Recommended roadmap (your own opinion)
Prioritised next steps in three horizons: this week, before launch, after launch. Each with effort and the issue ids it resolves. State what you would cut from scope.

### 17. Questions for the owner and the reviewer
List decisions or information you need (max 15), and 5 specific things you want an independent reviewer to double-check.

### 18. Changes made during reporting
List any file changed, and why. If none, say "none".

## HOW TO COLLECT EVIDENCE (run these, adapt to the repo)

- `git log --oneline | head -50`, `git shortlog -sn`, `git status`, branch list, last commit date, repo size.
- Tree and size: file counts by extension, largest files, lines of code by area.
- Dependencies: `npm ls --depth=0`, `npm outdated`, `npm audit --omit=dev`.
- Quality: type-check, lint, unit/integration tests, Playwright E2E, production build with bundle analysis.
- Migrations: apply all on an empty local D1; list tables; run integrity SQL (counts only).
- Routes: generate from the router/pages folder and API handlers; do not hand-write.
- Env inventory: grep all `import.meta.env`, `process.env`, `env.` bindings in code; list names and defaults only.
- Secrets scan: grep for key patterns in the working tree and in git history; report counts and file names only.
- SEO: crawl the local/staging site, extract title/meta/h1/canonical/robots/JSON-LD per URL, check sitemap against crawl.
- Performance and a11y: Lighthouse CLI and axe in light and dark themes (set `colorScheme` via emulation).
- Answer-key leakage: capture network and HTML for a started attempt and for public question pages and scan for answer fields.

## QUALITY BAR FOR THE REPORT

- A reader who never saw the code must be able to answer: What works? What is broken? What is missing? What is risky? What should be done next and in what order?
- Tables over paragraphs. Every number has a source. Every `DONE` has evidence. Every `UNVERIFIED` says why.
- Consistent issue ids across sections (`ISSUE-001` ...), reused in the roadmap.
- No marketing language, no guesses presented as facts.

## FINAL STEP

1. Re-read the report and check: no secrets, no personal data, all sections present, ids consistent, scorecard matches the details.
2. Output a short message to the owner containing: the list of files to upload, the overall verdict in two sentences, and the top 5 issue ids.

## START NOW

Begin by listing the repository root and the commands you will run, then execute the evidence collection before writing any section.
