# TESTING — how to run the complete QA suite for cuetfreemocktest.com

> Scope: every verification gate the project has, what each one proves, and
> what is deliberately covered elsewhere. App parity maps, local commands and
> the manual release checklist.

## 0. Layout

```
tests/unit/            Vitest — logic, helpers, source guards (*.test.ts)
tests/e2e/             Playwright — full browser flows (*.spec.ts)
scripts/seo-consistency.mjs   SEO/canonical/sitemap gate
scripts/a11y-audit.mjs       axe-core WCAG A/AA scan
scripts/lighthouse-audit.mjs  Budgeted Lighthouse medians
scripts/qa-data-audit.mjs     Data-integrity audit (D1)
scripts/check-links.mjs       Broken internal/external links
scripts/qa-redirect-audit.mjs Archived-paper and legacy-slug 301 audit
scripts/fix-english-mini-mock-v2.mjs  One-off 5→50 mock repair template (BUG-011)
scripts/check-env-separation.mjs  Env/engine guard
performance-budget.json        Route Lighthouse caps
```

## 1. Prerequisites

- Node 24+, `npm ci`
- A seeded local D1 — the production-shaped fixture used by CI:
  ```sh
  npm run db:migrate:local
  npm run db:import:practice:local
  npm run db:import:ranked-practice:local
  node scripts/backfill-explanation-provenance.mjs
  node scripts/seed-e2e-admin.mjs
  node scripts/seed-e2e-mock.mjs
  ```
- Wrangler authenticated (`npx wrangler whoami`) when you target anything remote.
- `.dev.vars` present and ignored (it holds local-only credentials). Never commit it.

## 2. Parity with production (localhost:4321)

| Behaviour | Local script | Note |
| --- | --- | --- |
| Same routes/SSR/headers | `npx wrangler dev --port 4321 --ip 127.0.0.1 --var USE_LOCAL_D1:1 --var PREVIEW_CANONICAL_ORIGIN:http://localhost:4321 --var SITE_URL:http://localhost:4321` | serves the **built** worker; closest to production |
| Canonical/trailing-slash redirects | same (or astro dev with same vars) | loopback aliases `127.0.0.1 → localhost` are mapped in preview mode |
| Production build preview | `npm run build` then the wrangler command above | Lighthouse uses this shape |
| `astro dev` | `npm run dev` | adds dev-only routes (`/dev/consent`, `/dev/styleguide`) used by the a11y and E2E harnesses; CSP is not applied in dev |
| DB engine | local: D1 binding; production: Turso/libSQL | selected in `src/lib/db.ts`; `check:env` asserts the committed config and `--live` proves a deployed origin |

Google OAuth round-trip cannot be exercised locally (no OAuth app registered for loopback). The code is tested through the failure paths; production sign-in is verified manually.

## 3. Every gate, offline

```sh
# unit + integration
npm test                       # 677 tests as of 2026-11-20

# unit coverage (v8; writes coverage/ — HTML + json-summary)
npm run test:coverage

# build (astro check + astro build + secret scan)
npm run build

# API/security contract E2E
npm run test:api

# full E2E suite (chromium, desktop + mobile viewports where specs set them)
USE_LOCAL_D1=1 npm run test:e2e     # reuses the seeded local D1
USE_PROD_BUILD=1 npm run test:e2e  # same tests against the production build

# accessibility (needs the dev-only /dev/consent route; starts its own server)
A11Y_SKIP_ATTEMPT=0 npm run test:a11y

# SEO/sitemap consistency
npm run seo:check

# data integrity (read-only local D1; exits non-zero on any P1 finding)
npm run test:data

# broken links (needs a running server on :4321)
npx astro dev --background --port 4321 && npm run test:links

# archived-paper / legacy-slug redirects (needs the same running server + local D1)
npm run test:redirects

# env separation / live engine probe
npm run check:env            # static
npm run check:env:live       # fetch https://cuetfreemocktest.com/api/health

# budgeted Lighthouse (needs port 4321 free, spawns its own wrangler preview)
npm run audit:lighthouse -- --runs=3

# unit + e2e + a11y + lighthouse (not the server-dependent link/redirect/data gates)
npm run test:all
```

## 4. CI gate (`.github/workflows/ci.yml`)

What runs on every push/PR and what is blocking:

| Step | Blocking on P0/P1 regression? |
| --- | --- |
| Lint copy, env separation, type check, unit tests + coverage, build | yes (job fails) |
| SEO consistency & sitemap audit | yes |
| Data integrity audit (`npm run test:data`, P1s fail) | yes |
| Playwright E2E | yes |
| Link check (internal only; external links are informational) | yes, internal only |
| Archived-paper / legacy-slug redirect audit (`npm run test:redirects`) | yes |
| Accessibility (axe) | yes |
| Lighthouse local | run locally via `npm run audit:lighthouse`; budget is stronger than CI noise tolerance, intentionally not wired as a blocking PR gate |

Preview deployments go through the `Deploy staging` / `Auto deploy production` workflows; a `[skip deploy]` in the commit subject opts out of the automatic production deploy.

### Artifacts and evidence

| Evidence | Location | Retention |
| --- | --- | --- |
| E2E JSON (machine-readable) | `docs/report/playwright-results.json` | committed |
| E2E HTML report | `playwright-report/` | CI artifact, 7 days (generated when `CI=1`) |
| E2E traces/screenshots on failure | `test-results/` | CI artifact, 7 days |
| axe results | `docs/report/a11y-results.json` | committed |
| Lighthouse raw runs + summary | `docs/report/lighthouse/` | committed |
| Data audit CSV/summary | `test-artifacts/data-audit.csv`, `test-artifacts/data-audit-summary.md` | local; CI uploads 7 days |
| Unit coverage (v8) | `coverage/` (text, HTML, `coverage-summary.json`) | local; CI uploads 7 days |
| Link/responsive logs, sitemap CSV, screenshots | `test-artifacts/` | local only (gitignored) |

`test-artifacts/` is deliberately gitignored. A fresh clone has no raw logs or screenshots; rerun the gate to regenerate them. The tracked JSON files are the durable evidence of record. To keep a local E2E run from overwriting the committed JSON, set `PLAYWRIGHT_JSON_OUTPUT_NAME=test-artifacts/e2e-<label>.json`.

## 5. Adding a test

- **Unit/logic** — mirror the repo pattern (`tests/unit/<thing>.test.ts`, Vitest). Prefer testing a pure helper or a source guard; if the behaviour needs context, seed it like `tests/unit/env-separation.test.ts`.
- **API contract** — extend `tests/e2e/api-contracts.spec.ts` with seeded local fixtures (never against production).
- **E2E flow** — add a spec under `tests/e2e/`; keep it chromium-only, seed-eg deterministic, and re-use the helpers in `tests/e2e/admin-flow.spec.ts`. The webServer config auto-starts the app and guarantees `USE_LOCAL_D1=1`, so writes never touch production. Specs that drive local D1 through the Wrangler helpers can exceed Playwright's 30 s default; call `test.slow()` at the top of those tests.
- **Data invariant** — add the assertion to `scripts/qa-data-audit.mjs` if it is a structural property (counts, orphans, dupes); exit code 1 on P1.
- **Lighthouse budget** — tighten `performance-budget.json` only with evidence and a rationale.

## 6. Adding a new paper or question safely

1. **Editorial first.** The paper editor imports questions via the admin import; answers and explanations get reviewed against the source.
2. **Immutability invariants** are enforced by triggers; bypassing them destroys audit history.
3. **Counts.** Every public published mock version must have exactly 50 distinct questions; `publishMockVersion` rejects any other count, and `npm run test:data` rates a non-50 published version P1 (directly seeded E2E fixtures and archived redirect stubs are exempt). Rebuilt ranked sets are also expected to have exactly 50 non-deleted distinct questions; `duration_locked = 1` means the paper is deliberately locked at an official duration (60 minutes for all current sets).
4. **Validation** — run `npm run test:data`; it must report **0 P1** before release. Warnings for missing explanations are editorial, not release-blocking.
5. **Redirects** — retiring a paper means keep the row, set `is_archived = 1`, point `replaced_by` at the replacement set or the subject's previous-year hub (pick a 200 target), and let `slug_redirects` give the 301. Never delete rows that attempts or audit log reference.
6. **Topic mapping** — tag questions via `scripts/tag-practice-questions.mjs` (supports `--turso`); dry-run first, then apply inside one interactive write transaction.
7. **Production data** — migrations go via `npm run db:turso:migrate` after a dry run; seeds via the matching `db:import:*:remote` scripts. Always confirm the engine (`npm run check:env:live` before and after).
8. **Repairing a non-50 published mock** — never edit a published version or delete attempts. `scripts/fix-english-mini-mock-v2.mjs` is the applied template: `--dry-run` first, then (with explicit owner approval) `--turso` writes a JSON backup and one transaction that inserts the replacement version as `draft`, adds the 50 question rows, publishes it, supersedes the old version and updates `mock_tests.current_version_id`. Attempts keep their original `version_id`, so their questions and marks stay resolvable. The script re-runs refuse once the target is already migrated.

## 7. Manual QA checklist before any release

Work through `policy`, `legal` and attempt flows at 360/390/768/1024/1440/1920, light and dark; then:

- `/`, `/mock-tests`, one rebuilt PYQ set, instructions, attempt with a fresh guest cookie: start → answer → refresh → resume → submit → result truthful (score matches independently recomputed expected value);
- result solutions only after submit; rank/percentile truthful to the leaderboard definition (first attempt only);
- `/login`, sign out → `/dashboard` 303→`/login?next=…`;
- `Cache-Control: no-store` on auth/private; CSP present; no analytics before consent; `/ads.txt` 404 while ads are off;
- 301 for every archived path lands on a 200 target (see `scripts/qa-data-audit.mjs` output, archived_replaced_by must be 0);
- `X-Robots-Tag` only on private/noindex pages; sitemap ⊇ all indexable pages, excludes private/fixture/noindex;
- check the paper you just published shows identical counts on: cards, hub rails, details, instructions meta, JSON-LD, result/leaderboard/dashboard, and search/meta results.
