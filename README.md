# CUET Mock Test

Free CUET mock tests, previous-year practice papers, ranked practice and live
discussions. Built with Astro and deployed on Cloudflare Workers.

Production: <https://cuet-astro.cuet-platform.workers.dev>
Separate dataset deployment: <https://cuet-2026.rajpal010304.workers.dev>

## What is included

- NTA-style timed mock tests with autosave, marking, review and server scoring
- Ranked practice papers with per-paper and cross-paper leaderboards
- Previous-year practice library (245 CUET/CUCET papers, 2021-2026, 7,527 scorable questions)
- New dataset import adds Accountancy, Business Studies, Economics, Political Science, Psychology, Sociology and Legal Studies papers
- Student accounts, dashboard, attempt history, bookmarks and wrong-question retry
- Live mock discussions, replies, reports and admin moderation
- Admin panel for mocks, questions, review queue, media, SEO and audit log
- Public share pages with per-question Open Graph images
- SEO pages, sitemap, robots, structured data and AdSense-ready slots

## Stack

| Layer | Technology |
| --- | --- |
| App | Astro 7 SSR + React 19 islands |
| Styling | Tailwind CSS 4 |
| Runtime | Cloudflare Workers (`cuet-astro`) |
| Database | Cloudflare D1 (`cuet-blueprint-db`) |
| Key-value | Workers KV for sessions and media |
| Tests | Vitest unit/integration + Playwright E2E |

## Layout

```text
.
├── src/                  Astro pages, components, API routes and data helpers
├── public/               Static assets and generated practice-paper media
├── migrations/           D1 schema and seed migrations
├── scripts/              Operational, import, SEO and smoke scripts
├── tests/                Vitest and Playwright suites
├── tools/ocr/            PaddleOCR-VL pipeline and validation (raw exports archived)
├── docs/                 Architecture, deployment, admin and audit documentation
├── wrangler.jsonc        Worker, D1 and KV bindings
└── .github/workflows/    Scheduled D1 backup
```

The generated practice library is committed. Raw PaddleOCR exports are archived
outside the repository; restore them into `tools/ocr/OCR DATA/` only when
rebuilding the library from source scans. See [tools/ocr/README.md](tools/ocr/README.md).

## Local development

Requirements: Node.js 22+, npm, and a Cloudflare account for remote commands.

```sh
npm ci
npm run db:migrate:local
npm run dev
```

Open <http://localhost:4321>. Local secrets belong in `.dev.vars`; start from
`.dev.vars.example`. The local D1/KV state lives in `.wrangler/` and is ignored by
git.

## Checks

```sh
npm test          # Vitest unit and integration tests
npm run build     # astro check + production build
npm run test:e2e  # Playwright end-to-end suite
```

## Database and deployment

```sh
npm run db:migrate:remote
npm run db:import:practice:remote
npm run db:import:ranked-practice:remote
node scripts/backfill-explanation-provenance.mjs
npm run deploy
```

`npm run deploy` builds with the production env and deploys via
`scripts/deploy-production.mjs`; do not run raw `npx wrangler deploy` or you can ship
development vars. The Worker name and production hostname are intentionally unchanged
from the Astro project's original deployment. The legacy Next.js project and its Cloudflare
resources have been retired.

## Documentation

- [Astro deployment and backup runbook](docs/ASTRO-DEPLOYMENT.md)
- [External integration setup](docs/EXTERNAL_SETUP.md)
- [Launch runbook](docs/LAUNCH-RUNBOOK.md)
- [Admin guide](docs/ADMIN_GUIDE.md)
- [Admin diagnosis](docs/ADMIN_DIAGNOSIS.md)
- [Blueprint v2](docs/CUET_MOCK_TEST_BLUEPRINT_v2.md)
- [Blueprint compliance](docs/BLUEPRINT-V2-COMPLIANCE.md)
- [Audit](docs/AUDIT.md)
- [Design audit](docs/DESIGN_AUDIT.md)
- [Share feature](docs/SHARE_FEATURE.md)
- [Progress log](docs/PROGRESS.md)
- [Dataset import report (2026-11-06)](docs/DATASET_IMPORT_2026-11-06.md)
- [Project report prompt](docs/PROJECT_REPORT_PROMPT.md)
