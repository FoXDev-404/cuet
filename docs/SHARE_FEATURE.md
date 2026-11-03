# Question sharing

Last updated: 2026-11-02. Phases 1–6 are implemented and deployed on the
production Worker `https://cuet-astro.cuet-platform.workers.dev`, together with
the production content and accessibility fixes described below. This document is
the feature reference; the full accessibility and performance evidence is
recorded in `docs/PROGRESS.md`.

## What a shared question is

A shared question is a public, server-rendered page at:

```
/q/{slug}-{public_id}
```

The slug is a short ASCII/transliterated excerpt of the question text. The
`public_id` is the only stable public identifier: 10 crypto-random base62
characters, unique across the site. `questions.id` is never placed in a URL,
JSON payload or social image.

The public id belongs to a lineage, not a revision. Revising a question keeps
the id and moves `question_public_ids.current_question_id` to the new head. The
page resolves the newest **published** revision in the lineage, so a draft
revision does not change the public page until it is published.

Rules enforced by `src/pages/q/[slug].astro` and
`src/lib/share/public-question-store.ts`:

- A wrong or stale slug returns a **301** to the canonical slug.
- An unknown, disabled or unpublished id returns the **same 404 body** as any
  other missing question.
- The route is server-rendered. It never exposes a DB id, correct option or
  explanation to an ineligible viewer.

The page supports the usual public routes:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/q/{slug}-{public_id}` | Public page |
| GET | `/api/public-questions/{publicId}` | Question/options; never the answer |
| POST | `/api/public-questions/{publicId}/check` | Server-side answer check |
| POST | `/api/share-events` | Aggregate share analytics |

## Production rollout

The feature was rolled out to the production Worker on 2026-11-02. To avoid
third-party rights exposure, the launch content was written as original,
platform-authored material, so `rights_ok=1` is defensible without a separate
clearance:

- **Ranked mini mock** — a 5-question English grammar mini mock (10 minutes,
  25 marks). Every ranked question has a public id and uses
  `attempted_only`. The `/q/...` pages are live but `noindex, follow`; a guest
  check returns `403` with the “Attempt this mock” CTA, and the answer key
  unlocks only for a signed-in user with a submitted attempt containing the
  question.
- **Standalone indexable question** —
  `/q/choose-the-correct-passive-voice-form-R1hmOFWkeA` uses
  `reveal_policy='public'`, `seo_indexable=1`, `rights_ok=1` and an original
  explanation. It is the only `/q/` entry in `sitemap.xml`, renders
  `index, follow`, and has a generated 1200×630 per-question OG image at
  `/og/questions/R1hmOFWkeA.png`.

Live verification on the production Worker:

- Signed-in attempt unlock: before submitting, `canCheck` was `false`; after
  submitting an attempt for the ranked mock, `canCheck` became `true` and the
  check endpoint returned the correct option with the explanation.
- Ranked page HTML never contains the correct option key or the explanation for
  an ineligible viewer, and carries `noindex, follow`.
- Unknown public ids return the same 404 as an unpublished question; the
  standalone OG image is served as `image/png`; the sitemap contains the
  standalone URL and no ranked URL.
- Google OAuth initiation returns a `303` to `accounts.google.com` and
  `/login` shows “Continue with Google”. The owner completed consent as
  `rajpal010304@gmail.com`; the resulting session loaded `/dashboard` and
  `/admin` with 200 responses and every checked admin API returned 200. The
  user row already had a Google identity linked and the matching super-admin row
  was active. Authenticated admin and axe coverage was also performed with a
  temporary QA super admin that was deactivated (and whose user row was
  soft-deleted) after verification.

The current runtime deployment is
`60f28021-ae55-4815-87cf-2adada96e631`. It also ships the review-queue edit
actions described in `docs/ADMIN_GUIDE.md`; those actions reuse the Data manager
and do not change the public sharing rules.

## Reveal policy

`question_public_ids.reveal_policy` has two values:

| Policy | Who may see the answer and explanation |
| --- | --- |
| `attempted_only` (default) | A signed-in user with a **submitted** attempt containing the question, or any revision in its lineage. |
| `public` | Everyone, **unless** the question is currently in a published ranked mock. |

In-progress attempts, guests and unrelated signed-in users never qualify for
`attempted_only`. The check endpoint returns `403` with a CTA instead of a key.
The public page does not put the answer/explanation into its HTML or JSON for a
non-eligible viewer; the browser asks the server when the viewer selects
“Check answer”.

## Sharing flags

Each lineage has one row in `question_public_ids`:

| Column | Meaning |
| --- | --- |
| `share_enabled` | Public sharing is on. `0` makes the page 404. |
| `reveal_policy` | `attempted_only` or `public` (above). |
| `seo_indexable` | Request search indexing. Only effective when every other condition holds. |
| `rights_ok` | Rights to share/reproduce the question are confirmed. |

Defaults and guard rails:

- Original questions default to sharing enabled.
- PYQ-sourced questions default to `share_enabled=0` until an editor confirms
  `rights_ok=1`. Revoking `rights_ok` makes an already-shared PYQ page 404.
- A shared page is indexable only when **all** of these are true:
  - the mapping is `share_enabled=1`;
  - `seo_indexable=1`;
  - `reveal_policy='public'`;
  - `rights_ok=1`;
  - a published revision exists and is not soft-deleted;
  - the published revision has a non-empty explanation;
  - no revision in the lineage is in a currently published, non-deleted ranked
    mock.
- A question with no published revision, no explanation, revoked rights or
  membership in a currently published ranked mock cannot be indexed. Membership
  in a draft or archived mock does not count as published membership. The page
  re-checks these conditions on every request; an admin flag alone is not
  enough.
- Shared pages default to `noindex, follow`. Only a page passing the full rule
  gets `index, follow`.

All share-flag changes require the `questions.publish` permission, are rejected
for contributors and are written to the audit log. Bulk updates are capped at
100 questions and report each skipped row.

## Share surfaces

### Public question page

- Server-rendered question, options, optional Hindi toggle, related mocks and a
  “not affiliated with NTA” disclaimer.
- “Check answer” for eligible viewers; otherwise a CTA to the full mock.
- A share button that opens the same accessible share sheet.
- A plain “Copy link” control that works without the native share API.

### Solutions page

After an attempt is submitted, each shareable question gets a “Share question”
button with `context="solutions"`. The canonical `/q/...` URL is used; the
answer toggle is off by default. A frozen mock version still resolves to the
current lineage head through a forward `supersedes_id` walk.

### Live ranked attempt

A “Share mock” button appears only when
`site_settings.share_question_during_attempt` is `true` (default `false`). It
opens a **link-only** sheet for `/mock/{slug}/instructions`:

- no question text, options, images, answer or explanation;
- no image generation;
- opening/closing it does not pause the timer or autosave.

### Practice library

Practice-library sharing remains **intentionally unavailable**. The 5,322
`practice_questions` have no public ids or lineage, and every practice paper is
PYQ-sourced OCR content, so there is no rights basis to reproduce a question on
a public URL. Enabling sharing therefore requires two decisions that have not
been made: confirmed rights for the printed PYQ content, and a public-id plus
lineage mapping for the practice tables.

The take and review views expose no share button, no share sheet and no `/q/`
links. A Playwright regression asserts that both the paper page and the take
view stay free of sharing UI, so an accidental copy-paste of the ranked share
component cannot enable practice sharing. The share-event schema already accepts
`context='practice'` so analytics can be added later without a migration.

## Share sheet and image

`src/components/ShareSheet.astro` is an accessible modal:

- `role="dialog"`, labelled by its title, focus trap, Esc to close, focus
  returned to the trigger;
- 44 px minimum targets, light and dark themes;
- actions: native share (when supported), WhatsApp, Telegram, copy link,
  download image;
- the “Include answer and explanation” toggle appears only for an eligible
  viewer and is off by default;
- preview image generation is lazily imported (`html-to-image`, a separate
  ~12.8 KB chunk) on first open, so it is not part of the initial page cost.

The exported PNG is always light regardless of site theme:

- 1080 px wide, height auto between 1080 and 1920 px;
- header with the CUET brand mark and `CUET UG · {Subject} · Q{n}`;
- question text with KaTeX, Hindi/English fonts and optional question image;
- options A–D as rounded rows;
- footer with `cuetfreemocktest.com/q/{public_id}` and “Free CUET mock tests”;
- long questions scale down to a 28 px floor, then truncate with “Read the full
  question at the link”; the link is always visible;
- no answer unless the viewer is eligible and explicitly toggles it on;
- no user name, email, score, attempt id or other user data.

Rendering happens entirely in the browser (zero server CPU). If rendering
fails, the sheet shows a clear error and keeps WhatsApp, Telegram and copy
available.

## Share events and privacy

`POST /api/share-events` accepts:

```json
{ "publicId": "Ab3dE5fG7h", "context": "public_page", "channel": "copy" }
```

- `context`: `attempt`, `solutions`, `practice` or `public_page`;
- `channel`: `native`, `whatsapp`, `telegram`, `copy` or `download`;
- the `attempt` context requires `mockId` and rejects `publicId`; every other
  context requires `publicId`;
- same-origin, validated ids and rate-limited (60/minute per signed-in user or
  IP).

Stored fields are only the public id or mock id, optional signed-in user id,
context, channel and timestamp. No IP, attempt id, email, score, answer or
recipient is stored. The Privacy Policy documents this under “Share data”.

## SEO and Open Graph

- `sitemap.xml` includes a `/q/...` URL only when the page currently passes the
  full `seoEligible` rule. The sitemap uses the same resolver as the page, not a
  second copy of the policy.
- Eligible entries get the published revision's `lastmod`,
  `changefreq="monthly"` and `priority="0.5"`.
- The sitemap's sharing lookup is isolated: a D1 failure there cannot remove
  the mock, subject, PYQ, practice or blog sections.
- Indexable pages emit a unique title and description, a canonical built from
  the pathname (so `?ref=share` is stripped), `BreadcrumbList` JSON-LD and a
  per-question `og:image`.
- Non-indexable pages keep the branded generic `/logo.png` preview.
- `twitter:card` is `summary_large_image` on all pages via `BaseLayout`.

### Generating the per-question OG images

Images are generated **offline**, never in the Worker:

```bash
# after changing flags / publishing an indexable question
npm run og:questions:remote

# local equivalents
npm run og:questions:local
npm run og:questions -- --local --id=Ab3dE5fG7h
npm run og:questions -- --sample   # design preview, no D1
```

The script follows the same lineage/published-mock/explanation rules as the
page and writes `public/og/questions/{publicId}.png`. Run it before
`npm run deploy`; the generated files are static assets and the Worker only
serves them. Images are 1200×630, light, and contain no answer, explanation or
user data. Ineligible questions keep the generic preview.

## Data model

Migration `0012_question_share.sql` adds:

- `question_public_ids` — one row per lineage head, with the flags above;
- `share_events` — append-only share event log;
- `trg_question_public_id_move` — moves the pointer atomically when a revision
  with `supersedes_id` is inserted.

Migration `0013_question_share_indexes.sql` adds `idx_mq_question` on
`mock_questions(question_id)`, which the published-mock membership check uses
for every lineage revision. The public id backfill is idempotent:
`node scripts/backfill-question-public-ids.mjs --local|--remote`.

## Performance notes

Measured with temporary D1 instrumentation on a local fixture (single-revision
question, no Hindi, no image) and then reverted:

| Request | D1 rows read |
| --- | --- |
| Guest answer check (mapping + lineage + mock membership) | **11** |
| Signed-in eligible check (adds session/admin/session lookups and the submitted-attempt `EXISTS`) | **17** total; **13** for the share logic (mapping 1, lineage 5, membership 5, submitted attempt 2) |

The auth session/admin lookups (4 rows) happen for any signed-in request and
are not specific to sharing. The share logic uses indexed lookups
(`question_public_ids.public_id`, `idx_mq_question`, the attempt/answer
indexes); it does not scan the question or mock catalogue. Image generation
uses zero server CPU; the share library is loaded on first open only.

## Verification

- Unit/integration: **229/229** Vitest tests.
- E2E: **67 passed, 1 opted-in slow-network test skipped** (68 total), including
  the public page/share-sheet axe spec and the new practice no-share regression.
  The slow-network spec was run separately against a temporary local published
  mock and passed.
- Production smoke: **38/38** checks on the final deployment, covering OAuth
  initiation, the shared page/API/OG/sitemap, a share event, the ranked guest
  `403`, and the authenticated admin contracts.
- Accessibility: Playwright axe scans of the public question page and the open
  share sheet in light and dark themes, plus the existing focus-trap/Esc test.
  The standalone `npm run test:a11y` script completed **256 scans against the
  deployed production Worker** — public pages, the shared question page, local
  practice, mock pages, and every authenticated dashboard/admin page, in light
  and dark at desktop and 390×844 — with **0 WCAG A/AA violations and 0
  horizontal overflow**. The production audit found 10 overflow/contrast
  issues on its first pass, then four more on the second (a keyboard-inaccessible
  admin scroller and the share panel's wide select); the share-sheet spec also
  caught a preview-text contrast failure. All were fixed and re-verified. The
  audit was initially run with a temporary QA super admin that has since been
  deactivated, then repeated through the owner's Google session using
  `A11Y_STORAGE_STATE`; both runs were clean.
- Live sharing: the ranked question reported `canCheck:false` before an attempt
  and `canCheck:true` after submitting one; the check returned the correct
  option and explanation; a guest check returned `403`; ranked HTML exposed no
  correct-option field or explanation and carried `noindex, follow`.
- SEO: the Phase 5 spec checks sitemap inclusion/exclusion for `seo_indexable`,
  `attempted_only` and published-mock cases; `index, follow`; canonical without
  `?ref`; BreadcrumbList JSON-LD; the per-question OG image and the generic
  fallback. Production has one indexable `/q/` entry in `sitemap.xml`, served
  with a canonical URL and a live `image/png` OG image.
- Regression: the full attempt-flow, scoring, admin, security and local-practice
  suites remain green.

## Operation checklist when making a question shareable/indexable

1. Confirm the rights decision; set `rights_ok=1` for PYQ content.
2. Publish the revision and make sure it has an explanation.
3. Set `share_enabled=1`, `reveal_policy='public'` and `seo_indexable=1` only
   when the full rule is intended.
4. Run `npm run og:questions:remote` to create the per-question image.
5. Deploy, then check `/q/{slug}-{public_id}` robots/canonical and
   `/sitemap.xml`.
6. Re-check that the question is not in a currently published ranked mock; if
   it is, the page correctly drops back to `noindex`.

## Known limitations

- Practice-library sharing remains off by decision for rights and public-id
  reasons. The 5,322 practice questions have no lineage, and the papers are
  PYQ-sourced.
- The OG generator is an explicit deploy step and does not prune images for
  questions that later become ineligible; unreferenced files are harmless.
- Axe cannot audit the exported PNG (canvas output) or the native OS share
  sheet.
