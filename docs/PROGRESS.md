# Progress — Astro build

Last updated: 2026-11-02. Question sharing Phases 1–6 are complete and live on
the production Worker `https://cuet-astro.cuet-platform.workers.dev`. The
production rollout published original ranked and standalone content, ran the
authenticated accessibility audit and fixed every issue it found, and cleaned
up the QA test data. The latest deployment also adds review-queue edit actions.
Current deployed version: `60f28021-ae55-4815-87cf-2adada96e631`.

## Phase status

| Phase | State | Evidence | Remaining |
| --- | --- | --- | --- |
| A — Audit | Complete | `docs/AUDIT.md` (schema, routes, security, SEO, content, env, gaps) | Refresh before launch |
| B — Schema and data safety | Complete | Migrations `0001`–`0007` applied local/remote; 27 blueprint tables; 0 missing columns; `uq_first_attempt`; immutability/sync triggers; blueprint-parsing schema test plus populated legacy→v2 migration test (scores, answers and version pin unchanged) | None |
| C - Security and test engine | Complete | No pre-submit keys, server deadline/scoring, signed-in and guest IDOR boundaries, idempotent autosave, CSRF, login/comment rate limits, exact role matrix, upload spoof and size rejection; security specs 6/6, full suite 104 unit/integration and 36 E2E tests | Physical-device pass |
| D — SEO | Partial | D1 sitemap, robots, noindex, runtime `SITE_URL` canonical origin, canonical overrides, JSON-LD, exam-info gating, Lighthouse mobile baseline | Verified-data eligibility/subject-combination/cutoff pages (calculators are post-launch per blueprint §15) |
| E - Content pipeline | Partial | Draft → review → publish, import preview/export, soft delete, audit log, frozen versions, unranked OCR library | Editorial review and D1 import of the OCR papers; ranked library still 1 mock / 2 questions |
| F — External integrations | Code complete; accounts pending | Env-gated Cloudflare Analytics, Search Console meta, AdSense loader/slot/`ads.txt`; Resend/Brevo reset email with production disable; Google button hidden when unconfigured; `CF_ACCESS_*` aliases; backup skip guard; `docs/EXTERNAL_SETUP.md` and `docs/LAUNCH-RUNBOOK.md`; 104 unit/integration and 36 E2E tests | Provider accounts/credentials, domain, Access app, R2, AdSense approval |
| G — Final QA | Partial | `astro check` 0 errors over 224 files; 104 unit/integration and 36 Playwright E2E tests; staging slow-network attempt at 390×844 with 400 ms latency, 400 kbps and 4× CPU; 240 staging axe scans clean; 30/30 staging smoke; D1 rows-read table and top 5 queries; migration `0007` bounds submit/detail reads; attempt submit is constant-query and autosave sends only changed answers | Real-phone / real-network pass; Lighthouse not re-run after the Phase G label/autosave change |
| H — Admin full control + design system | Complete (staging) | Migration `0009` applied local/remote; 192/192 unit tests; 46 Playwright passed + 1 skipped; 232 axe scans clean including authenticated admin pages; `astro check` 0 errors over 273 files; production sitemap 182/182 HTTP 200; `/dev/styleguide` 404 in production | Live Google sign-in check by the owner; content decisions for the 168 unscored questions |
| I — Question sharing, Phase 1 | Complete (staging foundation) | Migration `0012` applied local/remote; 10 local backfilled ids; remote backfill is a no-op because both remote ranked question rows are soft-deleted; 212/212 unit/integration tests; 49 Playwright passed + 1 skipped; `astro check` 0 errors over 288 files; build + deploy passed; `/api/admin/questions/1/share` returns 401 anonymously | None (Phase 2 delivered in J) |
| J — Question sharing, Phase 2 | Complete (staging) | Public `/q/{slug}-{public_id}` page, metadata/JSON APIs with server-side reveal; wrong slug 301, identical 404 for unknown/unpublished, latest-published lineage resolution, no answer key in HTML/JSON for ineligible viewers; 218/218 unit/integration; 53 Playwright passed + 1 skipped; `astro check` 0 errors over 295 files; migration `0013` applied local/remote; live unknown `/q` 404 and admin share 401 | Practice-library sharing decision; share sheet/image generation; sitemap and per-question OG images; owner Google sign-in check |
| K — Question sharing, Phase 3 | Complete (staging) | Accessible share sheet with focus trap/Esc and 44px targets; client-side 1080px PNG (1080–1920px tall) with English/Hindi, KaTeX, images, truncation and a always-visible link; answer toggle only when the viewer is eligible and off by default; native/WhatsApp/Telegram/copy/download; renderer lazy-loaded in a 12.8 KB chunk; 223/223 unit/integration; 60 Playwright passed + 1 skipped; `astro check` 0 errors over 300 files; live unknown `/q` 404 and 0 sitemap `/q/` entries | Practice-library sharing decision; context-aware share buttons and share-event analytics (Phase 4); sitemap and per-question OG images (Phase 5); owner Google sign-in check |
| L — Question sharing, Phase 4 | Complete (staging) | Context-aware share buttons on solutions; link-only live-attempt sheet behind `share_question_during_attempt`; `POST /api/share-events` with same-origin, rate-limit and id validation; attempts store no public id and no PII; solutions keeps one public id per lineage through revisions; 228/228 unit/integration; 64 Playwright passed + 1 skipped (4 new Phase 4 specs); `astro check` 0 errors over 307 files; build + deploy passed; live share-events 400/404/404/400 and 0 sitemap `/q/` entries | Practice-library sharing decision; sitemap inclusion and per-question OG images (Phase 5); owner Google sign-in check |
| M — Question sharing, Phase 5 | Complete (staging) | Sitemap includes only questions that pass the page’s `seoEligible` policy; `lastmod` from the published revision; isolated sitemap error handling; per-question 1200×630 OG PNGs generated offline by `scripts/generate-question-og.mjs` with satori + resvg; indexable pages get `index, follow`, canonical without `?ref`, BreadcrumbList JSON-LD and the per-question image; non-indexable pages keep `/logo.png`; 229/229 unit/integration; 65 Playwright passed + 1 skipped (new Phase 5 spec); `astro check` 0 errors over 309 files; deployed `cc805cc6-f782-4521-8e25-7a3780d71f8c`; live sitemap 200 with 0 `/q/` entries and unknown OG 404 | Practice-library sharing decision; owner Google sign-in check; run `npm run og:questions:remote` before deploying newly indexable questions |
| N — Question sharing, Phase 6 | Complete (staging) | Playwright axe scans of the public `/q/...` page and the open share sheet in light and dark themes (WCAG 2.0/2.1/2.2 A+AA) plus the existing focus-trap/Esc regression; D1 rows-read measured at **11** for a guest check and **17** total for a signed-in eligible check (13 share-logic rows); `docs/SHARE_FEATURE.md` documents public URLs, lineage, reveal policy, flags, surfaces, image/sheet, share events/privacy, sitemap/OG workflow, data model, performance and operations; 229/229 unit/integration; 66 Playwright passed + 1 skipped (67 total), with the slow-network spec then passing separately against a temporary local published mock; `astro check` 0 errors over 309 files; build passed and deployed `f27e918d-f918-48e6-91da-beea7cff296c`; live health 200, unknown `/q` and OG 404, sitemap 200 with 0 `/q/` entries | Superseded by Phase O |
| O — Production rollout and final verification | Complete | Original ranked mini mock (5 questions, `attempted_only`) and standalone indexable question published; live `/q` pages, sitemap entry, per-question OG image, signed-in answer unlock, guest lock, unknown-id 404 and Google OAuth initiation verified; production smoke 38/38; authenticated axe 256 scans, 10 issues found and fixed, re-run clean; practice no-share regression added; 229/229 unit/integration; `astro check` 0 errors over 309 files; deployed `fd9a99be-a016-4c3d-be1c-1c0079cc872b`; owner Google sign-in completed and owner-authenticated admin/API checks passed; test attempts/answers and share events cleaned up, QA user/admin deactivated | Practice rights/mapping decision |
| P — Review-queue edit actions | Complete | Paper detail resolves the D1 paper id and links to the Data manager for the paper, all questions and all passages; each pending/unexplained row links to its exact question; the page documents `correct_option`, `explanation` and `publication_status`; admin-flow proves the links plus a real edit/save/restore; 229/229 unit/integration; admin-flow 11/11; `astro check` 0 errors over 309 files; deployed `60f28021-ae55-4815-87cf-2adada96e631`; production smoke 22/22 public checks; production Playwright check confirmed the three edit actions, 14 per-question links, both edit forms and successful saves with a temporary super admin | Editors without `data.manage` still need a super admin for corrections |

## Phase P — review-queue edit actions (2026-11-02)

### What changed

- `/admin/review?paper=...` now resolves the selected paper's `practice_papers.id`
  and its `practice_questions.id` rows. The paper header adds **Edit paper**,
  **Edit questions** and **Edit passages**, all opening the existing Data
  manager with the correct row or filter.
- Every pending-question card and every keyed-without-explanation chip now links
  to that exact question. A **Review** row in the queue also has a direct
  **Edit** action for the paper.
- The detail page explains the correction rules: set `correct_option` to a
  printed option id to make a row scorable, add only printed reasoning to
  `explanation`, and set `publication_status` to `published` when the paper is
  ready. Saves are validated and audit-logged; review counts refresh within
  about 30 seconds.
- The edit surface stays restricted to super admins because it uses the Data
  manager (`data.manage`). Editors keep the read-only review view and see a note
  asking a super admin to make the correction.

### Evidence

- `npm test`: **229/229 passed** across 26 files.
- `npx playwright test tests/e2e/admin-flow.spec.ts`: **11/11 passed**. The new
  spec proves the Edit paper/Edit questions links resolve, the exact question
  form loads, a pending question can be keyed and explained, the row leaves the
  pending list, and the original values restore cleanly afterwards.
- `astro check`: **0 errors, 0 warnings, 0 hints over 309 files**; production
  build succeeded.
- Deployed `60f28021-ae55-4815-87cf-2adada96e631` to
  `https://cuet-astro.cuet-platform.workers.dev`.
- Production smoke: **22/22 public checks passed**.
- Production Playwright verification with a temporary super admin: the paper
  detail rendered **Edit paper**, **Edit questions** and **Edit passages** plus
  **14 per-question edit links**. The paper form exposed 14 fields including
  `slug`, `title` and `publication_status=published`; the question form exposed
  `correct_option` and `explanation`. Saving both forms returned
  **“Saved. The change is in the audit log.”**, and the filtered question list
  (142 rows) and passage list both returned 200. The temporary admin was then
  deactivated, its user row soft-deleted, its sessions removed and its two test
  audit entries deleted.

### Remaining

- An editor who needs to make these corrections must either use a super-admin
  account or receive a deliberate, narrower practice-content permission later.

## Phase O — production rollout and final verification (2026-11-02)

### What changed

- Production content was written as original, platform-authored material so
  `rights_ok=1` has a defensible basis without third-party clearance:
  - a five-question English grammar mini mock (10 minutes, 25 marks) was
    published with `attempted_only` reveal. Its five ranked questions have
    public ids, render `noindex, follow`, and expose the key only to a signed-in
    user with a submitted attempt containing the question;
  - a standalone passive-voice question was published with
    `reveal_policy='public'`, `seo_indexable=1` and an original explanation. It
    is the only `/q/` entry in `sitemap.xml`, renders `index, follow` with a
    canonical URL, and has a generated 1200×630 OG image at
    `/og/questions/R1hmOFWkeA.png`.
- `scripts/a11y-audit.mjs` now resolves the live admin question/mock ids from
  the admin APIs instead of scanning hard-coded `/1` rows, audits the sitemap's
  shared-question page, supports `A11Y_SKIP_ATTEMPT=1` so a production run does
  not write attempt rows, and accepts `A11Y_STORAGE_STATE` so an interactive
  Google-only owner login can be reused without storing a password.
- `scripts/staging-smoke.mjs` now checks Google OAuth initiation, the live
  shared question page/API/OG image, a share event, and the ranked page's
  noindex/lock behaviour. Answer-key detection inspects JSON field names rather
  than prose, so instructions may legitimately mention explanations.
- `tests/e2e/local-practice.spec.ts` adds a no-share regression for the paper
  page and the take view.
- Accessibility fixes found by the authenticated production audit: `min-w-0` on
  dashboard and admin card grids, `min-w-0` on the attempt filter controls,
  `min-width:0; max-width:100%; box-sizing:border-box` on the question, mock and
  share form fields, darker text on the share count badges, darker loading
  text in the share preview, and keyboard access for the admin
  recent-attempts scroller.

### Evidence

- `npm test`: **229/229 passed** across 26 files.
- `npx playwright test`: **67 passed, 1 opted-in slow-network test skipped**
  (68 total), including the new practice no-share regression.
- `astro check`: **0 errors, 0 warnings, 0 hints over 309 files**; production
  build succeeded.
- Production smoke: **38/38** checks on the final deployment, including live
  OAuth initiation, shared-page canonical/robots, the public question API
  contract, the OG image, a share event, the ranked guest `403`, and the admin
  contracts.
- Owner sign-in: the owner completed Google consent in a visible Chrome window
  on 2026-11-02. The session reached `/dashboard` (200, performance insights
  present), `/admin` (200, New users and Pending reports present), and every
  admin API checked (`mocks`, `questions`, `users`, `reports`, `discussions`,
  `audit-log`, JSON export) returned 200. The standalone question's share API
  returned 200 with public id `R1hmOFWkeA`, and `/admin/questions/9` rendered.
  The temporary session was then reused for the production axe audit via the new
  `A11Y_STORAGE_STATE` option: **256 scans, 0 WCAG A/AA violations, 0 horizontal
  overflow**. The state file and throwaway Chrome profile were deleted
  afterwards.
- Authenticated production axe: **256 scans** (public, public question, local
  practice, mock, and every authenticated admin/dashboard page; light and dark;
  desktop and 390×844). The first run found 10 real issues: horizontal overflow
  on `/dashboard`, `/admin`, `/admin/questions/9` and `/admin/attempts`, plus a
  contrast failure in `/admin/questions/9`. A second run surfaced four remaining
  issues: a keyboard-inaccessible recent-attempts scroller on `/admin` and the
  share panel's wide reveal select on the question editor. The local
  share-sheet axe spec also caught a preview-text contrast failure. All were
  fixed; the final production run was **256 scans, 0 WCAG A/AA violations, 0
  horizontal overflow**. The same audit was then repeated through the owner's
  Google session with `A11Y_STORAGE_STATE` and was also clean. Navigation
  failures now retry up to three times so a transient network drop cannot abort
  the whole audit.
- Live unlock: the ranked question reported `canCheck:false` before an attempt,
  `canCheck:true` after submitting an attempt for the mock, and the check
  endpoint returned the correct option and explanation. A guest check returned
  `403` with the attempt CTA. Ranked page HTML contains no correct-option field
  or explanation.
- Live SEO/404: the standalone page is `index, follow`, canonical and in the
  sitemap; its OG image is `image/png`; an unknown public id returns the same
  404 as an unpublished question; `/api/auth/google` returns a `303` to
  `accounts.google.com`; `/login` shows “Continue with Google”.
- Cleanup: mock-2 test attempts/answers and smoke share events were deleted; the
  QA user's sessions were removed, its password cleared and the user
  soft-deleted; the QA admin was deactivated so it cannot log in; the temporary
  credentials file was deleted. The launch-content audit rows are retained so
  the audit trail stays valid; they reference the now-inactive QA admin id.
- Practice-library decision: sharing stays off. The 5,322 practice questions
  have no public ids or lineage and every paper is PYQ-sourced, so a rights and
  mapping decision is still required. The new regression test proves the paper
  and take views expose no share control or `/q/` link.

### Open issues and risks

- Practice-library sharing remains deferred until the rights and mapping
  decisions are made.
- The OG generator remains an explicit deploy step and does not prune images
  for questions that later become ineligible.

### Next step

Decide the practice-library rights basis and public-id mapping if practice
sharing is desired later.

## Phase N — question sharing, Phase 6 (2026-11-02)

### What changed

- `tests/e2e/question-share-public.spec.ts` now loads `axe-core` into the page and
  runs WCAG 2.0/2.1/2.2 A and AA rules against the server-rendered public
  question page and the open share sheet, once in light theme and once in dark
  theme. It sets `data-theme` on the document, waits for the 150 ms colour
  transition to settle, and fails with the axe rule id, impact, help text and
  node targets when a violation is found. The existing share-sheet test still
  covers focus trapping, Escape to close and focus return to the trigger.
- D1 rows read were measured with temporary `console.log` instrumentation in
  `src/lib/db.ts`, then the file was restored byte-for-byte. The fixture was a
  single-revision question with no Hindi text and no image. Measurements:
  - guest `POST /api/public-questions/{id}/check` → **11 rows**: mapping 1,
    lineage 5, published-mock membership 5.
  - signed-in eligible check → **17 rows total**: 4 for the normal session/admin
    lookups plus 13 share-logic rows (mapping 1, lineage 5, membership 5,
    submitted-attempt `EXISTS` 2). The 4 auth rows occur for any signed-in
    request and are not share-specific.
- `docs/SHARE_FEATURE.md` is the new reference for the feature: public URL and
  public-id rules, lineage/revision behaviour, reveal policy, share flags and
  SEO eligibility, the public page/solutions/live-attempt surfaces, the
  deferred practice surface, the share sheet and PNG image, share events and
  privacy, the sitemap/OG workflow, data model, measured performance,
  verification and an operations checklist.
- No runtime code changed in this phase. The Phase 6 commit was still deployed
  as version `f27e918d-f918-48e6-91da-beea7cff296c` so production matches the
  tested tree; live checks passed.

### Evidence

- `npm test`: **229/229 passed** across 26 files.
- `npx playwright test`: **66 passed, 1 opted-in slow-network test skipped**
  (67 total) in 6.3 minutes. The new axe spec passed in 6.6 s. The slow-network
  spec was then run on its own against a temporary local published mock and
  passed in 1.5 minutes (throttled 390×844, 400 ms latency, 400 kbps, 4× CPU);
  the temporary mock and its attempt rows were removed afterwards.
- `astro check`: **0 errors, 0 warnings, 0 hints over 309 files**; production
  build succeeded.
- Accessibility audit: **100 axe scans locally and 100 against the deployed
  Worker**, both light and dark at desktop/mobile widths, with no WCAG A/AA
  violations and no horizontal overflow. Authenticated pages were skipped
  because owner credentials are not available.
- Dependency audit: `npm audit --omit=dev` reports **0 vulnerabilities**. The
  full audit reports two moderate dev-only findings in `satori → fflate`
  (malformed ZIP64 parsing); the generator only reads trusted local fonts and
  D1 text, and npm's only suggested fix is a breaking satori downgrade.
- Deployed as version `f27e918d-f918-48e6-91da-beea7cff296c`. Live:
  `/api/health` 200, `/q/test-AAAAAAAAAA` 404,
  `/api/public-questions/AAAAAAAAAA` 404,
  `/og/questions/AAAAAAAAAA.png` 404, `/sitemap.xml` 200 with **0 `/q/`
  entries**, `/robots.txt` 200, `/privacy-policy` 200 with the share-data
  disclosure, `POST /api/share-events` 400 for a missing identifier and 404 for
  an unknown public id.
- The rows-read instrumentation was removed; `src/lib/db.ts` has no remaining
  diff and the local metric fixture user/attempt/session rows were deleted.
- Lighthouse was not re-run because no runtime asset, markup or query changed
  in this phase. Phase G’s staging measurements and the Phase 5 live checks
  remain the performance and deployment evidence.

### Open issues and risks

- **Resolved in Phase O.** At the Phase 6 close no production ranked question
  was live (both remote ranked rows were soft-deleted), so the live `/q/...`
  page, live answer check and live per-question OG image could not be exercised
  against real content. Phase O published an original ranked mini mock plus a
  standalone indexable question and verified all of them live.
- The rows-read figures come from a local single-revision fixture. The query
  shapes and indexes are the same in production, but absolute row counts will
  grow with deeper lineages, Hindi data, images and additional mock membership.
- The axe spec covers the public question page and the share sheet, including
  both themes. It cannot audit the exported PNG (canvas output) or the native
  OS share sheet; `npm run test:a11y` continues to cover the rest of the public
  site.
- **Decision recorded in Phase O.** Practice-library sharing remains off: the
  5,322 `practice_questions` have no public ids or lineage, and all practice
  papers are PYQ-sourced, so sharing requires a rights and mapping decision
  first. The share-event schema already accepts `context='practice'`, and a
  no-share regression now guards the practice views.
- **Covered by a temporary QA admin in Phase O.** Automated authenticated
  coverage used a temporary password-based super admin; the owner still needs
  to complete Google sign-in as `rajpal010304@gmail.com` once to confirm the
  interactive OAuth flow. OAuth initiation is verified live.

### Next step

Phase O: publish original production content, verify the live share surfaces and
OAuth initiation, complete the authenticated accessibility audit, and record the
practice-library decision and test-data cleanup.

## Phase M — question sharing, Phase 5 (2026-11-02)

### What changed

- `src/lib/share/public-question-store.ts` now carries `updated_at`/`created_at`
  through the lineage query, returns `lastmod` from the published revision and
  adds `listSeoIndexableQuestions()`. The helper pre-filters mapping flags
  (`share_enabled`, `seo_indexable`, `reveal_policy='public'`, `rights_ok`) and
  then resolves every candidate through `resolvePublicQuestion(publicId, null)`,
  keeping only `view.seoEligible`. The sitemap and the page therefore use one
  policy implementation and cannot disagree about a published mock, a deleted
  lineage, revoked rights or a missing explanation.
- `src/pages/sitemap.xml.ts` adds the eligible `/q/{slug}-{public_id}` entries
  with `lastmod` from the published revision, `changefreq="monthly"` and
  `priority="0.5"`. The sharing lookup has its own `try`/`catch`, so a failure
  cannot drop the mock, subject, PYQ, practice or blog sections.
- `src/lib/share/public-question.ts` adds `questionOgImagePath(publicId)` and
  `src/pages/q/[slug].astro` passes that image to `BaseLayout` only when
  `view.seoEligible`. Non-indexable pages keep the generic `/logo.png` preview.
- `scripts/generate-question-og.mjs` and `scripts/lib/question-og.mjs` render
  per-question OG images offline with satori and `@resvg/resvg-js`: 1200×630,
  always light, brand header, subject/PYQ line, plain-text question (markdown
  and LaTeX stripped), footer with `cuetfreemocktest.com/q/{public_id}` and
  “Free CUET mock tests”, and no answer, explanation, user or attempt data. The
  script follows the same lineage and published-mock rules as the page, supports
  `--local`, `--remote`, `--id=…` and `--sample`, and writes
  `public/og/questions/{publicId}.png`. `npm run og:questions:remote` is the
  deploy-time step for new indexable questions.
- Tests: `tests/unit/public-question.test.ts` covers the OG path helper; the new
  Playwright spec creates one eligible fixture plus three excluded ones
  (`seo_indexable=0`, `attempted_only`, in a published mock), checks the sitemap
  contains only the eligible path, runs the offline generator for that public
  id, verifies a 1200×630 PNG is written and served as `image/png`, and checks
  `index, follow`, the canonical without `?ref=share`, `BreadcrumbList` JSON-LD,
  the per-question `og:image` and the `/logo.png` fallback on a non-indexable
  page.

### Evidence

- `npm test`: **229/229 passed** across 26 files.
- `npx playwright test`: **65 passed, 1 opted-in slow-network test skipped**
  (66 total). The new Phase 5 spec passed on its own and in the full suite.
- `astro check`: **0 errors, 0 warnings, 0 hints over 309 files**; production
  build succeeded.
- The offline renderer produced a 1200×630, 41 KB light sample PNG
  (`.wrangler/question-og-sample.png`) with the link visible and no answer. A
  local `npm run og:questions:local` run read 14 lineage rows and generated no
  images because no local question currently passes every eligibility flag;
  the remote run read 0 lineage rows.
- Deployed as version `cc805cc6-f782-4521-8e25-7a3780d71f8c`. Live:
  `/api/health` 200, `/q/test-AAAAAAAAAA` 404,
  `/api/public-questions/AAAAAAAAAA` 404,
  `/og/questions/AAAAAAAAAA.png` 404, `/sitemap.xml` 200 with **0 `/q/`
  entries** (no remote question is eligible), `/robots.txt` 200,
  `/privacy-policy` 200 with the share-data disclosure, and
  `POST /api/share-events` 400 for a missing identifier and 404 for an unknown
  public id.

### Open issues and risks

- **No indexable production question yet.** Both remote ranked rows remain
  soft-deleted, so live `/q/...` and live per-question OG images cannot be
  exercised until a question is published with all flags set.
- The generator is an explicit deploy step: run
  `npm run og:questions:remote` after changing share flags and before
  `npm run deploy`. It does not prune images for questions that later become
  ineligible; those files are simply unreferenced.
- `listSeoIndexableQuestions()` resolves each candidate with a few indexed
  queries. The candidate set is bounded by the admin flags, so this is cheap at
  the expected scale, but it is intentionally not a whole-catalogue scan.
- **Practice-library sharing remains deferred** for the same rights and public-id
  reasons as Phase 4. The `practice` share-event context still has no UI.
- The admin UI still needs the owner to complete Google sign-in as
  `rajpal010304@gmail.com`; the agent cannot complete OAuth.

### Next step

Phase 6: accessibility and performance evidence for the sharing surfaces, plus
`docs/SHARE_FEATURE.md` covering the public URL, flags, reveal policy, share
events, sitemap/OG workflow and the deferred practice-library decision.

## Phase L — question sharing, Phase 4 (2026-11-02)

### What changed

- `src/lib/share/events.ts` validates the exact share-event shape
  (`context` ∈ `attempt`, `solutions`, `practice`, `public_page`; `channel` ∈
  `native`, `whatsapp`, `telegram`, `copy`, `download`). A live-attempt event
  must carry a mock id and is rejected if it carries a public question id, so
  the ranked attempt surface cannot accidentally record question sharing.
- `src/pages/api/share-events.ts` stores aggregate counters only: public id or
  mock id, the optional signed-in user id, context, channel and timestamp. It
  is same-origin protected, rate-limited per user/IP (60/minute), validates
  that the public id or mock exists, and never stores an IP, attempt id, email,
  score or answer.
- `src/lib/share/record-share-event.ts` is the fire-and-forget client helper.
  `src/lib/share/share-sheet.ts` calls it after a successful native,
  WhatsApp, Telegram, copy or download action; the public page’s plain
  “Copy link” fallback records `public_page`/`copy`.
- `src/components/ShareSheet.astro` now takes `context` and `mockId` props in
  addition to the question view, answer payload and canonical URL. The
  solutions page renders one sheet per shareable question after submission,
  with the canonical `/q/{slug}-{public_id}` link, the answer toggle off by
  default and `context="solutions"`.
- `src/lib/share/public-question-store.ts` adds
  `shareMappingsForQuestionIds`: one recursive query follows `supersedes_id`
  forward so a frozen mock version can still resolve its lineage’s current
  public id. Disabled mappings are omitted, so no share button appears for a
  question whose sharing is off.
- `src/components/MockShareSheet.astro` and
  `src/lib/share/mock-share.ts` implement the live-attempt dialog. It shares
  only the mock instructions URL (`/mock/{slug}/instructions`), never question
  text, options, images or answers. `src/pages/attempt/[id].astro` mounts it
  only when `site_settings.share_question_during_attempt` is `true` (default
  `false`). Opening the dialog overlays the page without pausing the timer or
  autosave.
- `src/pages/privacy-policy.astro` documents the share-event fields explicitly:
  public question id or mock id, surface, channel and optional signed-in user
  id, with no IP address, attempt id, score or recipient stored.
- Tests: `tests/unit/share-events.test.ts` covers accepted shapes, the
  live-attempt no-question rule and malformed ids; `tests/unit/share-message.test.ts`
  adds the mock prompt; four Playwright specs cover the solutions share
  (answer off, canonical URL, `solutions`/`copy` event), the live-attempt
  link-only dialog (no question text, timer still ticking, autosave still
  writing, `attempt` event with `public_id=NULL`, setting off hides it),
  endpoint validation and the public-page copy fallback.

### Evidence

- `npm test`: **228/228 passed** across 26 files.
- `npx playwright test`: **64 passed, 1 opted-in slow-network test skipped**
  (65 total). The four Phase 4 specs passed together.
- `astro check`: **0 errors, 0 warnings, 0 hints over 307 files**; production
  build and deploy succeeded.
- Live: `/api/health` 200, `/q/test-AAAAAAAAAA` 404,
  `/api/public-questions/AAAAAAAAAA` 404,
  `/api/admin/questions/1/share` 401 without a session, `/practice` 200,
  `/robots.txt` 200, `/sitemap.xml` 200 with **0 `/q/` entries**.
  `POST /api/share-events` returned 400 for a missing identifier, 404 for an
  unknown public id, 404 for an unknown mock id and 400 for an attempt event
  carrying a public id. Deployment version
  `abf09af8-d58f-414c-84b4-8e24f0ac9474`.

### Open issues and risks

- **Practice-library sharing remains deferred.** The 5,322
  `practice_questions` have no public ids or lineage, and all practice papers
  are PYQ-sourced, so sharing stays off until a rights and mapping decision is
  made. The `practice` context is accepted by the analytics schema and
  validator but no UI emits it yet.
- **No live ranked question in production.** Both remote ranked rows are
  soft-deleted, so the solutions and live-attempt surfaces are covered by
  local E2E fixtures only. Remote `/q/...` still returns 404 until a ranked
  question is published.
- The solutions page emits one hidden share card per shareable question. This
  is correct but adds HTML weight on 50-question papers; the renderer itself
  is still lazy-loaded and image generation runs only on open.
- The admin UI still needs the owner to complete Google sign-in as
  `rajpal010304@gmail.com`; the agent cannot complete OAuth.
- Phase 5 still owns sitemap inclusion for the indexable set, per-question OG
  images and the final SEO policy checks.

### Next step

Phase 5: include only the fully eligible shared questions in `sitemap.xml`,
add per-question Open Graph images/canonicals for the indexable set, and
verify the noindex default on everything else.

## Phase K — question sharing, Phase 3 (2026-11-02)

### What changed

- `src/components/ShareSheet.astro` adds the accessible share sheet and the
  hidden share card. The dialog has `role="dialog"`, `aria-modal`, a labelled
  title, 44px controls, a close button, focus trap, Escape handling and focus
  restoration. The answer row is rendered only for eligible viewers and the
  answer checkbox is off by default. The public page keeps its plain “Copy
  link” control as a no-JavaScript fallback.
- `src/lib/share/share-card.ts` renders the card off-screen at 1080px wide,
  shrinks long questions from 40px to 34px to 28px, clamps the card to
  1080–1920px, and clips overflow with a “Read the full question at the link.”
  notice. The footer sits outside the clipped main area, so the public URL is
  always visible. It waits for fonts and images, hides broken images, exports
  at 2x only when the bitmap stays under 8 MP and the device is not
  memory-constrained, and re-renders once on iOS Safari to avoid a blank first
  frame. `html-to-image` is dynamically imported on first open (separate
  12.8 KB client chunk).
- `src/lib/share/share-sheet.ts` is the dialog controller. It caches the
  generated blob per language/answer combination, updates WhatsApp and
  Telegram links on language change, shares a PNG file through
  `navigator.share` when `navigator.canShare({ files })` allows it and falls
  back to text-only sharing, copies the canonical URL with a legacy
  `execCommand` fallback, downloads the PNG as
  `cuet-question-{publicId}.png`, and shows a link-only error state when image
  generation fails.
- `src/lib/share/share-message.ts` holds the exact English/Hindi prompts,
  encoded fallback URLs, filename, height clamp and pixel-ratio policy so they
  are unit-testable without a browser.
- `src/pages/q/[slug].astro` mounts the share sheet, passes the absolute
  canonical URL, and server-renders answer/explanation data into the hidden
  card only when `view.canCheck` is true. Guests and other ineligible viewers
  receive no explanation or correct option in the page HTML.
- `src/styles/tokens.css` adds a light-only share-card palette outside the
  theme blocks, so the exported PNG stays light in dark mode and the existing
  theme-parity test still covers only theme tokens.
- `package.json` / `package-lock.json` add `html-to-image@^1.11.13`.
- Tests: `tests/unit/share-message.test.ts` covers prompts, encoded URLs,
  filenames, height clamping and pixel ratio; eight new Playwright specs cover
  PNG generation and answer withholding/toggling, guest restriction, Hindi +
  KaTeX + image + light palette, long-question truncation, native/WhatsApp/
  Telegram/copy behaviour, focus trap/Escape, and image-failure fallback.

### Evidence

- `npm test`: **223/223 passed** across 25 files.
- `npx playwright test`: **60 passed, 1 opted-in slow-network test skipped**.
- `astro check`: **0 errors, 0 warnings, 0 hints over 300 files**; production
  build and deploy succeeded.
- The generated preview is a real PNG at 1080px wide (or 2160px at 2x) and
  1080–1920px tall (2160–3840px at 2x); E2E samples pixels to prove the image
  is not blank and checks the downloaded filename and dimensions. Guest HTML
  is asserted free of the explanation and “Correct answer:”.
- Live: `/api/health` 200, `/q/test-AAAAAAAAAA` 404 with
  `Question not found`, `/api/public-questions/AAAAAAAAAA` 404,
  `/api/admin/questions/1/share` 401 without a session, `/practice` 200,
  `/robots.txt` 200, `/sitemap.xml` 200 with **0 `/q/` entries**.
  Deployment version `bfc11db4-c8e7-4842-8c6d-cee3f640f25c`.

### Open issues and risks

- **Ranked-only scope.** Phase 3 shares ranked lineages only. Remote
  production still has no published ranked question, so the sheet cannot be
  exercised on real production content. The 5,322 practice questions remain
  unaddressable until a separate mapping/lineage and rights decision is made.
- Native file sharing depends on browser support; the sheet detects
  `navigator.canShare` and falls back to text-only share, WhatsApp, Telegram or
  copy. Download always works when PNG generation succeeds.
- The share-image E2E tests write fixtures to local D1 and intentionally skip
  against `PLAYWRIGHT_BASE_URL`, so production coverage remains the 404/health
  checks until a live ranked question is published.
- The admin UI still needs the owner to complete Google sign-in as
  `rajpal010304@gmail.com`; the agent cannot complete OAuth.
- Phase 4 must add context-aware share buttons in solutions/practice/live
  attempts, share-event analytics and the `share_question_during_attempt`
  setting. Phase 5 still owns sitemap inclusion and per-question OG images.

### Next step

Phase 4: add share entry points in solutions, practice and the live attempt
flow, record share events by context/channel (no PII), and wire the
`share_question_during_attempt` setting. Keep the ranked-only scope unless the
practice-library decision changes.

## Phase J — question sharing, Phase 2 (2026-11-02)

### What changed

- `src/pages/q/[slug].astro` serves the server-rendered public question page.
  The public id is parsed from the end of the segment; a wrong slug returns a
  `301` to the canonical `/q/{slug}-{public_id}` path. Unknown ids, disabled
  sharing, deleted lineages, draft-only lineages and PYQ lineages without
  rights all return the same plain `404 Question not found` response.
- `src/lib/share/public-question-store.ts` resolves the mapping through the
  current lineage head, selects the newest published revision, checks published
  ranked-mock membership across the lineage, blocks revoked PYQ rights, and
  evaluates reveal eligibility. `attempted_only` requires a signed-in user with
  a `submitted` attempt containing a revision of the lineage; guests and
  `in_progress` attempts never qualify. `public` reveal is limited to questions
  that are not in a published ranked mock.
- `src/lib/share/public-question.ts` holds the pure reveal, SEO, option and
  title/description helpers. `isSeoEligible` requires every documented
  condition: published revision, admin `seo_indexable=1`,
  `reveal_policy='public'`, `rights_ok=1`, an original explanation, and absence
  from every currently published ranked mock.
- `GET /api/public-questions/{publicId}` returns only the public view:
  question text, options, image refs, subject/topic, related mocks and CTA.
  It never returns `questions.id`, `correct_option` or an explanation.
  `POST /api/public-questions/{publicId}/check` is same-origin and rate-limited
  to 30 checks per minute per user/IP; it returns `403` plus a CTA for
  ineligible viewers, and only an eligible response contains the correct option
  and rendered explanation.
- `BaseLayout.astro` now accepts a full `robots` value and a social image URL.
  Shared pages emit `noindex, follow` by default and `index, follow` only when
  every SEO condition passes; canonical and OG URLs omit `?ref=share`.
- `migrations/0013_question_share_indexes.sql` adds
  `idx_mq_question` so the public page and admin share panel can find ranked
  mock membership by question id without scanning every mock.
- Tests: unit coverage for the pure reveal/SEO/view helpers, and four new
  Playwright specs covering URL/redirect/404/leak checks, guest and
  in-progress versus submitted-attempt reveals, public reveal plus SEO flag
  changes and published-mock overrides, and revision lineage resolution.

### Evidence

- `npm test`: **218/218 passed** across 24 files.
- `npx playwright test`: **53 passed, 1 opted-in slow-network test skipped**.
- `astro check`: **0 errors, 0 warnings, 0 hints over 295 files**; production
  build and deploy succeeded.
- Remote D1: migration `0013` applied. Query plans confirm
  `SEARCH mq USING INDEX idx_mq_question (question_id=?)` for membership, and
  `idx_attempts_user_finished` plus the `attempt_answers` primary key for the
  submitted-attempt lookup. An anonymous public page uses three indexed D1
  reads (mapping, lineage, mock memberships); an attempted-only check adds one
  eligibility read. The check rate limiter uses KV, not D1.
- Live: `/api/health` 200, `/q/test-AAAAAAAAAA` 404 with
  `Question not found`, `/api/public-questions/AAAAAAAAAA` 404,
  `/api/admin/questions/1/share` 401 without a session, `/practice` 200,
  `/robots.txt` 200, `/sitemap.xml` 200 with **0 `/q/` entries**.
  Deployment version `f07c0198-b835-467f-8571-11593334591c`.
- E2E proves a revision keeps the same public id and the old slug redirects
  when the latest published revision text changes; it also proves the answer
  key is absent from the initial HTML and the public JSON for non-eligible
  viewers.

### Open issues and risks

- **Ranked-only scope.** The prompt's data model is built on
  `questions(id)`/`supersedes_id`, so Phase 2 serves ranked questions only.
  Remote production has two ranked question rows and both are soft-deleted;
  there is currently no production content that can open at `/q/...`. The
  5,322 real practice questions remain in `practice_questions` and are not
  addressable. Extending sharing to the practice library needs a separate
  mapping/lineage design and a rights decision; Phases 3–5 continue on ranked
  lineages unless that scope is changed explicitly.
- Every practice paper is PYQ-sourced, so any future practice sharing still
  defaults to `share_enabled=0` until `rights_ok=1`.
- The share sheet, browser image generation, solution/practice/attempt share
  buttons and share-event analytics are Phase 3–4 work. Sitemap inclusion and
  per-question OG images for the indexable set are Phase 5 work.
- The admin UI still needs the owner to complete Google sign-in as
  `rajpal010304@gmail.com`; the agent cannot complete OAuth.
- The new public-page E2E tests intentionally skip against
  `PLAYWRIGHT_BASE_URL` because they create fixtures in local D1. Production
  coverage is limited to the 404/health checks above until a live ranked
  question is published.

### Next step

Phase 3: add the accessible share sheet and client-side PNG generation
(English/Hindi/KaTeX/image questions, link always visible, no answer unless
toggled and eligible). Keep the copy-link fallback and load the renderer only
on first tap.

## Phase I — question sharing, Phase 1 (2026-11-02)

### What changed

- `migrations/0012_question_share.sql` adds `question_public_ids` (one opaque
  public id per lineage, sharing flags, `created_at`), `share_events` (context
  and channel counters, no IP or PII), the unique current-question index, and
  `trg_question_public_id_move`. The trigger moves the pointer atomically when a
  revision row with `supersedes_id` is inserted.
- `src/lib/share/public-id.ts` generates ten-character base62 ids from 60
  crypto-random bits with rejection sampling, validates/parses ids from the end
  of a slug, transliterates Hindi for readable slugs, and builds canonical
  `/q/{slug}-{public_id}` paths. `questions.id` is never used in a public path.
- `src/lib/share/backfill.ts` plans one id per non-deleted lineage head and
  pointer repairs; `scripts/backfill-question-public-ids.mjs` runs it against
  local or remote D1 with `--dry-run` and verifies the result.
- `src/lib/admin/share.ts` and `src/pages/api/admin/questions/[id]/share.ts`
  expose lineage-aware read/update with `questions.publish`, same-origin and
  audit checks. Validation blocks enabling PYQ sharing without rights, public
  reveal for questions in published ranked mocks, and indexing unless the
  question is published, rights-confirmed, publicly revealable, explained, and
  absent from every published ranked mock. Removing a dependency clears the
  dependent flags instead of leaving an invalid combination.
- Single and bulk question inserts create the mapping in the same D1 batch.
  The admin question editor now has a Sharing panel (copy/open link, flags,
  blockers, share counts) and the question list has bulk sharing actions.
  `site_settings.share_question_during_attempt` defaults to `false`.
- Originals default to `share_enabled=1`; questions with a PYQ year or a PYQ
  mock membership default to `0` until `rights_ok=1`. All reveal policies
  default to `attempted_only` and every SEO flag defaults to `0`.

### Evidence

- `npm test`: **212/212 passed** across 23 files.
- `npx playwright test`: **49 passed, 1 opted-in slow-network test skipped**.
  New coverage: copy/toggle sharing, stable public id across a revision,
  indexing rejection without rights, and PYQ rights gating.
- `astro check`: **0 errors, 0 warnings, 0 hints over 288 files**; production
  build and deploy succeeded.
- Remote D1: migration `0012` applied; `question_public_ids`, `share_events`,
  `uq_qpid_current`, `idx_share_events_pid` and the pointer trigger exist.
  Remote backfill read 2 question rows and 0 mappings, reported **0 created and
  0 moved** because both rows are soft-deleted, then verified cleanly.
- Live: `/api/health` 200, `/api/admin/questions/1/share` 401 without a session,
  `/q/test-AAAAAAAAAA` 404 (Phase 2 route not built), `/practice` 200 and
  `/sitemap.xml` 200.

### Open issues and risks

- **Practice library is not covered.** The spec's data model references ranked
  `questions(id)`/`supersedes_id`, but the 5,322 real questions live in
  `practice_questions` (106 papers). Phase 1 therefore has no live shareable
  ranked questions in production; almost all shareable content is in the
  separate practice tables. Phase 2 needs a decision: extend the mapping to
  practice questions (parallel table or generalized source column) or keep the
  feature ranked-only.
- Every practice paper is PYQ-sourced, so even after extending the mapping the
  default is `share_enabled=0` until the owner confirms rights per question or
  paper. No rights decision was made by the agent.
- The public `/q/...` page, reveal-policy APIs, share sheet/image generation,
  context analytics and SEO output are Phase 2–5 work.
- Production admin UI still needs the owner to sign in with Google as
  `rajpal010304@gmail.com`; the agent cannot complete OAuth.

### Next step

Phase 2: build `/q/{slug}-{public_id}` and `/api/public-questions/{publicId}`
(plus the eligible check endpoint) with server-side reveal enforcement. Before
that, settle the practice-library source question so the public page can serve
the 5,322 real questions, not only the empty ranked bank.

## Phase H — admin full control and design system (2026-11-02)

### Admin panel

- Added a single permission source of truth in `src/lib/auth/admin.ts` (25 capabilities across
  questions, taxonomy, mocks, media, SEO, attempts, users, admins, data, trash, revisions and
  audit). `GET /api/admin/me` returns the role, permissions and `isSuper`, and the shell renders
  from that response instead of duplicating role checks.
- One-shot bootstrap: `BOOTSTRAP_SUPER_ADMIN_EMAIL` and `npm run admin:create` only promote while
  no active super admin exists. `rajpal010304@gmail.com` is `super`/active in remote D1 (id 3)
  and local D1 (id 13).
- Added `/admin/review` with totals, per-paper pending counts, flags and keyed-without-explanation
  rows. Added `/admin/attempts`, `/admin/admins`, `/admin/passages`, `/admin/trash`,
  `/admin/data`, `/admin/search`, bulk question actions, duplicate/archive mocks, slug redirects,
  revision history/restore and direct question hotfix with a reason, snapshot, impact preview and
  optional batched rescore.
- Admin writes are same-origin, permission-checked and audited with actor, action, entity,
  before/after and reason. Trash restore is available to Super; permanent purge is Super-only and
  requires confirmation.
- Added `/docs/ADMIN_GUIDE.md` with sign-in, role matrix, screen map, workflows, safety rules and
  troubleshooting.

### Design system and logo

- Added `src/styles/tokens.css` as the only source of colour values: light, OS-dark and explicit
  dark blocks with parity and WCAG contrast enforced by `tests/unit/design-tokens.test.ts`, plus
  a print token set.
- Added `ThemeToggle.astro` with System → Light → Dark cycling, no-flash bootstrapping, cross-tab
  sync and safe behaviour when storage is blocked. `data-theme` is the only theme switch
  (`system` removes the attribute); the old `.dark` class path was removed.
- Tokenised the attempt player, local practice player, discussion surfaces, dashboard settings and
  shared shell. Added an Appearance section to `/dashboard/settings`, a dev-only
  `/dev/styleguide` catalogue (404 in production) and dark/light side-by-side previews.
- Replaced the text “CF” badge with a custom answer-sheet/check SVG mark at `public/logo.svg`,
  plus PNG fallbacks (`logo.png`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`).
  `BrandLogo` and the admin header use the SVG with empty alt text next to live wordmark text;
  Organization JSON-LD now exposes `logo` and `image`, and pages link the apple-touch icon.
- Darkened the shared brand/accent palette steps used by legacy utility classes until white-on-
  brand buttons reached 4.5:1, and fixed the admin mobile logo link and review-queue stat
  opacity. Both light and dark themes now pass axe WCAG 2.2 AA.

### Content and public experience

- Refined OCR library: **106 papers, 5,322 questions, 5,154 printed keys, 824 assets, 664 image
  questions, 168 unscored**. `_validate_library.py` reports 0 errors.
- Seven printed keys recovered; History 2022-08-21 Shift 1 is fully keyed after using CUETMOCK as
  the cross-check because the Hindi solved paper disagreed on at least five answers.
- `parse_solved2022` and `parse_q2023` accept the actual printed/solved layouts (heading keys,
  `S`-prefixed rows, optional `Ans.`, `<div>` wrappers). OCR `Answer:` recovery by local question
  number remains disabled because compacted numbering produced wrong keys.
- Homepage hero and the below-hero two-column band both use the refined “Most Popular” ranking:
  fully keyed papers first, then newest year, then most scored questions.
- `/practice` is indexable and in the sitemap. `/cuet-ug-mock-test` filters the archived production
  fixture mocks, and the starter “E2E Local Fixture Mock” is filtered from public lists.
- Public question counters now count only questions attached to a published mock plus the refined
  library, so subject/syllabus pages no longer report stale D1 rows.

### Verification

- `astro check`: 0 errors, 0 warnings, 0 hints over 273 files.
- `npm test`: **192/192 passed**.
- `npx playwright test`: **46 passed, 1 skipped**; the blocked-localStorage test stubs the
  dev-only Astro toolbar, which reads storage unguarded and is not shipped in production.
- `npm run test:a11y` with the local admin account: **232 axe scans** (public + authenticated,
  desktop/mobile, light/dark) with no WCAG A/AA violations and no horizontal overflow.
- Production verification: `/api/admin/me` returns 401 without a session; `/logo.svg`,
  `/logo.png` and `/apple-touch-icon.png` return 200 with the right content types; homepage
  contains the SVG mark, apple-touch link and Organization `logo`/`image`; system dark paints
  `rgb(15, 23, 42)` without a flash; stored light wins and survives reload; the toggle cycles and
  clears storage; `/dev/styleguide` returns 404; sitemap has 182 URLs and **182/182 return 200**.
- Migration `0009_admin_full_control.sql` applied to remote `cuet-blueprint-db`. Remote `admins`
  contains only the two active supers; `revisions`, `rescore_jobs`, `slug_redirects` and the new
  attempt void columns exist.

### Remaining for Phase H

- The owner must sign out and back in with `rajpal010304@gmail.com` to see the live Google admin
  session; OAuth cannot be completed by the agent.
- 168 questions remain unscored and 872 keyed questions have no printed explanation. No key or
  explanation was invented; these are visible in `/admin/review`.
- Raw Tailwind palette utilities remain on some legacy pages (the colour-leak test enforces that no
  literal hex/rgb/hsl colours exist outside `tokens.css`; full semantic conversion is a follow-up).

## Done in this step

- NTA-style attempt interface in `src/pages/attempt/[id].astro`, compact
  full-wordmark `BrandLogo`, five-state mutually exclusive palette counts, responsive
  right-side palette drawer.
- Staging deployed and verified on `b1ebec63`: 240 axe scans (light/dark, 1440/390)
  with no WCAG A/AA violations or horizontal overflow, 30/30 smoke checks, 26/26
  sitemap URLs with the staging origin in both `canonical` and `og:url`, and the
  Lighthouse mobile results below.
- Added the authoritative blueprint at `docs/CUET_MOCK_TEST_BLUEPRINT_v2.md`.
- Added `docs/AUDIT.md` with the Phase A findings.
- Replaced the hard-coded domain with `src/lib/site-url.ts`: staging canonicals, OG,
  JSON-LD, sitemap and robots now use the `SITE_URL` binding; local dev uses the
  request origin. Verified on staging after deploy.
- Added `public/favicon.svg` and icon links in `BaseLayout`, `AdminLayout`, the attempt
  screen and local practice; this removed the `/favicon.ico` 404 and raised Lighthouse
  Best Practices from 96 to 100.
- Recorded Lighthouse 13.6.0 mobile results on `b1ebec63` (one run per template):
  `/` 97/100/100/100, `/cuet-ug-mock-test` 100/100/100/100, mock detail
  99/100/100/100 for performance/accessibility/best-practices/SEO; LCP 0.9–1.2 s,
  TBT 0–70 ms, CLS 0. `/blog` is 66 for SEO because it correctly stays `noindex` until
  a guide is published.
- Phase B closed: migration `0006_schema_parity.sql` aligns `idx_mocks_status` with
  blueprint §5.2 and adds a publication-order index. A fresh column diff found 0
  missing tables and 0 missing columns. Added tests that parse the blueprint SQL and
  migrate a populated legacy database without changing stored scores, answers or
  version pins. Applied `0006` locally and remotely.
- Phase C closed: added `tests/unit/admin-permissions.test.ts` with the exact
  super/editor/moderator/contributor matrix and `requirePermission`/`requireAdmin`
  401/403 behaviour. Added `tests/e2e/security.spec.ts` for signed-in cross-user
  attempt IDOR (read, autosave, submit and result), idempotent PUT/PATCH autosave
  (one answer row), ignored client deadline/scoring fields, escaped comment HTML,
  one-level replies, mute enforcement and the five-comments-per-minute limit. Added an
  admin E2E test for the 500 KB upload cap. Verified: security spec 6/6, admin flow
  6/6, API contracts 11/11, attempt flow 4/4, `npm test` 83/83, `astro check` 0 errors.
  E2E tests that write local D1 rows skip automatically against `PLAYWRIGHT_BASE_URL`.
- Phase F closed in code: added `src/lib/integrations.ts` for Cloudflare Analytics,
  Search Console and AdSense flags. Empty, placeholder or malformed values emit nothing;
  the AdSense loader is opt-in per page and a second route guard blocks attempt, result,
  dashboard, admin, auth, search, practice and profile paths. `/ads.txt` is generated
  only when `ADSENSE_CLIENT` is valid.
- Added `src/lib/email-config.ts` and `src/lib/email.ts` for Resend and Brevo. Password
  reset is disabled with a clear 503 and a disabled form when no provider is configured;
  `DEV_SHOW_RESET_LINK` is honoured only outside production; reset tokens are never
  logged. The Google button is hidden unless both OAuth values exist. `CF_ACCESS_*` is
  preferred, with legacy `ACCESS_*` aliases retained.
- Hardened the D1 backup workflow: it skips with a notice when secrets are missing or
  the repository is public, rather than failing or publishing personal data.
- Added `docs/EXTERNAL_SETUP.md` (exact provider steps and variable names) and
  `docs/LAUNCH-RUNBOOK.md` (DNS, custom domain, OAuth, email, Access, Search Console,
  sitemap, AdSense, backups and rollback). Updated the privacy policy to match the
  optional analytics/ads/cookies behaviour.
- Verified Phase F: `npm test` 104/104, `astro check` 0 errors over 223 files, Phase F
  E2E 2/2, a production build with all optional values set served the analytics beacon,
  Search Console tag, AdSense loader/unit and valid `ads.txt` on the content hub while
  `/login` received no ad script; the same build with values unset served none of them,
  returned 404 for `/ads.txt`, and returned 503 with a clear message from
  `/api/auth/forgot`. With a temporary `noindex` override on the hub, the same configured
  build kept the analytics beacon but emitted no AdSense loader or unit, proving the
  noindex gating; the override was removed afterwards.
- Deployed Phase F to staging as `4ab4cfd3-e48f-4293-bd21-2f4d9ac7e1f0`. Staging smoke
  passed 30/30, 240 axe scans completed with no WCAG A/AA violations or horizontal
  overflow, and the live Worker served no analytics beacon, AdSense script/unit or
  Search Console tag because the optional values are empty. `/ads.txt` returned 404 and
  `/api/auth/forgot` returned 503 with the support message. The Google button remained
  visible because staging OAuth is configured.
- Phase G query-budget review found two free-plan risks. Submit and expiry wrote one D1
  statement per question, so a 200-question paper could exceed the free plan's
  50-queries-per-invocation limit; autosave also rewrote every question on every save.
  `finalizeAttempt` now creates missing answer rows with one `INSERT OR IGNORE ... SELECT`,
  writes correctness with one `CASE` update per 400 questions, and merges all subject and
  topic stats in one multi-row upsert. The attempt client tracks a dirty set and sends
  only answers changed since the last successful save; an empty save does not call the
  API.
- Added `migrations/0007_query_budget_indexes.sql`: a composite
  `idx_attempts_user_mock_status(user_id, mock_id, status)` and
  `idx_attempts_started(started_at)`. Applied locally and remotely. The submit
  `finalize_earlier` lookup dropped from 37 rows read to 4, and the admin
  "attempts today" count moved from a full scan to `idx_attempts_started`.
- Measured remote D1 rows read per view: homepage ~110, mock hub ~44, mock detail ~46
  (67 with the discussion feed), attempt ~11–13, result ~106 (72 from the two rank
  counts), autosave ~8 and submit ~20–25 with a constant query count. The 7-day top
  runtime queries were subject catalogue 6,588 rows/108 runs, homepage subjects
  5,037/69, subject+exam by slug 4,958/67, subject name list 4,716/131 and subject+exam
  variant 3,948/42; these are bounded by the 18-subject taxonomy and were left in place.
  The leaderboard `RANK()` (3,505/65) and admin attempts list (3,179/31) remain indexed
  reads that grow with total attempts; KV/aggregate caching is deferred until measured
  load justifies it.
- Added `tests/e2e/slow-network.spec.ts` and passed it locally and against staging:
  390×844 mobile viewport, 400 ms latency, 400 kbps up/down and 4× CPU throttle. The
  attempt loaded, answered, autosaved, survived a reload with the saved answer, and
  submitted to the server-scored result. The test skips the test-only
  `cf-connecting-ip` header when `PLAYWRIGHT_BASE_URL` targets Cloudflare, because
  Cloudflare rejects client-supplied values.
- Phase G close-out on staging `93e99cb2`: `npm test` 104/104, `astro check` 0 errors
  over 224 files, 36 Playwright tests defined, targeted E2E 35/35 (attempt-flow 4,
  security 6, admin-flow 6, API contracts 11, integrations/local practice 8), slow-network
  1/1, `npm run test:a11y` 240 scans with no WCAG A/AA violations or horizontal
  overflow, and `npm run smoke:staging` 30/30. A physical-phone pass has not been run.
- Phase H moved the refined practice library out of the build-time JSON bundle and into
  D1. Production `cuet-blueprint-db` previously held only 1 archived mock, 2 fixture
  questions, 18 subjects, 7 users and 42 attempts (0.52 MB); the 106 papers, 5,322
  questions and 5,154 keys existed only in `src/data/local-papers/*.json` and
  `public/local-papers/papers/*.json`. `migrations/0010_practice_library.sql` adds
  `practice_papers`, `practice_passages` and `practice_questions` plus `subjects.code`,
  deliberately separate from the immutable ranked `questions`/`mock_tests` engine.
- `scripts/import-practice-library.mjs` uses the same pure normaliser as the runtime
  (`src/lib/practice-normalize.ts`), merges `keys.json`, writes A/B/C/D option ids, and
  supports `--local`, `--remote` and `--dry-run`. The dry run matched the generated
  index exactly: 106 papers, 5,322 questions, 5,154 scorable, 168 pending, 664
  image-bearing rows and 824 assets. Re-running replaces the seeded rows for every slug
  in `index.json`; it is a seed import, not an edit-preserving sync.
- Runtime reads now come from D1. `src/lib/practice-store-d1.ts` loads a compact index
  (counts derived with SQL aggregates, never stored) and each paper in one batched
  query. `src/middleware.ts` warms the index with a 30-second in-isolate TTL and keeps
  serving the last good snapshot if a refresh fails. The public API stayed synchronous:
  all existing `getLocalPapers*` call sites and paths are unchanged. `LocalPaperCard`
  and the take screen still receive no keys before submission; grading stays in memory
  and remains unranked with no D1 write.
- Admin integration: `practice_papers`, `practice_passages` and `practice_questions`
  are in the data-manager allow-list, `subjects.code` is editable, and
  `/admin/review` reads keys, pending rows and missing explanations from D1 instead of
  importing `keys.json`.
- Verification: `npm test` 194/194 (including a D1 row-mapping round-trip over all 106
  papers and an index-count parity check), `astro check` 0 errors over 278 files,
  `astro build` succeeded, and remote import produced 106 papers / 5,322 questions /
  124 passages / 5,154 keyed / 168 pending / 664 image rows / 824 assets. Production D1
  grew from 0.52 MB to 6.56 MB; the 42 existing attempts and user rows were untouched.
  872 keyed rows still have no printed explanation and were not filled in.
- Deployed as Worker version `8400f689-ff38-4039-a849-0f1624a31b1d`. Live checks:
  home 200, `/practice` 200 with 106 paper links, paper detail and take 200 (take
  payload contains no key/explanation fields, 49 questions), `/sitemap.xml` 200 with
  106 `/practice/` URLs, and a same-origin submit returned `ranked: false`,
  `localOnly: true`, score 5 for one corrected answer.
- Local Playwright passed 46/47 tests (the opt-in slow-network test skipped) including
  the D1-backed practice flow and the admin review queue. The live axe audit completed
  100 scans across public and practice pages with no WCAG A/AA violations and no
  horizontal overflow.
- Verified the generic admin write path against the practice library on local D1.
  `PATCH /api/admin/data/practice_questions/1` changed `explanation`, the change
  survived a re-read, and reverting restored the original 1,185-character value.
  Soft delete set `deleted_at`, the data-manager restore and the `/admin/trash` restore
  both cleared it, and `audit_log` recorded `data.update` (twice, with before/after
  diffs), `data.delete`, `data.restore` and `trash.restore` for `practice_questions`.
  A temporary stem edit appeared on the public `/practice/<slug>/take` page on the
  next request (still with no key/explanation fields) and disappeared after revert.
  Remote D1 was not touched by these tests. Live admin sign-in still needs the owner's
  Google session; unauthenticated `/api/admin/me` returns 401 and `/admin/review`
  redirects to `/login?next=%2Fadmin%2Freview` as expected.
- Closed a trash gap found during that review: `practice_passages` had no
  `deleted_at`, so deleting a passage was permanent, and the practice tables were
  missing from `/admin/trash`'s table list. Migration
  `0011_practice_passage_trash.sql` adds the column (applied locally and remotely),
  the public paper reader filters deleted passages, the data-manager schema marks
  passages soft-deletable, and Trash now lists all three practice tables. Verified
  locally: deleting passage 117 removed its text from
  `/practice/english-2024-05-29-shift-1/take`, the row appeared in Trash, restoring it
  brought the passage back, and `audit_log` recorded `data.delete` and `trash.restore`.
  `npm test` 197/197, `astro check` 0 errors over 279 files, and the build passed.
  Deployed as `273597a9-d9e6-4b3a-a745-9135a959cdf8`; live home, `/practice`
  (106 links), the take page (passage present, no key fields), `/sitemap.xml`
  (184 URLs, 106 practice) and an unranked submit all passed.
- Re-ran the full Playwright suite after the trash change: 46 passed, 1 skipped (the
  opt-in slow-network test), including admin, practice, security and theme flows. A
  live sweep of all 106 sitemap practice papers found every detail and take page 200,
  every take payload contained questions, and none exposed `correctOption`,
  `correctAnswer` or an explanation key. The single regex hit was a printed OCR stem
  containing the word "correctanswer".

## In progress

- Real-phone pass on iOS Safari and Android Chrome; the throttled Playwright test covers
  only a simulated slow network.
- Decision on the verified-data SEO pages (eligibility, subject combination, cutoff).
  Calculators remain post-launch per blueprint §15.

## Blocked (external)

- Domain registration and DNS; production OAuth redirect URIs and consent-screen
  verification; Cloudflare Access application; R2 enablement; email-provider
  credentials; analytics/Search Console/AdSense accounts; GitHub backup secrets.
- Editorial: two-person review of the OCR practice papers and an official answer-key
  match before any ranked or PYQ import.
- Exam facts: verify dates, pattern, marking scheme and syllabus against an official
  NTA source before removing verification-pending notices.

## Next

1. Run a real-phone attempt on iOS Safari and Android Chrome over a real mobile network;
   record device, OS, browser and any layout/timer issue.
2. Decide whether verified-data eligibility/subject-combination/cutoff pages are in
   launch scope; do not invent official facts.
3. When the external accounts exist, follow `docs/LAUNCH-RUNBOOK.md` and record the
   production version and provider evidence.
