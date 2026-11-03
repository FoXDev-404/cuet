# Appendix E: File Tree and Repository Organization

> Directory hierarchy to depth 4 (excluding `.git`, `node_modules`, `dist`, `.wrangler`).

## 1. Top-Level Directory Roles

| Directory | Purpose and Responsibility |
|---|---|
| `/docs` | Architectural blueprints, keyword mapping, specification prompts, and technical audit reports. |
| `/migrations` | Versioned SQL migration scripts for Cloudflare D1 SQLite database schema. |
| `/public` | Static web assets served directly (diagrams, images, favicons, robots.txt, local paper JSON bundles). |
| `/scripts` | Operational tooling and maintenance CLI scripts (accessibility audit, D1 import scripts, cache purge). |
| `/src` | Application source code (Astro UI pages, API endpoints, components, layouts, libraries, styles, content schemas). |
| `/tests` | Automated test suite (unit tests in `tests/unit`, integration tests in `tests/integration`, E2E tests in `tests/e2e`). |
| `/tools` | OCR parsing, extraction pipelines, and automated dataset migration scripts. |

---

## 2. Repository File Tree (Depth 4)

```text
CUET Mock/
├── .github/
│   └── workflows/
│       └── d1-backup.yml
├── cuet-astro/
├── docs/
│   ├── report/
│   │   ├── APPENDIX_A_ROUTES.md
│   │   ├── APPENDIX_B_SCHEMA.md
│   │   ├── APPENDIX_C_TEST_RESULTS.md
│   │   ├── APPENDIX_D_DEPENDENCIES.md
│   │   ├── collect_routes.py
│   │   ├── collect_schema.py
│   │   ├── generate_appendix_b.py
│   │   ├── generate_appendix_c.py
│   │   ├── generate_appendix_d.py
│   │   ├── generate_appendix_e.py
│   │   ├── raw_deps.json
│   │   └── raw_schema.json
│   ├── ADMIN_DIAGNOSIS.md
│   ├── ADMIN_GUIDE.md
│   ├── ASTRO-DEPLOYMENT.md
│   ├── AUDIT.md
│   ├── BLUEPRINT-V2-COMPLIANCE.md
│   ├── CUET_MOCK_TEST_BLUEPRINT_v2.md
│   ├── DESIGN_AUDIT.md
│   ├── EXTERNAL_SETUP.md
│   ├── LAUNCH-RUNBOOK.md
│   ├── PROGRESS.md
│   ├── PROJECT_REPORT_PROMPT.md
│   └── SHARE_FEATURE.md
├── export/
│   └── cuet-dataset/
│       ├── assets/
│       │   └── ... (97 items)
│       ├── mock/
│       │   ├── mockQuestions.json
│       │   ├── mockTests.json
│       │   ├── mockTestVersions.json
│       │   ├── passages.json
│       │   ├── questions.csv
│       │   ├── questions.json
│       │   └── subjects.json
│       ├── pyq/
│       │   ├── papers/
│       │   ├── index.json
│       │   ├── questions.csv
│       │   ├── questions.json
│       │   ├── source-index.json
│       │   └── source-keys.json
│       ├── schema/
│       │   ├── 0001_init.sql
│       │   ├── 0002_mock_versions.sql
│       │   ├── 0002_seed.sql
│       │   ├── 0003_content_and_ops.sql
│       │   ├── 0004_immutability_guards.sql
│       │   ├── 0005_seo_canonical.sql
│       │   ├── 0006_schema_parity.sql
│       │   ├── 0007_query_budget_indexes.sql
│       │   ├── 0008_archive_placeholder_mock.sql
│       │   ├── 0009_admin_full_control.sql
│       │   ├── 0010_practice_library.sql
│       │   ├── 0011_practice_passage_trash.sql
│       │   ├── 0012_question_share.sql
│       │   ├── 0013_question_share_indexes.sql
│       │   └── 0015_ranked_practice_library.sql
│       ├── manifest.json
│       └── README.md
├── graft/
│   ├── .cache/
│   │   ├── ask-index.json
│   │   ├── extract.b3c5002f26d64244.json
│   │   ├── fingerprint.b3c5002f26d64244.json
│   │   └── telemetry-repo-id.json
│   ├── .graph/
│   │   └── wiring.json
│   ├── scripts/
│   │   ├── lib/
│   │   │   └── question-og.md
│   │   ├── a11y-audit.md
│   │   ├── admin-create.md
│   │   ├── backfill-question-public-ids.md
│   │   ├── generate-question-og.md
│   │   ├── import-practice-library.md
│   │   ├── import-ranked-practice.md
│   │   └── staging-smoke.md
│   ├── src/
│   │   ├── lib/
│   │   │   ├── admin/
│   │   │   ├── auth/
│   │   │   ├── share/
│   │   │   ├── attempt-save.md
│   │   │   ├── attempt-time.md
│   │   │   ├── attempts.md
│   │   │   ├── audit.md
│   │   │   ├── blog.md
│   │   │   ├── bookmarks.md
│   │   │   ├── canonical.md
│   │   │   ├── chat.md
│   │   │   ├── content.md
│   │   │   ├── db.md
│   │   │   ├── discussions.md
│   │   │   ├── email-config.md
│   │   │   ├── email.md
│   │   │   ├── http.md
│   │   │   ├── image.md
│   │   │   ├── integrations.md
│   │   │   ├── local-papers.md
│   │   │   ├── media-dimensions.md
│   │   │   ├── media.md
│   │   │   ├── moderation.md
│   │   │   ├── navigation.md
│   │   │   ├── practice-library.md
│   │   │   ├── practice-normalize.md
│   │   │   ├── practice-store-d1.md
│   │   │   ├── practice-store-rows.md
│   │   │   ├── pyq.md
│   │   │   ├── ranking.md
│   │   │   ├── rich-text.md
│   │   │   ├── scoring.md
│   │   │   ├── search.md
│   │   │   ├── seo.md
│   │   │   ├── settings.md
│   │   │   ├── site-url.md
│   │   │   └── slug-redirects.md
│   │   ├── pages/
│   │   │   ├── api/
│   │   │   ├── pyq/
│   │   │   ├── ads.txt.md
│   │   │   ├── robots.txt.md
│   │   │   └── sitemap.xml.md
│   │   ├── env.d.md
│   │   └── middleware.md
│   ├── tests/
│   │   ├── e2e/
│   │   │   ├── admin-flow.spec.md
│   │   │   ├── api-contracts.spec.md
│   │   │   ├── attempt-flow.spec.md
│   │   │   ├── integrations.spec.md
│   │   │   ├── local-practice.spec.md
│   │   │   ├── question-share-public.spec.md
│   │   │   ├── security.spec.md
│   │   │   ├── slow-network.spec.md
│   │   │   └── theme.spec.md
│   │   ├── integration/
│   │   │   ├── question-share.test.md
│   │   │   └── schema.test.md
│   │   └── unit/
│   │       ├── access-config.test.md
│   │       ├── admin-permissions.test.md
│   │       ├── admin-practice-schema.test.md
│   │       ├── attempt-time.test.md
│   │       ├── content.test.md
│   │       ├── design-colour-leak.test.md
│   │       ├── design-tokens.test.md
│   │       ├── email-config.test.md
│   │       ├── image.test.md
│   │       ├── integrations.test.md
│   │       ├── local-papers.test.md
│   │       ├── mock-order.test.md
│   │       ├── moderation.test.md
│   │       ├── oauth-config.test.md
│   │       ├── password.test.md
│   │       ├── public-id.test.md
│   │       ├── public-question.test.md
│   │       ├── question-import.test.md
│   │       ├── ranking.test.md
│   │       ├── rich-text.test.md
│   │       ├── scoring.test.md
│   │       ├── share-events.test.md
│   │       ├── share-message.test.md
│   │       └── share-policy.test.md
│   ├── tools/
│   │   └── ocr/
│   │       ├── _build_local_papers.md
│   │       ├── _composite_sheets.md
│   │       ├── _download_ocr_images.md
│   │       ├── _download_ocr_pages.md
│   │       ├── _validate_library.md
│   │       └── build_dataset.md
│   ├── astro.config.md
│   ├── INDEX.md
│   ├── playwright.config.md
│   └── vitest.config.md
├── migrations/
│   ├── 0001_init.sql
│   ├── 0002_mock_versions.sql
│   ├── 0002_seed.sql
│   ├── 0003_content_and_ops.sql
│   ├── 0004_immutability_guards.sql
│   ├── 0005_seo_canonical.sql
│   ├── 0006_schema_parity.sql
│   ├── 0007_query_budget_indexes.sql
│   ├── 0008_archive_placeholder_mock.sql
│   ├── 0009_admin_full_control.sql
│   ├── 0010_practice_library.sql
│   ├── 0011_practice_passage_trash.sql
│   ├── 0012_question_share.sql
│   ├── 0013_question_share_indexes.sql
│   └── 0015_ranked_practice_library.sql
├── public/
│   ├── local-papers/
│   │   ├── assets/
│   │   │   └── ... (121 items)
│   │   └── papers/
│   │       └── ... (214 items)
│   ├── og/
│   │   └── questions/
│   │       └── R1hmOFWkeA.png
│   ├── apple-touch-icon.png
│   ├── favicon.svg
│   ├── logo.png
│   └── logo.svg
├── scripts/
│   ├── lib/
│   │   └── question-og.mjs
│   ├── a11y-audit.mjs
│   ├── admin-create.mjs
│   ├── backfill-question-public-ids.mjs
│   ├── generate-question-og.mjs
│   ├── import-practice-library.mjs
│   ├── import-ranked-practice.mjs
│   └── staging-smoke.mjs
├── src/
│   ├── components/
│   │   ├── AdSlot.astro
│   │   ├── BrandLogo.astro
│   │   ├── DiscussionPreview.astro
│   │   ├── FaqSection.astro
│   │   ├── LocalPaperCard.astro
│   │   ├── MockForm.astro
│   │   ├── MockShareSheet.astro
│   │   ├── PageHero.astro
│   │   ├── QuestionForm.astro
│   │   ├── QuestionSharePanel.astro
│   │   ├── RevisionHistory.astro
│   │   ├── SeoIntro.astro
│   │   ├── ShareSheet.astro
│   │   └── ThemeToggle.astro
│   ├── data/
│   │   └── local-papers/
│   │       ├── index.json
│   │       └── keys.json
│   ├── layouts/
│   │   ├── AdminLayout.astro
│   │   └── BaseLayout.astro
│   ├── lib/
│   │   ├── admin/
│   │   │   ├── admins.ts
│   │   │   ├── announcements.ts
│   │   │   ├── attempts.ts
│   │   │   ├── blog.ts
│   │   │   ├── data.ts
│   │   │   ├── leaderboard.ts
│   │   │   ├── mock-order.ts
│   │   │   ├── mocks.ts
│   │   │   ├── passages.ts
│   │   │   ├── pyq.ts
│   │   │   ├── question-import.ts
│   │   │   ├── questions.ts
│   │   │   ├── rescore.ts
│   │   │   ├── revisions.ts
│   │   │   ├── schema.ts
│   │   │   ├── search.ts
│   │   │   ├── settings.ts
│   │   │   ├── share.ts
│   │   │   ├── trash.ts
│   │   │   └── users.ts
│   │   ├── auth/
│   │   │   ├── access-config.ts
│   │   │   ├── access.ts
│   │   │   ├── admin.ts
│   │   │   ├── guard.ts
│   │   │   ├── oauth-config.ts
│   │   │   ├── oauth.ts
│   │   │   ├── password.ts
│   │   │   ├── rate-limit.ts
│   │   │   ├── session.ts
│   │   │   └── users.ts
│   │   ├── share/
│   │   │   ├── backfill.ts
│   │   │   ├── events.ts
│   │   │   ├── mock-share.ts
│   │   │   ├── policy.ts
│   │   │   ├── public-id.ts
│   │   │   ├── public-question-store.ts
│   │   │   ├── public-question.ts
│   │   │   ├── record-share-event.ts
│   │   │   ├── share-card.ts
│   │   │   ├── share-message.ts
│   │   │   ├── share-sheet.ts
│   │   │   └── types.ts
│   │   ├── attempt-save.ts
│   │   ├── attempt-time.ts
│   │   ├── attempts.ts
│   │   ├── audit.ts
│   │   ├── blog.ts
│   │   ├── bookmarks.ts
│   │   ├── canonical.ts
│   │   ├── chat.ts
│   │   ├── content.ts
│   │   ├── db-resilient.ts
│   │   ├── db.ts
│   │   ├── discussions.ts
│   │   ├── email-config.ts
│   │   ├── email.ts
│   │   ├── http.ts
│   │   ├── image.ts
│   │   ├── integrations.ts
│   │   ├── local-mock-fallback.ts
│   │   ├── local-papers.ts
│   │   ├── local-subject-fallback.ts
│   │   ├── media-dimensions.ts
│   │   ├── media.ts
│   │   ├── moderation.ts
│   │   ├── navigation.ts
│   │   ├── practice-cache.ts
│   │   ├── practice-library.ts
│   │   ├── practice-normalize.ts
│   │   ├── practice-store-d1.ts
│   │   ├── practice-store-rows.ts
│   │   ├── pyq.ts
│   │   ├── ranking.ts
│   │   ├── rich-text.ts
│   │   ├── scoring.ts
│   │   ├── search.ts
│   │   ├── seo.ts
│   │   ├── settings.ts
│   │   ├── site-url.ts
│   │   ├── slug-redirects.ts
│   │   ├── subject-stats-core.ts
│   │   └── subject-stats.ts
│   ├── pages/
│   │   ├── admin/
│   │   │   ├── attempts/
│   │   │   ├── data/
│   │   │   ├── mocks/
│   │   │   ├── questions/
│   │   │   ├── admins.astro
│   │   │   ├── announcements.astro
│   │   │   ├── audit-log.astro
│   │   │   ├── blog.astro
│   │   │   ├── discussions.astro
│   │   │   ├── exam-info.astro
│   │   │   ├── index.astro
│   │   │   ├── leaderboard.astro
│   │   │   ├── moderation.astro
│   │   │   ├── passages.astro
│   │   │   ├── pyq.astro
│   │   │   ├── review.astro
│   │   │   ├── search.astro
│   │   │   ├── seo.astro
│   │   │   ├── settings.astro
│   │   │   ├── trash.astro
│   │   │   └── users.astro
│   │   ├── api/
│   │   │   ├── account/
│   │   │   ├── admin/
│   │   │   ├── attempts/
│   │   │   ├── auth/
│   │   │   ├── bookmarks/
│   │   │   ├── discussions/
│   │   │   ├── leaderboards/
│   │   │   ├── me/
│   │   │   ├── media/
│   │   │   ├── mocks/
│   │   │   ├── practice/
│   │   │   ├── public-questions/
│   │   │   ├── questions/
│   │   │   ├── results/
│   │   │   ├── health.ts
│   │   │   ├── share-events.ts
│   │   │   └── subjects.ts
│   │   ├── attempt/
│   │   │   └── [id].astro
│   │   ├── blog/
│   │   │   ├── [slug].astro
│   │   │   └── index.astro
│   │   ├── cuet-mock-test/
│   │   │   ├── [subject]/
│   │   │   └── [slug].astro
│   │   ├── cuet-ug-syllabus/
│   │   │   └── [subject].astro
│   │   ├── dashboard/
│   │   │   ├── wrong-questions/
│   │   │   ├── bookmarks.astro
│   │   │   ├── discussions.astro
│   │   │   ├── history.astro
│   │   │   ├── settings.astro
│   │   │   └── wrong-questions.astro
│   │   ├── dev/
│   │   │   ├── styleguide/
│   │   │   └── styleguide.astro
│   │   ├── leaderboard/
│   │   │   ├── [slug].astro
│   │   │   └── index.astro
│   │   ├── mock/
│   │   │   └── [slug]/
│   │   ├── practice/
│   │   │   ├── [slug]/
│   │   │   ├── [slug].astro
│   │   │   └── index.astro
│   │   ├── pyq/
│   │   │   ├── [year]/
│   │   │   ├── [year].astro
│   │   │   └── index.ts
│   │   ├── q/
│   │   │   └── [slug].astro
│   │   ├── reset-password/
│   │   │   └── [token].astro
│   │   ├── result/
│   │   │   ├── [attemptId]/
│   │   │   └── [attemptId].astro
│   │   ├── u/
│   │   │   └── [username].astro
│   │   ├── 404.astro
│   │   ├── 500.astro
│   │   ├── about.astro
│   │   ├── ads.txt.ts
│   │   ├── contact.astro
│   │   ├── cuet-mock-test.astro
│   │   ├── cuet-ug-exam-pattern.astro
│   │   ├── cuet-ug-important-dates.astro
│   │   ├── cuet-ug-marking-scheme.astro
│   │   ├── cuet-ug-mock-test.astro
│   │   ├── cuet-ug-previous-year-papers.astro
│   │   ├── cuet-ug-syllabus.astro
│   │   ├── dashboard.astro
│   │   ├── disclaimer.astro
│   │   ├── forbidden.astro
│   │   ├── forgot-password.astro
│   │   ├── index.astro
│   │   ├── login.astro
│   │   ├── maintenance.astro
│   │   ├── privacy-policy.astro
│   │   ├── robots.txt.ts
│   │   ├── search.astro
│   │   ├── signup.astro
│   │   ├── sitemap.xml.ts
│   │   └── terms.astro
│   ├── styles/
│   │   ├── global.css
│   │   └── tokens.css
│   ├── env.d.ts
│   └── middleware.ts
├── test-results/
│   ├── admin-flow-an-editor-creates-publishes-and-sees-a-mock-test-chromium/
│   │   └── error-context.md
│   ├── admin-flow-question-creati-f93b5--and-enforce-indexing-rules-chromium/
│   │   └── error-context.md
│   ├── question-share-public-live-da7dd--timer-and-autosave-running-chromium/
│   │   └── error-context.md
│   └── .last-run.json
├── tests/
│   ├── e2e/
│   │   ├── admin-flow.spec.ts
│   │   ├── api-contracts.spec.ts
│   │   ├── attempt-flow.spec.ts
│   │   ├── integrations.spec.ts
│   │   ├── local-practice.spec.ts
│   │   ├── question-share-public.spec.ts
│   │   ├── security.spec.ts
│   │   ├── slow-network.spec.ts
│   │   └── theme.spec.ts
│   ├── integration/
│   │   ├── question-share.test.ts
│   │   └── schema.test.ts
│   └── unit/
│       ├── access-config.test.ts
│       ├── admin-permissions.test.ts
│       ├── admin-practice-schema.test.ts
│       ├── attempt-time.test.ts
│       ├── content.test.ts
│       ├── design-colour-leak.test.ts
│       ├── design-tokens.test.ts
│       ├── email-config.test.ts
│       ├── image.test.ts
│       ├── integrations.test.ts
│       ├── local-mock-fallback.test.ts
│       ├── local-papers.test.ts
│       ├── local-subject-fallback.test.ts
│       ├── mock-order.test.ts
│       ├── moderation.test.ts
│       ├── oauth-config.test.ts
│       ├── password.test.ts
│       ├── practice-library.test.ts
│       ├── public-id.test.ts
│       ├── public-question.test.ts
│       ├── question-import.test.ts
│       ├── ranking.test.ts
│       ├── rich-text.test.ts
│       ├── scoring.test.ts
│       ├── share-events.test.ts
│       ├── share-message.test.ts
│       ├── share-policy.test.ts
│       └── subject-stats.test.ts
├── tools/
│   └── ocr/
│       ├── dataset_export/
│       │   └── ... (109 items)
│       ├── _build_local_papers.py
│       ├── _composite_sheets.py
│       ├── _download_ocr_images.py
│       ├── _download_ocr_pages.py
│       ├── _validate_library.py
│       ├── audit_remote_d1.py
│       ├── build_dataset.py
│       ├── import_2026_dataset.py
│       ├── README.md
│       └── verified_keys.json
├── .dev.vars
├── .dev.vars.example
├── .gitignore
├── .ignore
├── astro.config.mjs
├── package-lock.json
├── package.json
├── playwright.config.ts
├── README.md
├── tsconfig.json
├── vitest.config.ts
└── wrangler.jsonc
```