# Appendix C: Comprehensive Test & Verification Results

_Machine-generated from test runner outputs at commit `75ea44f` on 2026-11-04T11:55:34.073Z._

---

## 1. Unit & Integration Test Suite (Vitest)

- **Commit Hash:** `75ea44f`
- **Timestamp:** `2026-11-04T11:55:34.073Z`
- **Test Runner:** Vitest v5.0.5
- **Execution Target:** Local unit & integration test files
- **Total Test Files:** **42 passed** of 42
- **Total Tests:** **315 passed**, **0 failed** of 315
- **Cumulative Duration:** **10.20s**

### Test File Breakdown (Derived from Runner JSON)

| Test File | Category | Tests | Duration | Derived Test Assertions |
| :--- | :--- | :---: | :---: | :--- |
| `tests/integration/question-share.test.ts` | Integration | 6 | 678.51953125ms | creates the public id and share event tables on an empty database; backfills one unique id per lineage head and keeps PYQ rows off by default; moves the pointer atomically when a revision row is inserted (+3 more) |
| `tests/integration/schema.test.ts` | Integration | 5 | 954.11669921875ms | applies every migration to an empty database and keeps the blueprint tables and columns; migrates a populated legacy database without changing stored scores; freezes a published version and its question membership (+2 more) |
| `tests/unit/access-config.test.ts` | Unit | 5 | 5.537109375ms | prefers the documented CF_ACCESS names; falls back to the legacy names during the rename; is unconfigured unless both a domain and audience exist (+2 more) |
| `tests/unit/admin-permissions.test.ts` | Unit | 10 | 65.7587890625ms | grants exactly the documented permissions to super; grants exactly the documented permissions to editor; grants exactly the documented permissions to moderator (+7 more) |
| `tests/unit/admin-practice-schema.test.ts` | Unit | 3 | 4.48291015625ms | practice_papers supports edit, soft delete and restore; practice_passages supports edit, soft delete and restore; practice_questions supports edit, soft delete and restore |
| `tests/unit/attempt-time.test.ts` | Unit | 5 | 4.400146484375ms | verifies ATTEMPT_GRACE_SECONDS constant equals 15 seconds; counts down from the server deadline and never goes negative; allows on-time submissions (before or at deadline) (+2 more) |
| `tests/unit/capacity-budgets.test.ts` | Unit | 4 | 772.134521484375ms | enforces autosave row-read budget: <= 3 rows read per autosave; enforces autosave sequence ordering and idempotency (last write wins by client sequence); enforces result view row-read budget: <= 40 rows read per result view (+1 more) |
| `tests/unit/content.test.ts` | Unit | 12 | 68.503173828125ms | reads a stored scheme; falls back to the CUET default on invalid JSON or numbers; lowercases, removes quotes and collapses punctuation into single dashes (+9 more) |
| `tests/unit/copy-lint.test.ts` | Unit | 5 | 302.43115234375ms | runs copy-lint.mjs script cleanly with 0 violations; verifies public profiles keep is_profile_public = 0 by default; verifies independent NTA disclaimer in BaseLayout footer (+2 more) |
| `tests/unit/design-colour-leak.test.ts` | Unit | 2 | 205.925048828125ms | keeps literal colours inside tokens.css; uses the shared brand asset instead of recolouring a text badge |
| `tests/unit/design-tokens.test.ts` | Unit | 79 | 50.072021484375ms | defines every light token in both dark blocks; does not add dark-only tokens that light mode cannot resolve; keeps the OS dark block and the explicit dark block identical (+76 more) |
| `tests/unit/email-config.test.ts` | Unit | 9 | 69.796875ms | stays unconfigured when the provider, key or sender is absent; selects Resend or Brevo with their own key; parses sender names and rejects header injection (+6 more) |
| `tests/unit/env-separation.test.ts` | Unit | 4 | 423.921142578125ms | guarantees strictly distinct D1 database IDs between staging and production; guarantees distinct KV namespaces between staging and production; check-env-separation.mjs script passes and exits with code 0 (+1 more) |
| `tests/unit/exam-facts.test.ts` | Unit | 4 | 255.19775390625ms | seeds official exam facts with source_url and last_verified date; stores unverified facts as TODO_VERIFY with null last_verified; enforces policy gate: unverified facts require noindex (+1 more) |
| `tests/unit/explanation-honesty.test.ts` | Unit | 6 | 23.64990234375ms | schema includes explanation_source and explanation_status on practice_questions and questions; proves honest baseline counts: 0 questions marked reviewed without human sign-off; proves separate counts per source: ai_draft and banner are identified truthfully (+3 more) |
| `tests/unit/fixtures-isolation.test.ts` | Unit | 12 | 492.57958984375ms | identifies E2E and test fixture slugs correctly; allows real exam and practice slugs; flags synthetic mock records (+9 more) |
| `tests/unit/image.test.ts` | Unit | 4 | 5.55322265625ms | accepts a real PNG signature and reads its dimensions; rejects scripts, SVG and mislabelled files; rejects a truncated PNG header (+1 more) |
| `tests/unit/integrations.test.ts` | Unit | 6 | 8.541259765625ms | emits nothing for unset or placeholder values; activates analytics only for a plausible beacon token; accepts the three forms of Search Console verification input (+3 more) |
| `tests/unit/local-mock-fallback.test.ts` | Unit | 3 | 4.259521484375ms | describes a bundled practice paper without D1; stores a marking scheme that parseMarkingScheme understands; returns null for a slug that is not a practice paper |
| `tests/unit/local-papers.test.ts` | Unit | 18 | 3741.285400390625ms | loads the generated index with unique slugs and usable summaries; filters by year and resolves paths; loads every paper and finds every referenced crop on disk (+15 more) |
| `tests/unit/local-subject-fallback.test.ts` | Unit | 3 | 6.5634765625ms | rebuilds the subject grid from the bundled practice library; classifies language and general subjects; returns cards sorted by name |
| `tests/unit/lockfile-and-scorecard.test.ts` | Unit | 8 | 1052.6396484375ms | matches tracked dependency versions between package-lock.json and facts.json; ensures old legacy version numbers are not cited in documentation; generates a valid scorecard with all 16 required areas (+5 more) |
| `tests/unit/mock-order.test.ts` | Unit | 6 | 7.561279296875ms | orders sections before questions and keeps within-section order stable; appends sections that are missing from the order list; preserves submission order when no section list is provided (+3 more) |
| `tests/unit/moderation.test.ts` | Unit | 2 | 3.407470703125ms | keeps new members in the moderation queue; auto-approves members with three approved comments |
| `tests/unit/oauth-config.test.ts` | Unit | 1 | 2.59765625ms | requires both a client id and secret |
| `tests/unit/paper-provenance.test.ts` | Unit | 6 | 18.54296875ms | schema includes source and rights columns on practice_papers; measures baseline counts for rights_status across all practice papers; adSlotAllowed strictly forbids ads on /practice/* routes (+3 more) |
| `tests/unit/password.test.ts` | Unit | 4 | 250.99365234375ms | stores the Workerd-compatible iteration count; verifies a matching password; rejects a wrong password (+1 more) |
| `tests/unit/practice-library.test.ts` | Unit | 5 | 38.75ms | builds a snapshot from the committed index file; keeps the paper counts that the listing pages show; serves the bundled index when the store fails (+2 more) |
| `tests/unit/production-guards.test.ts` | Unit | 4 | 5.485107421875ms | robots.txt disallows /dev and /dev/; bootstrapSuperAdmin returns null when an active super admin already exists; admin:create script refuses to add super admin in production if one already exists (+1 more) |
| `tests/unit/public-id.test.ts` | Unit | 6 | 465.55615234375ms | encodes the full 10-character base62 space; generates unique ids in the documented alphabet; parses the id from the end of a slug and rejects malformed values (+3 more) |
| `tests/unit/public-question.test.ts` | Unit | 7 | 7.378173828125ms | allows public-reveal questions only outside a published ranked mock; requires a submitted attempt for attempted-only questions; allows indexing only when every condition holds (+4 more) |
| `tests/unit/question-import.test.ts` | Unit | 12 | 15.625ms | handles quoted commas, escaped quotes and multiline fields; rejects an unclosed quoted field; detects and parses a JSON array (+9 more) |
| `tests/unit/ranking.test.ts` | Unit | 7 | 7.38720703125ms | orders by score, then time, then accuracy; uses accuracy rather than raw correct count as the final tie-breaker; treats two unanswered attempts as an exact tie (+4 more) |
| `tests/unit/rate-limit.test.ts` | Unit | 1 | 3.938232421875ms | enforces rate limits across separate request contexts sharing the KV namespace |
| `tests/unit/rich-text.test.ts` | Unit | 3 | 15.437255859375ms | escapes stored HTML instead of executing it; renders inline and display KaTeX; keeps line breaks and handles empty input |
| `tests/unit/scoring.test.ts` | Unit | 10 | 10.564453125ms | scores correct, wrong and skipped answers with negative marking; groups totals by subject and keeps per-question time; aggregates topic-level stats only for real topic rows (+7 more) |
| `tests/unit/seo-consistency.test.ts` | Unit | 8 | 10.793212890625ms | verifies /cuet-mock-test 301-redirects to /cuet-ug-mock-test; verifies /pyq 301-redirects to /cuet-ug-previous-year-papers; verifies /mock/[slug] noindexes practice-paper wrapper mocks and sets canonical to /practice/[slug] (+5 more) |
| `tests/unit/share-events.test.ts` | Unit | 4 | 6.433837890625ms | accepts a public-page copy event; accepts a live-attempt mock event and rejects question ids there; requires a public id outside the live attempt (+1 more) |
| `tests/unit/share-message.test.ts` | Unit | 6 | 5.434814453125ms | uses the exact English and Hindi prompts; encodes WhatsApp and Telegram links without attempt or user data; builds the exact live-attempt mock prompt (+3 more) |
| `tests/unit/share-policy.test.ts` | Unit | 3 | 5.724365234375ms | allows indexing only when every documented condition holds; explains each missing indexing condition; blocks public reveal while the question is in a live ranked mock |
| `tests/unit/structured-data.test.ts` | Unit | 5 | 113.443603515625ms | strictly disallows Quiz, Course, and FAQPage schemas across the entire codebase; verifies all structured data types in src/lib/seo.ts belong to the approved allow-list; verifies BaseLayout only emits approved Organization schema (+2 more) |
| `tests/unit/subject-stats.test.ts` | Unit | 2 | 4.4912109375ms | counts distinct questions and mocks without double counting; keeps a subject whose only mock points at it directly |

---

## 2. End-to-End Test Suite (Playwright)

- **Commit Hash:** `75ea44f`
- **Timestamp:** `2026-11-04T11:55:34.073Z`
- **Test Runner:** Playwright v1.64.1
- **Execution Target:** Production Build Server (`wrangler dev` on `dist/` at `http://127.0.0.1:4321`)
- **Total E2E Specs:** **9 files**
- **Total E2E Tests:** **70 passed**, **0 failed**, **3 skipped** (Total: 73)
- **Suite Duration:** **595.58s**

### Playwright Test Breakdown

| Spec File | Tests | Passed | Failed | Skipped | Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| `tests/e2e/admin-flow.spec.ts` | 11 | 9 | 0 | 2 | `PASSED` |
| `tests/e2e/api-contracts.spec.ts` | 11 | 11 | 0 | 0 | `PASSED` |
| `tests/e2e/attempt-flow.spec.ts` | 4 | 4 | 0 | 0 | `PASSED` |
| `tests/e2e/integrations.spec.ts` | 2 | 1 | 0 | 1 | `PASSED` |
| `tests/e2e/local-practice.spec.ts` | 9 | 9 | 0 | 0 | `PASSED` |
| `tests/e2e/question-share-public.spec.ts` | 17 | 17 | 0 | 0 | `PASSED` |
| `tests/e2e/security.spec.ts` | 10 | 10 | 0 | 0 | `PASSED` |
| `tests/e2e/slow-network.spec.ts` | 1 | 1 | 0 | 0 | `PASSED` |
| `tests/e2e/theme.spec.ts` | 8 | 8 | 0 | 0 | `PASSED` |

---

## 3. Autonomous Accessibility Audit (`axe-core` v4.14.0)

- **Commit Hash:** `75ea44f`
- **Timestamp:** `2026-11-04T06:38:07.337Z`
- **Axe Version:** axe-core v4.14.0
- **Standards Evaluated:** WCAG 2.0 A/AA, WCAG 2.1 A/AA, WCAG 2.2 A/AA
- **Viewports:** Desktop (1280x800), Mobile (375x667)
- **Themes Scanned:** Light and Dark (via `data-theme` attribute)
- **Total Scans Completed:** **232**
- **Passed Scans:** **232** (0 violations, 0 overflow)
- **Violations Detected:** **0**

### Accessibility Coverage Matrix

| Surface Area | Sample Paths | Viewports | Themes | Axe Violations | Overflow |
| :--- | :--- | :--- | :--- | :---: | :---: |
| **Public Pages** | `/`, `/cuet-ug-mock-test`, `/leaderboard`, `/practice` | 1280px, 375px | Light, Dark | 0 | 0px |
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

- **Commit Hash:** `75ea44f`
- **Timestamp:** `2026-11-04T11:55:34.073Z`
- **Audit Target:** Local SSR Server (`http://localhost:4321`)
- **Indexable Public URLs Found:** **89**
- **Total URLs in `sitemap.xml`:** **89**
- **Sitemap Parity Mismatches:** **0** (`SUCCESS`)

### Route Group Parity Summary

| Page Group | Path Prefix | Indexable URLs | In Sitemap? | Status |
| :--- | :--- | :---: | :---: | :--- |
| **Home & Hubs** | `/`, `/cuet-ug-mock-test`, `/practice`, `/cuet-ug-previous-year-papers` | 4 | 4 / 4 | `DONE` |
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

- **Commit Hash:** `75ea44f`
- **Timestamp:** `2026-11-04T11:55:34.073Z`
- **Purpose:** Enforce honesty in product claims, prevent unverified marketing superlatives, and guard NTA disclaimers.
- **Banned Superlatives Checked:** `national`, `official`, `verified`, `authentic`, `largest`, `100%`, `guarantee`, `NTA`.
- **Files Scanned:** **272 source files** across `src/pages`, `src/components`, `src/layouts`, `src/lib`.
- **Violations Detected:** **0** (`SUCCESS`).
