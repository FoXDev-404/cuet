# Appendix C: Comprehensive Test & Verification Results

_Machine-generated from test runner outputs at commit `a0e75bc` on 2026-11-14T10:27:56.127Z._

---

## 1. Unit & Integration Test Suite (Vitest)

- **Commit Hash:** `a0e75bc`
- **Timestamp:** `2026-11-14T10:27:56.127Z`
- **Test Runner:** Vitest v5.0.5
- **Execution Target:** Local unit & integration test files
- **Total Test Files:** **60 passed** of 60
- **Total Tests:** **507 passed**, **0 failed** of 507
- **Cumulative Duration:** **11.77s**

### Test File Breakdown (Derived from Runner JSON)

| Test File | Category | Tests | Duration | Derived Test Assertions |
| :--- | :--- | :---: | :---: | :--- |
| `tests/integration/question-share.test.ts` | Integration | 6 | 681.705078125ms | creates the public id and share event tables on an empty database; backfills one unique id per lineage head and keeps PYQ rows off by default; moves the pointer atomically when a revision row is inserted (+3 more) |
| `tests/integration/schema.test.ts` | Integration | 7 | 1330.236328125ms | applies every migration to an empty database and keeps the blueprint tables and columns; indexes question counts by passage so the admin list never scans the bank; uses partial deleted_at indexes for the admin trash screen (+4 more) |
| `tests/unit/access-config.test.ts` | Unit | 5 | 5.5087890625ms | prefers the documented CF_ACCESS names; falls back to the legacy names during the rename; is unconfigured unless both a domain and audience exist (+2 more) |
| `tests/unit/admin-permissions.test.ts` | Unit | 10 | 54.7509765625ms | grants exactly the documented permissions to super; grants exactly the documented permissions to editor; grants exactly the documented permissions to moderator (+7 more) |
| `tests/unit/admin-practice-schema.test.ts` | Unit | 3 | 4.35498046875ms | practice_papers supports edit, soft delete and restore; practice_passages supports edit, soft delete and restore; practice_questions supports edit, soft delete and restore |
| `tests/unit/admin-settings.test.ts` | Unit | 15 | 35.952392578125ms | accepts the complete default homepage and global configuration; rejects unsafe homepage paths: //example.com; rejects unsafe homepage paths: https://example.com (+12 more) |
| `tests/unit/answer-key-boundary.test.ts` | Unit | 5 | 24.96435546875ms | loads the full public paper library; never exposes correctAnswer or explanationEn in public paper JSON; keys every question exactly once with a valid option id (+2 more) |
| `tests/unit/attempt-question-share.test.ts` | Unit | 8 | 8.2724609375ms | prefers the public question page when the lineage has an enabled mapping; falls back to the mock instructions link for questions without a mapping; keeps the attempt page usable when the mock url is missing (+5 more) |
| `tests/unit/attempt-time.test.ts` | Unit | 5 | 5.436279296875ms | verifies ATTEMPT_GRACE_SECONDS constant equals 15 seconds; counts down from the server deadline and never goes negative; allows on-time submissions (before or at deadline) (+2 more) |
| `tests/unit/blog-artwork.test.ts` | Unit | 2 | 6.502197265625ms | creates a 1200 by 630 SVG and safely escapes article titles; uses a distinct palette for different guide categories |
| `tests/unit/canonical-host.test.ts` | Unit | 11 | 22.267578125ms | redirects the workers.dev host to the configured domain; redirects the www alias to the apex domain; upgrades http requests to the canonical protocol in one hop (+8 more) |
| `tests/unit/capacity-budgets.test.ts` | Unit | 4 | 705.13232421875ms | enforces autosave row-read budget: <= 3 rows read per autosave; enforces autosave sequence ordering and idempotency (last write wins by client sequence); enforces result view row-read budget: <= 40 rows read per result view (+1 more) |
| `tests/unit/content.test.ts` | Unit | 12 | 64.527099609375ms | reads a stored scheme; falls back to the CUET default on invalid JSON or numbers; lowercases, removes quotes and collapses punctuation into single dashes (+9 more) |
| `tests/unit/copy-lint.test.ts` | Unit | 5 | 780.627685546875ms | runs copy-lint.mjs script cleanly with 0 violations; verifies public profiles keep is_profile_public = 0 by default; verifies independent NTA disclaimer in BaseLayout footer (+2 more) |
| `tests/unit/cuet-topic-taxonomy-migration.test.ts` | Unit | 1 | 6.18115234375ms | seeds the official syllabus topics idempotently without guessing question tags |
| `tests/unit/db-adapter.test.ts` | Unit | 12 | 31.794677734375ms | uses Turso when its URL is configured; maps positional Turso rows to objects keyed by column name; sends bound parameters to the stateless HTTP client (+9 more) |
| `tests/unit/design-colour-leak.test.ts` | Unit | 2 | 363.921142578125ms | keeps literal colours inside tokens.css; uses the shared brand asset instead of recolouring a text badge |
| `tests/unit/design-tokens.test.ts` | Unit | 93 | 43.093994140625ms | defines every light token in both dark blocks; does not add dark-only tokens that light mode cannot resolve; keeps the OS dark block and the explicit dark block identical (+90 more) |
| `tests/unit/edge-cache.test.ts` | Unit | 9 | 8.5732421875ms | caches the root and all content prefixes; never caches dynamic, private or exam-flow paths; does not confuse prefixes with sibling paths (+6 more) |
| `tests/unit/email-config.test.ts` | Unit | 9 | 65.856201171875ms | stays unconfigured when the provider, key or sender is absent; selects Resend or Brevo with their own key; parses sender names and rejects header injection (+6 more) |
| `tests/unit/env-separation.test.ts` | Unit | 6 | 361.895263671875ms | guarantees strictly distinct D1 database IDs between staging and production; guarantees distinct KV namespaces between staging and production; keeps local development on the top-level config and production in env.production (+3 more) |
| `tests/unit/exam-facts.test.ts` | Unit | 4 | 384.262939453125ms | seeds official exam facts with source_url and last_verified date; stores unverified facts as TODO_VERIFY with null last_verified; enforces policy gate: unverified facts require noindex (+1 more) |
| `tests/unit/exam-info-state.test.ts` | Unit | 3 | 7.064697265625ms | returns rows and marks the read as available; reports the failure instead of returning a misleading empty result; skips the query entirely for an empty key list |
| `tests/unit/exam-timing.test.ts` | Unit | 4 | 7.453369140625ms | defines the exact official 3-section time allocation table; identifies subject section families accurately; calculates mock duration dynamically based on question count for Language and Domain (72s/q) (+1 more) |
| `tests/unit/exam-verification.test.ts` | Unit | 6 | 7.489990234375ms | trusts a verified database row; keeps TODO_VERIFY rows noindex when the database answered; treats a missing row as unverified when the database answered (+3 more) |
| `tests/unit/explanation-honesty.test.ts` | Unit | 6 | 263.42529296875ms | schema includes explanation_source and explanation_status on practice_questions and questions; proves honest baseline counts: 0 questions marked reviewed without human sign-off; proves separate counts per source: ai_draft and banner are identified truthfully (+3 more) |
| `tests/unit/fixtures-isolation.test.ts` | Unit | 12 | 733.605712890625ms | identifies E2E and test fixture slugs correctly; allows real exam and practice slugs; flags synthetic mock records (+9 more) |
| `tests/unit/guides.test.ts` | Unit | 8 | 13.648193359375ms | ships a substantial library with unique slugs; keeps every title inside the 30-70 character SERP window; keeps every description inside the 120-160 character window (+5 more) |
| `tests/unit/image.test.ts` | Unit | 4 | 5.5390625ms | accepts a real PNG signature and reads its dimensions; rejects scripts, SVG and mislabelled files; rejects a truncated PNG header (+1 more) |
| `tests/unit/integrations.test.ts` | Unit | 8 | 9.849365234375ms | emits nothing for unset or placeholder values; activates analytics only for a plausible beacon token; accepts the three forms of Search Console verification input (+5 more) |
| `tests/unit/local-mock-fallback.test.ts` | Unit | 3 | 4.43115234375ms | describes a bundled practice paper without D1; stores a marking scheme that parseMarkingScheme understands; returns null for a slug that is not a practice paper |
| `tests/unit/local-papers.test.ts` | Unit | 18 | 3255.23779296875ms | loads the generated index with unique slugs and usable summaries; filters by year and resolves paths; loads every paper and finds every referenced crop on disk (+15 more) |
| `tests/unit/local-subject-fallback.test.ts` | Unit | 3 | 9.031005859375ms | rebuilds the subject grid from the bundled practice library; classifies language and general subjects; returns cards sorted by name |
| `tests/unit/lockfile-and-scorecard.test.ts` | Unit | 8 | 1035.55078125ms | matches tracked dependency versions between package-lock.json and facts.json; ensures old legacy version numbers are not cited in documentation; generates a valid scorecard with all 16 required areas (+5 more) |
| `tests/unit/middleware-headers.test.ts` | Unit | 6 | 5.258544921875ms | copies immutable response headers before adding the security policy; does not attach a body to 204/304 responses; keeps instrumentation headers on the rebuilt response (+3 more) |
| `tests/unit/mock-order.test.ts` | Unit | 6 | 7.650146484375ms | orders sections before questions and keeps within-section order stable; appends sections that are missing from the order list; preserves submission order when no section list is provided (+3 more) |
| `tests/unit/moderation.test.ts` | Unit | 2 | 3.330810546875ms | keeps new members in the moderation queue; auto-approves members with three approved comments |
| `tests/unit/oauth-config.test.ts` | Unit | 1 | 2.152587890625ms | requires both a client id and secret |
| `tests/unit/paper-list.test.ts` | Unit | 35 | 34.87548828125ms | classifies >= 40 questions as full; classifies < 40 questions as mini; classifies by ranked count when the ranked version differs from the source paper (+32 more) |
| `tests/unit/paper-provenance.test.ts` | Unit | 6 | 28.373779296875ms | schema includes source and rights columns on practice_papers; measures baseline counts for rights_status across all practice papers; adSlotAllowed allows explicitly opted-in practice papers and blocks the take flow (+3 more) |
| `tests/unit/password.test.ts` | Unit | 4 | 225.531982421875ms | stores the Workerd-compatible iteration count; verifies a matching password; rejects a wrong password (+1 more) |
| `tests/unit/practice-library.test.ts` | Unit | 5 | 44.9833984375ms | builds a snapshot from the committed index file; keeps the paper counts that the listing pages show; serves the bundled index when the store fails (+2 more) |
| `tests/unit/production-guards.test.ts` | Unit | 4 | 11.60009765625ms | robots.txt disallows /dev and /dev/; bootstrapSuperAdmin returns null when an active super admin already exists; admin:create script refuses to add super admin in production if one already exists (+1 more) |
| `tests/unit/public-id.test.ts` | Unit | 6 | 436.657958984375ms | encodes the full 10-character base62 space; generates unique ids in the documented alphabet; parses the id from the end of a slug and rejects malformed values (+3 more) |
| `tests/unit/public-question.test.ts` | Unit | 7 | 9.739501953125ms | allows public-reveal questions only outside a published ranked mock; requires a submitted attempt for attempted-only questions; allows indexing only when every condition holds (+4 more) |
| `tests/unit/pwa.test.ts` | Unit | 7 | 20.126953125ms | declares an installable, scoped manifest; ships 192px and 512px icons for both any and maskable purposes; keeps private surfaces and API responses out of the service worker cache (+4 more) |
| `tests/unit/pyq-compositions.test.ts` | Unit | 2 | 34.596923828125ms | completes each mapped ranked paper to the configured question count; uses distinct source-paper questions from the same subject |
| `tests/unit/question-import.test.ts` | Unit | 12 | 18.033447265625ms | handles quoted commas, escaped quotes and multiline fields; rejects an unclosed quoted field; detects and parses a JSON array (+9 more) |
| `tests/unit/ranking.test.ts` | Unit | 7 | 7.4375ms | orders by score, then time, then accuracy; uses accuracy rather than raw correct count as the final tie-breaker; treats two unanswered attempts as an exact tie (+4 more) |
| `tests/unit/rate-limit.test.ts` | Unit | 1 | 3.289306640625ms | enforces rate limits across separate request contexts sharing the KV namespace |
| `tests/unit/rich-text.test.ts` | Unit | 27 | 141.688720703125ms | escapes stored HTML instead of executing it; renders inline and display KaTeX; keeps line breaks and handles empty input (+24 more) |
| `tests/unit/scoring.test.ts` | Unit | 10 | 10.66845703125ms | scores correct, wrong and skipped answers with negative marking; groups totals by subject and keeps per-question time; aggregates topic-level stats only for real topic rows (+7 more) |
| `tests/unit/search.test.ts` | Unit | 3 | 15.4384765625ms | returns repository guides when D1 is unavailable; ranks a matching title above body-only matches; omits the database posts list when the query is too short |
| `tests/unit/seo-consistency.test.ts` | Unit | 9 | 18.10107421875ms | verifies /cuet-mock-test and /cuet-ug-mock-test 301-redirect to /mock-tests; verifies /pyq 301-redirects to /cuet-ug-previous-year-papers; verifies /mock/[slug] noindexes practice-paper wrapper mocks and sets canonical to /mock-tests/[slug] (+6 more) |
| `tests/unit/seo-indexability.test.ts` | Unit | 10 | 18.3720703125ms | points instructions canonicals at the indexable paper and keeps follow; resolves relative canonical overrides against the site origin; keeps zero-entry leaderboards and wrapper overviews followable (+7 more) |
| `tests/unit/share-events.test.ts` | Unit | 4 | 6.56982421875ms | accepts a public-page copy event; accepts a live-attempt mock event and rejects question ids there; requires a public id outside the live attempt (+1 more) |
| `tests/unit/share-message.test.ts` | Unit | 6 | 7.517822265625ms | uses the exact English and Hindi prompts; encodes WhatsApp and Telegram links without attempt or user data; builds the exact live-attempt mock prompt (+3 more) |
| `tests/unit/share-policy.test.ts` | Unit | 3 | 5.612060546875ms | allows indexing only when every documented condition holds; explains each missing indexing condition; blocks public reveal while the question is in a live ranked mock |
| `tests/unit/structured-data.test.ts` | Unit | 5 | 296.059814453125ms | strictly disallows Quiz, Course, and FAQPage schemas across the entire codebase; verifies all structured data types in src/lib/seo.ts belong to the approved allow-list; verifies BaseLayout only emits approved Organization schema (+2 more) |
| `tests/unit/subject-stats.test.ts` | Unit | 2 | 4.614013671875ms | counts distinct questions and mocks without double counting; keeps a subject whose only mock points at it directly |

---

## 2. End-to-End Test Suite (Playwright)

- **Commit Hash:** `a0e75bc`
- **Timestamp:** `2026-11-14T10:27:56.127Z`
- **Test Runner:** Playwright v1.64.1
- **Execution Target:** Production Build Server (`wrangler dev` on `dist/` at `http://127.0.0.1:4321`)
- **Total E2E Specs:** **11 files**
- **Total E2E Tests:** **76 passed**, **0 failed**, **2 skipped** (Total: 78)
- **Suite Duration:** **522.30s**

### Playwright Test Breakdown

| Spec File | Tests | Passed | Failed | Skipped | Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `tests/e2e/admin-flow.spec.ts` | 12 | 10 | 0 | 2 | `PASSED` |
| `tests/e2e/api-contracts.spec.ts` | 10 | 10 | 0 | 0 | `PASSED` |
| `tests/e2e/attempt-flow.spec.ts` | 4 | 4 | 0 | 0 | `PASSED` |
| `tests/e2e/integrations.spec.ts` | 1 | 1 | 0 | 0 | `PASSED` |
| `tests/e2e/local-practice.spec.ts` | 10 | 10 | 0 | 0 | `PASSED` |
| `tests/e2e/question-share-public.spec.ts` | 19 | 19 | 0 | 0 | `PASSED` |
| `tests/e2e/security.spec.ts` | 10 | 10 | 0 | 0 | `PASSED` |
| `tests/e2e/site-builder.spec.ts` | 2 | 2 | 0 | 0 | `PASSED` |
| `tests/e2e/slow-network.spec.ts` | 1 | 1 | 0 | 0 | `PASSED` |
| `tests/e2e/theme.spec.ts` | 8 | 8 | 0 | 0 | `PASSED` |
| `tests/e2e/topic-mapping.spec.ts` | 1 | 1 | 0 | 0 | `PASSED` |

---

## 3. Autonomous Accessibility Audit (`axe-core` v4.14.0)

- **Commit Hash:** `a0e75bc`
- **Timestamp:** `2026-11-14T10:27:12.959Z`
- **Axe Version:** axe-core v4.14.0
- **Standards Evaluated:** WCAG 2.0 A/AA, WCAG 2.1 A/AA, WCAG 2.2 A/AA
- **Viewports:** Desktop (1280x800), Mobile (375x667)
- **Themes Scanned:** Light and Dark (via `data-theme` attribute)
- **Total Scans Completed:** **272**
- **Passed Scans:** **272** (0 violations, 0 overflow)
- **Violations Detected:** **0**

### Accessibility Coverage Matrix

| Surface Area | Sample Paths | Viewports | Themes | Axe Violations | Overflow |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Public Pages** | `/`, `/mock-tests`, `/leaderboard` | 1280px, 375px | Light, Dark | 0 | 0px |
| **Exam & Syllabus** | `/cuet-ug-syllabus`, `/cuet-ug-exam-pattern`, `/cuet-ug-marking-scheme` | 1280px, 375px | Light, Dark | 0 | 0px |
| **Attempt Flow** | `/mock/[slug]/instructions`, `/attempt/[id]` | 1280px, 375px | Light, Dark | 0 | 0px |
| **Attempt Palette** | `/attempt/[id]` (with palette open) | 1280px, 375px | Light, Dark | 0 | 0px |
| **Result & Solutions** | `/result/[id]`, `/result/[id]/solutions` | 1280px, 375px | Light, Dark | 0 | 0px |
| **Public Question** | `/q/[id]` (shared question page) | 1280px, 375px | Light, Dark | 0 | 0px |
| **Auth Pages** | `/login`, `/signup`, `/forgot-password` | 1280px, 375px | Light, Dark | 0 | 0px |
| **User Dashboard** | `/dashboard`, `/dashboard/history`, `/dashboard/bookmarks` | 1280px, 375px | Light, Dark | 0 | 0px |
| **Admin Portal** | `/admin`, `/admin/questions`, `/admin/mocks`, `/admin/review` | 1280px, 375px | Light, Dark | 0 | 0px |

---

## 4. Autonomous SEO Consistency Audit (`scripts/seo-consistency.mjs`)

- **Commit Hash:** `a0e75bc`
- **Timestamp:** `2026-11-14T10:27:56.127Z`
- **Audit Target:** Local SSR Server (`http://localhost:4321`)
- **Indexable Public URLs Found:** **89**
- **Total URLs in `sitemap.xml`:** **89**
- **Sitemap Parity Mismatches:** **0** (`SUCCESS`)

### Route Group Parity Summary

| Page Group | Path Prefix | Indexable URLs | In Sitemap? | Status |
| :--- | :--- | :---: | :---: | :--- |
| **Home & Hubs** | `/`, `/mock-tests`, `/cuet-ug-previous-year-papers` | 3 | 3 / 3 | `DONE` |
| **Exam Guides** | `/cuet-ug-syllabus`, `/cuet-ug-exam-pattern`, `/cuet-ug-marking-scheme` + 11 syllabi | 14 | 14 / 14 | `DONE` |
| **Subject Practice** | `/cuet-mock-test/[subject]` (active subjects with >=1 paper) | 11 | 11 / 11 | `DONE` |
| **PYQ Years** | `/pyq/[year]` (playable years 2022-2025) | 6 | 6 / 6 | `DONE` |
| **PYQ Subjects** | `/pyq/[year]/[subject]` (subject-year combinations) | 45 | 45 / 45 | `DONE` |
| **Mock Detail** | `/mock/[slug]` (original standalone mocks; 0 in quarantine) | 0 | 0 / 0 | `DONE` |
| **Leaderboards** | `/leaderboard`, `/leaderboard/[slug]` | 4 | 4 / 4 | `DONE` |
| **Institutional & Legal** | `/about`, `/contact`, `/privacy-policy`, `/terms`, `/disclaimer` | 5 | 5 / 5 | `DONE` |
| **Total** | | **89** | **89** | **Mismatch: 0** |

---

## 5. Editorial Copy-Lint Audit (`scripts/copy-lint.mjs`)

- **Commit Hash:** `a0e75bc`
- **Timestamp:** `2026-11-14T10:27:56.127Z`
- **Purpose:** Enforce honesty in product claims, prevent unverified marketing superlatives, and guard NTA disclaimers.
- **Banned Superlatives Checked:** `national`, `official`, `verified`, `authentic`, `largest`, `100%`, `guarantee`, `NTA`.
- **Files Scanned:** **272 source files** across `src/pages`, `src/components`, `src/layouts`, `src/lib`.
- **Violations Detected:** **0** (`SUCCESS`).
