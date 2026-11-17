# CUET Free Mock Test — Audit and Improvement Log

- **Audit date:** 2026-11-17
- **Baseline commit:** `716d246` (`Refine PYQ archive ordering, routing, and SEO safeguards`)
- **Production:** <https://cuetfreemocktest.com>
- **Worker:** `cuet-astro`, baseline deployment `2026-11-17T07:42:43Z` (`716d246`). Released from this audit on `2026-11-17T21:10:40Z` at commit `c604ce3`, version `1f6b53d2-fdf8-4896-992f-2921524386e1`.
- **Scope:** UI/UX, frontend, backend, security, SEO, performance, accessibility and AdSense readiness. Incremental fixes only; no rewrite.

> `docs/AUDIT.md` is the historical Phase A audit dated 2026-10-31 and is preserved unchanged. This file is the current Phase 0 audit and the running log for this improvement cycle.

---

## 0. Method and evidence

Reviewed the repository (179 route modules, middleware, auth, database layer, SEO helpers, integrations), `docs/WEBSITE_SITEMAP.md`, the deployment/security docs, and live production responses. Ran the project's own gates, then a mobile Lighthouse baseline against the production build, a 272-scan axe audit, a responsive pass at five widths, a metadata audit across 30 routes, and a link crawl.

**Runtime baseline:** Astro production build served by `wrangler dev` on `http://localhost:4321` with `USE_LOCAL_D1=1`, because the production database is Turso. Lighthouse mobile, simulated throttling, light theme, median of 3 runs per page. The attempt page was measured twice: once with the production value of `share_question_during_attempt` (`false`) and once with the local share-enabled value (`true`) as a worst case.

**Known limits:**

- Google Search Console, Bing Webmaster Tools and authenticated production admin/dashboard checks were unavailable.
- Production data lives in Turso; local checks use the local D1 binding. Counts and query costs can differ.
- Local Lighthouse excludes production GA4, Cloudflare Analytics, AdSense and edge-cache effects. It is a code/layout baseline, not a field-data measurement.
- No physical iOS/Android device pass was possible.
- Free-tier quotas can change; no paid service is introduced by this audit.

---

## 1. Stack reality

The requested stack was Cloudflare Pages/Functions, D1, KV and Firebase Auth (Google-only). The repository is already a working implementation on a different but compatible free-tier stack. **The code is the source of truth; this audit does not rewrite it.**

| Concern | Requested | Actual | Decision |
| --- | --- | --- | --- |
| Hosting | Cloudflare Pages + Functions | Cloudflare Workers + static assets via `@astrojs/cloudflare`; Astro 7 SSR (`output: "server"`) | Keep. Document the deviation. |
| Database | D1 | Local D1; **production uses Turso/libSQL over HTTP** (`/api/health` returns `"engine":"turso"`; `TURSO_*` secrets are set). The production D1 binding `DB` is currently unused. | Keep Turso for now; make it the single documented target (P1-9). Do not remove D1 or Turso secrets without a data migration plan. |
| KV | KV | `SESSION` and `MEDIA_KV` namespaces; staging/production separated | Matches. |
| Auth | Firebase Auth, Google-only | Custom Google OAuth + server sessions (`__Host-cuet_session`), guest attempts (`__Host-cuet_guest`); Google sign-in is the production path | Keep. Firebase would be a rewrite with no user-visible benefit. |
| Email | Not specified | Resend/Brevo adapters exist; production email is unconfigured and password reset is disabled | Keep disabled until a provider is chosen. |
| Ads | AdSense | Env-gated AdSense; `ADSENSE_CLIENT` and `ADSENSE_SLOT_ID` are empty in production, so ads are dormant and `/ads.txt` is 404 | Keep dormant until consent, policy and route-safety fixes ship. P1-4 adds a third `ADSENSE_CMP_ACTIVE` gate; a certified CMP is still required. |
| Analytics | Not specified | GA4 `G-Y1JPT7SNQJ` and Cloudflare Web Analytics are live; no GTM, no AdSense, no Funding Choices | P1-4 adds an opt-in gate and policy disclosure in code; production rollout is still pending deployment. Cloudflare analytics stays unconditional and cookieless. |
| Deploy | — | `npm run deploy` builds with the production env and runs `wrangler deploy`; production deployment matches HEAD | Keep. |

Core versions: Astro `7.4.12`, Tailwind `4.3.3`, React `19.3.0` (islands), TypeScript `5.9.3`, Vitest `5.0.5`, Playwright `1.64.1`, Wrangler `4.156.0`.

---

## 2. Routes, redirects and indexability

Route inventory:

| Area | Count / examples |
| --- | --- |
| Route modules | **179** total: 91 `.astro`, 88 `.ts` |
| API endpoints | **82** under `src/pages/api` |
| Admin pages | **33** under `src/pages/admin` |
| Public catalogue | `/`, `/mock-tests`, `/mock/[slug]`, `/mock/[slug]/instructions`, `/mock/[slug]/discussion` |
| PYQ archive | `/cuet-ug-previous-year-question-papers`, `/cuet-ug-previous-year-question-papers/[category]/[subject]`, `/pyq/[year]`, `/pyq/[year]/[subject]` |
| Exam flow | `/attempt/[id]`, `/result/[attemptId]`, `/result/[attemptId]/solutions`, `/dashboard` |
| Auth | `/login`, `/signup` (redirect), `/forgot-password` (redirect), `/reset-password/*`, `/verify-email` |
| Content/SEO | `/blog`, `/blog/[slug]`, `/leaderboard`, `/leaderboard/[slug]`, `/q/[slug]`, `/u/[username]`, `/cuet-ug-syllabus/*`, `/cuet-ug-exam-pattern`, `/cuet-ug-marking-scheme`, `/cuet-ug-important-dates` |
| Legal/support | `/about`, `/contact`, `/privacy-policy`, `/terms`, `/disclaimer`, `/search`, `/404`, `/500`, `/forbidden`, `/maintenance` |
| Ops | `/api/health`, `/sitemap.xml`, `/robots.txt`, `/ads.txt`, `/manifest.webmanifest`, `/sw.js` |

Sitemap and indexability:

- Local sitemap: **234 URLs**; production sitemap: **235 URLs**. `npm run seo:check` audited **238 URLs**, with **0 canonical/`og:url` mismatches**.
- The one-URL local/production delta appears to be a content delta; re-check after the next production deploy.
- Private routes are `noindex`: `/attempt`, `/result`, `/dashboard`, `/login`, `/admin`, `/search`, `/u`, `/api`. This is intentional and should not be "fixed" to chase Lighthouse SEO 100.
- `/mock/[slug]` and `/mock/[slug]/instructions` are `noindex, follow` wrappers with canonicals to the canonical paper. `/mock/[slug]/discussion` is `noindex, nofollow`.
- Filtered/paginated `/mock-tests` variants are `noindex, nofollow`.

Redirects are implemented in `src/middleware.ts` (there is no `public/_redirects`). Locally verified 301s:

| Legacy / alternate URL | Target |
| --- | --- |
| `/practice`, `/practice/*` | `/mock-tests`, `/mock-tests/*` |
| `/mock-test`, `/mock-test/*` | `/mock-tests`, `/mock-tests/*` |
| `/mock-tests/<paper-slug>` | Canonical PYQ paper path |
| `/mock-tests/<paper-slug>/take` | Canonical mock instructions/start path |
| `/pyq` | Canonical PYQ archive |
| `/cuet-ug-previous-year-papers` | Canonical PYQ archive |
| `/cuet-mock-test`, `/cuet-ug-mock-test` | Mock-test hub |
| Wrong-category PYQ URLs | Correct category/subject canonical path |
| `/signup` | `/login?next=%2Fdashboard` (Google-only flow) |
| `/forgot-password` | `/login` (email reset disabled) |

**Parity gap:** trailing-slash and canonical-host redirects are skipped when the host is `localhost` (`src/middleware.ts:144-169`). Local dev therefore does not match production canonicalisation. Documented as P1-10.

**URL policy for this cycle:** no existing public URL is renamed. Any future canonical change must add a 301 in middleware, update the sitemap, and add a redirect test.

---

## 3. Baseline quality gates

| Check | Result | Notes |
| --- | --- | --- |
| `npm test` | **PASS** — 62 files, **542 tests** | Unit + integration + API contract coverage |
| `npm run build` | **PASS** — 0 errors, 0 warnings, 12 hints | `astro check` + production build |
| `npm audit` | **1 moderate** | Astro `<=7.4.6` XSS advisory `GHSA-mh32-jxcr-mh9f`; `npm audit fix` reports a fix |
| `npm run perf:check` | **PASS** | JS **182.1 KB** gzip (budget 200), CSS **37.6 KB** gzip (budget 100) |
| `npm run seo:check` | **PASS** | 234 local sitemap URLs, 238 audited, **0 mismatches** |
| `npm run lint:copy` | **PASS** | 309 files, 0 violations |
| `npm run check:env` | **PASS** | Staging/production D1 and KV separation verified. It does **not** validate Turso. |
| `scripts/check-links.mjs` | **PASS after P1-3** | 0/363 internal broken; the only external break (`exams.nta.ac.in/CUET-UG/` -> 404) is fixed by migration 0028; local crawl after the fix: 0/362 internal, 0/39 external |
| `npm run test:a11y` | **PASS** | 272/272 scans, 0 WCAG A/AA violations, 0 horizontal overflow |
| Responsive pass | **PASS** | 360/414/768/1024/1440 on `/`, `/mock-tests`, instructions, `/blog`, `/leaderboard`, PYQ archive and a live attempt: 0 overflow, exactly one H1 per page |

The refreshed `docs/report/a11y-results.json` records the 272/272 pass at commit `716d246` with `/attempt/533` as the attempt fixture.

P1-11 (Phase 4) upgraded Astro **7.4.4 -> 7.4.12**, which clears both `GHSA-mh32-jxcr-mh9f` and `GHSA-r3h5-4585-7x3w`; `npm audit` now reports **0 vulnerabilities**. The Phase 4 a11y re-run after the upgrade passed **272/272** scans at `2c30f3c`. The counters in the table above are the original baseline.

---

## 4. Lighthouse baseline (mobile, light, 3-run median)

| Route | Perf | A11y | BP | SEO | LCP | TBT | CLS | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 100 | 100 | 100 | 100 | 939 ms | 0 ms | 0 | 57.2 KB |
| `/mock-tests` | 100 | 100 | 100 | 92 | 921 ms | 0 ms | 0 | 58.8 KB |
| `/attempt/535` — production-like, share **off** | 100 | 100 | 100 | 58 | 1684 ms | 0 ms | 0 | 100.7 KB |
| `/result/527` — private | 100 | 100 | 100 | 69 | 930 ms | 0 ms | 0 | 61.3 KB |

Worst-case configuration, **not** the production default:

| Route | Perf | A11y | BP | SEO | LCP | TBT | CLS | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/attempt/528` — `share_question_during_attempt=true` | 93 | 100 | 100 | 58 | 1734 ms | 276 ms | 0 | **470.0 KB** |

Notes:

- The attempt page was re-baselined after confirming that production has `share_question_during_attempt=false`. The 470 KB / 93 performance run was caused by the local setting only; the production-like configuration transfers **100.7 KB** and scores **100**. Actual production also loads GA4 and Cloudflare Analytics and was not measured in this local run.
- One of the three production-like attempt runs scored 97 with CLS `0.093`; the median is 100 / 0. The variance is tracked as P2-10.
- `/mock-tests` SEO 92 has a single cause: 24 links whose visible/accessible text is only "Start". Lighthouse `link-text` lists them (for example `/mock/mathematics-2026-05-20-shift-1/instructions`). Fix with an accessible name that still contains the visible word "Start" (P1-1).
- `/attempt` SEO 58 is `is-crawlable` (intentional noindex) plus a missing meta description. `/result` SEO 69 is the intentional noindex. Adding metadata would not make private pages indexable; the correct target is "no accidental indexability", not SEO 100.
- The per-route budgets in `performance-budget.json` are now **enforced** by `scripts/lighthouse-audit.mjs`; the Phase 3 re-measure below is the first run that fails the process on a breach.

**Phase 3 P1-8 re-measure (2026-11-17, Lighthouse 13.6.0).** Same mobile simulated-4G method, three runs, light theme, production build, local D1.

| Route | Perf | A11y | BP | SEO | LCP | TBT | CLS | Transfer | Budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/` | 100 | 100 | 100 | 100 | 930 ms | 0 ms | 0 | 57.2 KB | PASS |
| `/mock-tests` | 100 | 100 | 100 | 100 | 920 ms | 0 ms | 0 | 58.9 KB | PASS |
| `/cuet-mock-test/english` | 100 | 100 | 100 | 100 | 930 ms | 0 ms | 0 | 55.2 KB | PASS |
| `/mock/[slug]` | 100 | 100 | 100 | 69 | 930 ms | 0 ms | 0 | 61.1 KB | PASS |
| `/mock/[slug]/instructions` | 100 | 100 | 100 | 69 | 930 ms | 0 ms | 0 | 52.0 KB | PASS |
| `/attempt/[id]` | 100 | 100 | 100 | 58 | 1240 ms | 0 ms | 0 | 68.7 KB | PASS |
| `/result/[id]` | 100 | 100 | 100 | 69 | 930 ms | 0 ms | 0 | 61.6 KB | PASS |
| `/q/[id]` | 100 | 100 | 100 | 100 | 930 ms | 0 ms | 0 | 70.6 KB | PASS |
| `/admin` | 100 | 100 | 100 | 63 | 1090 ms | 0 ms | 0 | 44.9 KB | PASS |

Notes:

- All nine routes pass their route transfer/score budget and the global LCP, TBT, CLS, FCP, Speed Index and total-DOM caps. Every route scored 100 except one subject-hub run at 99; the three-run median is 100.
- The attempt page fell from **100.7 KB** (share off) and **470 KB** (share on) to **68.7 KB** because the share-card fonts are no longer fetched during page idle. They are prerendered only after `pointerover`/`focusin` on the Share control, so the 361 KB payload is now an explicit user action rather than an initial cost.
- The admin dashboard went from **CLS 0.328** to **CLS 0** after `data-admin-js` is set in the head, which keeps the mobile sidebar out of normal flow before hydration. LCP is 1.09 s.
- SEO 58-69 on `/attempt`, `/result`, `/admin`, `/mock/...` and `/mock/.../instructions` remains intentional `noindex`; the target is no accidental indexability, not a perfect SEO score.
- The local database exposed only the E2E sitemap fixture as an indexable shared question at the time of this run. P1-13 subsequently excludes fixture text from `seoEligible`, so fixture `/q/` URLs can no longer enter the sitemap. A post-P1-13 verification run (3 runs, same method) passed **9/9**; it audited a temporary non-fixture question seeded into local D1 and removed afterwards. The committed evidence above was intentionally left unchanged because P1-13 changes sitemap membership and robots metadata, not route performance. See §17 Phase 4.

---

## 5. Broken links and link quality

- **Internal:** 0/363 broken.
- **External:** 1/51 broken at baseline — `https://exams.nta.ac.in/CUET-UG/` returned 404. It was used six times in `migrations/0020_exam_info_seed.sql` as `exam_info.source_url`.
- Verified replacement: `https://cuet.nta.nic.in/` returns 200 and is the official CUET (UG) landing page (title contains "CUET (UG)", 94 KB). `https://nta.ac.in/` also returns 200.
- **Resolved in Phase 1 (SEO-4):** `0020_exam_info_seed.sql` now uses `https://cuet.nta.nic.in/` and migration `0028_fix_cuet_source_url.sql` updates existing databases. The exam-info pages already used this URL as their fallback. A local crawl after applying the migration reported **0/362 internal and 0/39 external broken**. Production needs `npm run db:turso:migrate` before its crawl is clean.
- Orphans: **resolved in Phase 4 (P2-11).** Leaderboard and discussion usernames link public profiles. Profiles remain `noindex, follow` and are deliberately kept out of the sitemap, so the route is a human-facing surface rather than an SEO page.

---

## 6. SEO findings

Strengths: every audited public page has exactly one H1, a canonical, an OG title/image and JSON-LD (except the intentionally private attempt page); hreflang is correctly absent for a single-locale site; canonical host, HTTPS and slash redirects work in production; the sitemap only emits gated, non-empty routes.

| ID | Severity | Finding | Evidence / fix |
| --- | --- | --- | --- |
| SEO-1 | P1 | `/mock-tests` has 24 non-descriptive "Start" links; SEO 92 | Lighthouse `link-text`. Add `aria-label`/visually hidden paper name, e.g. "Start English 6 August 2022 Shift 1 mock test". Keep the visible word "Start" for WCAG 2.5.3. |
| SEO-2 | P1 | Blog OG images are SVG, which major social platforms do not render | `src/lib/guides.ts:164-165` returns `/og/blog/<slug>.svg`. Generate PNG/JPEG with the existing `@resvg/resvg-js` dependency, or use a PNG fallback; validate with X/Facebook debuggers. |
| SEO-3 | P1 | Twitter card tags use `property=` instead of the standard `name=` | `src/layouts/BaseLayout.astro:230-232`. Change to `name="twitter:card"`, `name="twitter:image"`, `name="twitter:image:alt"`. |
| SEO-4 | P1 | `https://exams.nta.ac.in/CUET-UG/` is a 404 source link | Fixed in Phase 1 (P1-3): seed updated to `https://cuet.nta.nic.in/` and migration `0028_fix_cuet_source_url.sql` updates existing rows. |
| SEO-5 | P2 | `/leaderboard` title is 61 characters; `/mock/...` wrapper is 61, `/instructions` 72, `/discussion` 90, `/result/527` 88 | Only `/leaderboard` is indexable; shorten it to <=60. The others are noindex/private and are low priority. |
| SEO-6 | P2 | Blog index and posts carry only `Organization` (plus `BreadcrumbList`/`Article` on posts); no `FAQPage`, `Quiz` or `LearningResource` | **Resolved in Phase 4 (P2-5):** this is the intended shape. Blog posts emit `Article` + `BreadcrumbList`; `FAQPage`, `Quiz`, `Course` and now `LearningResource` stay disallowed because the visible content does not support them. Guarded by `tests/unit/structured-data.test.ts`. |
| SEO-7 | P2 | Local sitemap includes 2 E2E fixture shared-question URLs | `listSeoIndexableQuestions()` in `src/lib/share/public-question-store.ts` lacks the fixture guard used for mocks in `src/pages/sitemap.xml.ts`. Add a fixture-slug filter. |
| SEO-8 | P2 | Public `/u/[username]` profiles are orphaned and noindex | Resolved in Phase 4 (P2-11): leaderboard and discussion usernames link public profiles; profiles stay `noindex, follow` and out of the sitemap. |
| SEO-9 | Info | Attempt/result pages are intentionally metadata-light | Do not add canonical/OG/JSON-LD to private pages. A meta description would not lift the Lighthouse cap because `is-crawlable` is already 0. |

Metadata audit details: `/signup` 301s to `/login?next=%2Fdashboard`; `/forgot-password` 301s to `/login`; both are intentional for a Google-only flow. Every other audited route has a canonical and OG image. The default OG image `https://cuetfreemocktest.com/logo.png` is live (200, `image/png`, 31,587 bytes), so the non-blog social preview path is healthy.

**Resolved in Phase 1 (SEO-1):** the 24 mock start links keep the visible label "Start" and now include the paper title as in-flow `sr-only` text, so the link inner text is "Start CUET UG … Previous Year Paper". Three mobile Lighthouse runs of `/mock-tests` after the change scored **SEO 100, performance 100, accessibility 100, best practices 100** (LCP median 936 ms, transfer unchanged at 58.8 KB). An E2E assertion covers the row's descriptive text.

**Resolved in Phase 1 (SEO-2, SEO-3):** repository guides now have pre-generated 1200×630 PNG share images (34 PNGs, 1,534 KB total) written to `public/og/blog/` by `npm run og:guides`, following the existing paper/question OG workflow. `guideOgImagePath()` returns the PNG for repository guides and `/logo.png` for database posts, while `guideImagePath()` keeps the SVG thumbnail for DB posts (the endpoint is unchanged and still returns SVG). Twitter card tags now use the standard `name=` attribute. A pre-rendered PNG route was attempted first but the Cloudflare adapter cannot bundle `@resvg/resvg-js`'s native binary, so generation happens outside the build and the images are committed.

**Resolved in Phase 1 (SEO-4):** all six `exam_info.source_url` rows now point at `https://cuet.nta.nic.in/`. The local link crawl after applying migration 0028 reported 0 broken internal and external links; `exam-facts.test.ts` now asserts the exact URL and applies the migration in its in-memory schema.

---

## 7. Accessibility and UX

The axe audit is clean: **272/272 scans passed, 0 WCAG A/AA violations, 0 horizontal overflow**, across public pages, the attempt palette, dark/light themes and desktop/mobile widths. The responsive pass at 360/414/768/1024/1440 also found exactly one H1 per page.

Remaining nits:

| ID | Severity | Finding | Fix |
| --- | --- | --- | --- |
| UX-1 | P2 | Leaderboard links are 20 px high, below the 24 px WCAG 2.5.8 target-size minimum (inline text links are exempt) | Add vertical padding or make the whole row a link. |
| UX-2 | P2 | Attempt help text says "Answers autosave every 10 seconds", but the interval is 15 seconds (`src/pages/attempt/[id].astro:2023`) | Change the copy to 15 seconds, or the interval to 10 seconds. Prefer matching the copy to the real interval. |
| UX-3 | P2 | Submit uses a native `confirm()` dialog | Native confirm is accessible but visually inconsistent. Consider a modal dialog with focus trapping; not urgent. |
| UX-4 | Info | Empty states exist for mock filters and dashboard; filters work without JS; result page has a retake CTA; skip link, focus-visible styles and reduced-motion support are present | No action. |

---

## 8. Performance

- Home, mock list, subject hub, mock detail, instructions, result and public question transfer **52-71 KB** and ship **0 KB of client JS**; the server-rendered architecture is working as intended.
- The attempt page is **68.7 KB** at LCP **1.24 s**. It used to transfer 100.7 KB with sharing off and 470 KB with sharing on, because `prerenderAttemptQuestionShare` fetched `share-fonts-base.json` (492,391 bytes raw, **361.3 KB** over the wire) during page idle. P1-8 moved that work behind a Share `pointerover`/`focusin` intent, so the 361 KB is paid only when a user asks for a share card. Share-on no longer violates the 300 KB initial-load budget.
- The admin dashboard is **44.9 KB** with CLS 0. Setting `data-admin-js` in the head keeps the mobile sidebar out of normal flow before hydration; the previous in-flow paint produced CLS 0.328.
- `scripts/check-perf-budget.mjs` still enforces total JS/CSS. `scripts/lighthouse-audit.mjs` now enforces `performance-budget.json` route and global caps on the three-run median and exits non-zero on a breach. It discovers live mocks and questions, seeds guest/admin sessions, sanitizes session headers out of committed reports and records the Lighthouse version.
- Attempt LCP is 1.24 s and the first question image is ~37.7 KB. Preloading/fetch-prioritising the first image remains optional; it is already well inside the 4 s budget.
- The first local health request after startup reported 17,687 rows read, consistent with the practice-library warm-up. It is cached, but cold-start Turso row reads should be monitored for cost.
- DB query profile (local): attempt start 2 queries / 59 rows read / 12 written; attempt page 5-6 queries / 7-152 rows; submit 10 queries / 346 rows read / 199 written. Query counts are well inside the invocation budget; rows are the billing metric to watch.

---

## 9. Security

Present and working:

- Security headers on production: CSP (ad and analytics hosts only when the integration is configured), HSTS (`max-age=31536000; includeSubDomains`), COOP (`same-origin-allow-popups`), CORP (`same-origin`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`; `X-Robots-Tag: noindex, nofollow` on private paths.
- OAuth `state` is validated; admin RBAC is enforced server-side; session tokens are stored hashed; answer keys are not serialized into the attempt page and scoring is server-side.
- Rate limits exist for attempt start, submit, comments and media upload; admin uploads validate bytes and reject SVG; no secrets are committed.
- `SameSite=Lax`, `HttpOnly` session and guest cookies; `__Host-` prefix with `Secure` and `Path=/`; legacy unprefixed names are read and promoted on next use.

Gaps:

| ID | Severity | Finding | Fix |
| --- | --- | --- | --- |
| SEC-1 | P1 | `isSameOrigin()` returned `true` when the `Origin` header was absent (`src/lib/http.ts:15-24`) | Fixed in Phase 1 (P1-6): a request with `Origin` is still host-checked; without `Origin`, only `Sec-Fetch-Site: same-origin` is accepted. Requests with neither header are rejected. `same-site`, `cross-site`, malformed and `Origin: null` are rejected. E2E request contexts now send the suite origin explicitly. |
| SEC-2 | P1 | `/api/attempts/[id]/answers` had no rate limit | Fixed in Phase 1 (P1-7): after the ownership check, the endpoint allows 120 saves per minute per attempt + client IP; excess requests return 429. Keying after the access check prevents another user from exhausting an attempt's bucket. |
| SEC-3 | P1 | Private/auth HTML had no `Cache-Control: no-store`; `/login` returned 200 without it | Fixed in Phase 1 (P1-5): `applySecurityHeaders()` now sets `Cache-Control: no-store` and `Pragma: no-cache` for every `isPrivatePath()` route, which covers attempts, results, dashboards, auth pages, admin and authenticated APIs. The edge cache only stores allowlisted public paths, so it cannot overwrite this. |
| SEC-4 | P2 | Session/guest cookie is `cuet_session` / `cuet_guest`, not `__Host-` | Fixed in Phase 5 (P2-6): new cookies are `__Host-cuet_session` / `__Host-cuet_guest` with `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` and no `Domain`. Both legacy names are still read for one rollout window; a valid legacy token is promoted on its next request and the old cookie is deleted in the same response, so no user is signed out. |
| SEC-5 | P2 | CSP allowed `script-src 'unsafe-inline'` and advertised AdSense/Google ad domains even when ads were unconfigured | **Partially resolved in Phase 4 (P2-7):** ad and analytics hosts are now emitted only when that integration is configured (`src/lib/security-headers.ts`), so the dormant policy no longer advertises them. `'unsafe-inline'` remains for scripts and styles until the nonce/hash migration described in §15. |
| SEC-6 | P2 | No `Cross-Origin-Opener-Policy` or `Cross-Origin-Resource-Policy` | Fixed in Phase 4 (P2-7): every Worker response now carries COOP `same-origin-allow-popups` (OAuth popups keep working) and CORP `same-origin`. |
| SEC-7 | P2 | Production admin auth uses the session fallback (`ADMIN_ALLOW_SESSION_IN_PROD=1`); Cloudflare Access is not configured | Enable Access, or document the accepted risk and rely on the Google account plus the admin allowlist, RBAC and audit log. Do not flip the flag without an Access app. |
| SEC-8 | P2 | `.env.example` is missing (`.dev.vars.example` exists) | Fixed in Phase 4 (P2-9): `.env.example` is a committed, comment-only pointer to `.dev.vars.example`; a unit guard rejects duplicated keys. |
| SEC-9 | P2 | `npm audit` reports 1 moderate Astro XSS advisory | Fixed in Phase 4 (P1-11): Astro upgraded 7.4.4 -> 7.4.12 within the `^7` range, clearing `GHSA-mh32-jxcr-mh9f` and `GHSA-r3h5-4585-7x3w`; `npm audit` reports 0 vulnerabilities. |

Operational security note: the D1 backup workflow exists, but its secrets are missing, so backups are not running. This is an ops P1, not a code defect.

---

## 10. Privacy, analytics and AdSense

**P0 — the active test screen violates the published privacy policy.** When `ADSENSE_CLIENT` and `ADSENSE_SLOT_ID` are both set, `src/pages/attempt/[id].astro` loads the AdSense script at lines 353-361 and renders an `AdSlot` at line 1223. The privacy policy says, twice, that ads are never placed on the active test screen and that the screen never loads the advertising script (`src/pages/privacy-policy.astro:93,169`). The `AdSlot` component's own comment says "Never place this on an attempt, result, dashboard or other private/thin route." Ads are dormant today because both env vars are empty, so this is a latent violation that activates the moment advertising is configured.

Fix (P0-1): remove the AdSense script and `AdSlot` import/usage from the attempt page; add `/attempt` to `BLOCKED_AD_PATHS` in `src/lib/integrations.ts` as a second line of defence; add a unit test for `adSlotAllowed("/attempt/1") === false` and an E2E assertion that the attempt HTML contains no `adsbygoogle.js` even with ad env vars set.

Other privacy findings:

| ID | Severity | Finding | Fix |
| --- | --- | --- | --- |
| ADS-1 | P0 | Ads on the active attempt contradict the privacy policy | See P0-1 above. |
| ADS-2 | P1 | No consent/CMP; GA4 loads unconditionally ~2 s after page load | Add a consent gate for regions that require it before enabling personalised ads or GA4; keep Cloudflare Web Analytics (cookieless) as the fallback. |
| ADS-3 | P1 | Privacy policy names Cloudflare Web Analytics and AdSense but not GA4 | Add GA4 (`G-Y1JPT7SNQJ`), its purpose, retention and opt-out/consent basis; update the "if neither integration is configured" sentence so it does not imply GA4 is absent. |
| ADS-4 | P1 | Enabling AdSense without `/ads.txt`, consent and route blocking would be non-compliant | Treat `ADSENSE_CLIENT`/`ADSENSE_SLOT_ID` as a go-live checklist, not just env vars: ads.txt, CMP, policy, route tests, AdSense review. |
| ADS-5 | P2 | The submitted result page had an end-of-content ad opt-in, although the policy allows ads only on selected public content pages | **Resolved in Phase 4:** decided to serve no result ads. Removed the `ads` opt-in from the result summary and solutions pages, added `/result` to `BLOCKED_AD_PATHS`, and added a source guard. Revisit only as a separate, policy-reviewed change. |
| ADS-6 | Info | `/ads.txt` returns 404 while no publisher is configured | Intentional. Add the live URL and expected record to `docs/EXTERNAL_SETUP.md`; verify after configuration. |

The AdSense loader in `BaseLayout` is correctly double-gated by `shouldServeAds()` and `adSlotAllowed()`. The attempt page bypassed both by rendering its own script. That was the defect.

**Resolved in Phase 1 (P0-1):** the attempt page no longer imports `AdSlot` or the AdSense helpers, emits no ad script and renders no unit. `/attempt` is also in `BLOCKED_AD_PATHS`, so a future `AdSlot` placement on that route still renders nothing. Verified with valid `ADSENSE_*` env vars in a preview: `/attempt/535` returned no `adsbygoogle`, `pagead2.googlesyndication.com` or ad-unit markup, while `/mock-tests` still loaded the script and unit.

**Resolved in Phase 2 (P1-4):** the attempt page and the loader are now protected by the Phase 1 route guards plus a new CMP attestation. GA4 and GTM are opt-in: `ConsentGate.astro` reads the versioned `cuet_consent_v1` localStorage choice, missing or malformed values mean no analytics, and the banner is hidden until the script confirms there is no choice, so a JavaScript-disabled visitor sees no dead control. The unconditional head loaders and GTM's `<noscript>` iframe were removed. The component renders only on public paths, while Cloudflare Web Analytics remains unconditional and cookieless. The privacy policy now names GA4 (`G-Y1JPT7SNQJ`), the `_ga`/`_ga_*` cookies, up to 14 months of event retention, Google's processor role, international processing and the opt-out add-on, and documents withdrawal. ADS-4 is enforced in code: `ADSENSE_CMP_ACTIVE` must be `1` or `true` in addition to `ADSENSE_CLIENT` and `ADSENSE_SLOT_ID`, and both the BaseLayout loader and `AdSlot` check it. Ads stay off for now; a Google-certified CMP is still mandatory before go-live.

---

## 11. Data, environment and deployment

- **Production is Turso, not D1.** `/api/health` returns `{"db":"ok","engine":"turso"}` and `wrangler secret list --name cuet-astro` shows `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. The production `DB` D1 binding in `wrangler.jsonc` is unused. `npm run check:migrations-remote` and `npm run db:migrate:remote` target D1, so they do **not** describe or migrate production; use `db:turso:migrate` / `db:turso:verify` instead.
- Decision for this cycle: keep Turso, document it as the production target, and use `db:turso:migrate` / `db:turso:verify` for production. Do not delete the D1 binding or the Turso secrets until a data migration/rollback plan exists.
- Migrations `0026_rename_pyq_archive_path.sql`, `0027_practice_question_topics.sql` and `0028_fix_cuet_source_url.sql` were applied to production Turso on 2026-11-17. `npm run db:turso:verify` then reported **28 migrations**, `integrity: ok`, `foreignKeys: ok`, 24,761 published questions, 7,527 practice questions, 87 attempts, 8 users and 0 orphan/duplicate checks. Topic **pages** still stay unavailable until an editor supplies the CSV topic backfill; the schema is no longer the blocker.
- `npm run check:env` validates D1/KV staging/production separation only. Extend it (or add a sibling check) to assert the effective production engine and required Turso secrets.
- Local dev uses D1 and skips trailing-slash/canonical-host redirects; production uses Turso and enforces them. Local parity is P1-10.
- Production was released on 2026-11-17T21:10:40Z from `c604ce3` (version `1f6b53d2-fdf8-4896-992f-2921524386e1`), replacing the `716d246` / `f2b02b0b` deployment. `db:turso:verify` passed immediately before the upload (28 migrations, integrity/foreign keys ok, 0 orphan/duplicate checks). The `Deploy production` workflow's D1 migration/import steps are legacy and do not update Turso; a production release must run `db:turso:migrate` / `db:turso:verify` and then `npm run deploy` (see the runbook).
- Free-tier posture: Workers/KV/Cloudflare Analytics/Turso free tiers; no paid add-on is required by the planned fixes. Watch Turso row reads and the practice-library warm-up. Do not run broad remote D1 verification against the free-tier quota.

---

## 12. Prioritised backlog

### P0 — fix before enabling ads or the next production change

- **P0-1 — Remove AdSense from the active attempt.**
  - Remove the AdSense script block, the `AdSlot` usage, and the now-unused `AdSlot` / `adsenseClient` / `adsenseSlot` imports and `showAds` calculation from `src/pages/attempt/[id].astro`.
  - Add `/^\/attempt(?:\/|$)/` to `BLOCKED_AD_PATHS`.
  - Add unit + E2E regression coverage.
  - Acceptance: with valid `ADSENSE_*` env vars, `/attempt/:id` contains no `adsbygoogle.js`, no `adsbygoogle` push and no ad unit; `/privacy-policy` statements remain true.

### P1 — launch, SEO, security and operability

- **P1-1 — Descriptive mock start links.** Fix the 24 "Start" links on `/mock-tests`; target SEO 100 on that route.
- **P1-2 — Social metadata.** Use `name=` for Twitter tags; replace SVG blog OG images with PNG/JPEG; validate with X and Facebook debuggers.
- **P1-3 — Broken NTA source URL.** Add a migration + seed update to `https://cuet.nta.nic.in/` (verify first); re-run the link crawler.
- **P1-4 — Consent and GA4 disclosure. Resolved in Phase 2.** GA4/GTM now load only after an explicit `Allow analytics` choice, only on public pages; Cloudflare Web Analytics stays cookieless and unconditional. The policy names GA4 and its basis, and `ADSENSE_CMP_ACTIVE` blocks ads until a certified CMP is attested. See §10 and §17.
- **P1-5 — Private response caching.** Add `Cache-Control: no-store` to private/auth HTML and authenticated APIs.
- **P1-6 — Origin/CSRF hardening.** Fail closed when `Origin` is absent on state-changing requests, with an explicit `Sec-Fetch-Site` fallback.
- **P1-7 — Autosave rate limit.** Add a per-attempt/IP bucket to the answers endpoint and test 429 behaviour.
- **P1-8 — Performance governance. Resolved in Phase 3.** `scripts/lighthouse-audit.mjs` now discovers live mocks/questions, seeds guest/admin sessions, reads `performance-budget.json` and exits non-zero when a route or global metric breaches its cap. All nine audited routes pass; attempt transfer fell to 68.7 KB and admin CLS to 0. See §4, §8 and §17.
- **P1-9 — Turso/D1 single source of truth.** Document the production engine, update deploy/runbook commands, apply migration `0027` + topic backfill to Turso, and make `check:env` assert the effective engine. Keep D1 only as an explicit local/legacy path until a migration decision is made. **Partially resolved in Phase 5:** `0026`, `0027` and `0028` are applied to production Turso and verified, and the topic importer now supports `--turso`; the editorial CSV topic backfill is still pending.
- **P1-10 — Local/production parity.** Remove the localhost exception for trailing-slash/canonical-host redirects in a test-only-safe way, or add a dedicated preview mode that matches production and document it.
- **P1-11 — Dependency advisory. Resolved in Phase 4.** Astro upgraded to `7.4.12` (`npm install astro@^7.4.12`), clearing `GHSA-mh32-jxcr-mh9f` and `GHSA-r3h5-4585-7x3w`. `docs/report/facts.json` and the dependency references were refreshed, the build is clean, the full unit suite passes and `npm audit` reports **0 vulnerabilities**.
- **P1-12 — Backups.** Provision the D1/Turso backup workflow secrets and verify a restore, or document the accepted risk and manual backup runbook.
- **P1-13 — Sitemap fixture guard. Resolved in Phase 4.** `isFixtureQuestion` now treats text that starts with `e2e`/`fixture` (and the existing fixture markers) as synthetic. `resolvePublicQuestion` applies that rule to `seoEligible`, so the `/q/` page, the sitemap and the structured data all share one eligibility check. The sitemap E2E proves a non-fixture eligible question is included while an `E2E fixture ...` question is excluded, and the unit guards pin the rule plus the resolver source.

### P2 — polish and hardening

- **P2-1 — Lazy share fonts. Resolved in Phase 3.** The attempt page no longer fetches `share-fonts-base.json` during idle; the share prerender runs only after `pointerover` or `focusin` on the Share control. Attempt initial transfer is 68.7 KB.
- **P2-2 — Leaderboard touch targets. Resolved in Phase 4.** Small leaderboard links now use `inline-block py-0.5` (or `line-clamp-1 py-0.5`) and measure exactly 24 px high in Playwright at 390 px.
- **P2-3 — Autosave copy. Resolved in Phase 4.** The attempt help text now says 15 seconds, matching `setInterval(..., 15000)`; a source guard keeps the two in sync.
- **P2-4 — Title lengths. Resolved in Phase 4.** `/leaderboard` is now 51 characters; a unit guard caps the indexable title at 60.
- **P2-5 — Blog structured data. Resolved in Phase 4.** Blog posts keep `Article` + `BreadcrumbList`; `FAQPage`, `Quiz`, `Course` and `LearningResource` stay disallowed because the visible content does not support them. The guard now covers `src/pages/blog/[slug].astro` in both the allow-list test and the disallowed-schema sweep, and the rationale is documented in `docs/SEO_RULES.md`.
- **P2-6 — Cookie prefixes. Resolved in Phase 5.** Session and guest cookies now use `__Host-cuet_session` / `__Host-cuet_guest` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`). The legacy names stay readable for one rollout window; a valid legacy token is promoted on its next request and deleted in the same response, so there is no forced logout. Unit tests cover the helpers and an E2E proves `/dashboard` stays 200 while the cookie is promoted.
- **P2-7 — CSP/COOP/CORP. Resolved in Phase 4 (scope split).** COOP and CORP are set on every Worker response. The CSP is built from live integration state, so dormant AdSense/GA4/GTM hosts are no longer advertised, and a route-specific policy (media `default-src 'none'; sandbox`) is preserved instead of being overwritten. `'unsafe-inline'` remains for scripts and styles until a nonce/hash migration; that residual risk is recorded in §15.
- **P2-8 — Result-page ad decision. Resolved in Phase 4.** The site intentionally serves no result ads: the result summary and solutions pages no longer opt in, `/result` is in `BLOCKED_AD_PATHS`, and a unit guard keeps both pages ad-free. The privacy policy already limits advertising to selected public content pages.
- **P2-9 — Environment docs. Resolved in Phase 4.** `.env.example` is now a committed, comment-only pointer to `.dev.vars.example`; `.gitignore` keeps `.env*` ignored but re-includes `.env.example`, and a unit guard fails if the pointer ever duplicates a key.
- **P2-10 — Attempt LCP/CLS. Resolved in Phase 3.** The share-font regression was the CLS/LCP driver. With intent-only prerender, the attempt page is 100 / LCP 1.24 s / CLS 0 in all three runs; first-image preload is no longer needed to meet the budget.
- **P2-11 — Public-profile intent. Resolved in Phase 4.** Profiles stay `noindex, follow` and out of the sitemap, while leaderboard and discussion usernames link to them for people. A unit guard pins the sitemap decision and an E2E proves a public profile is 200 + noindex, absent from the sitemap, and 404 once the profile is made private again.
- **P2-12 — API consistency. Resolved in Phase 4 (decision + small fix).** `/api` stays unversioned because it is internal-only; a `/api/v1` contract would double maintenance without a consumer. The shared `{ ok, ... }` / `{ error }` envelope is now consistent: `questions/[id]/report.ts` was the last route hand-rolling it, and a unit guard fails on a new raw error envelope or a `v1` folder. Revisit versioning only when a third party consumes the API, keeping old paths as aliases.

---

## 13. Before/after tracking

"Before" is this Phase 0 baseline. "After" is filled at close-out with the same method (mobile, light, 3-run median, production build, local D1). The attempt row uses the production-like share-off configuration; the share-on worst case is tracked separately.

| Route | Perf before | Perf after | A11y before | A11y after | BP before | BP after | SEO before | SEO after | LCP before | LCP after | TBT before | TBT after | CLS before | CLS after | Transfer before | Transfer after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 100 | 939 ms | 900 ms | 0 ms | 0 ms | 0 | 0 | 57.2 KB | 57 KB |
| `/mock-tests` | 100 | 100 | 100 | 100 | 100 | 100 | 92 | 100 | 921 ms | 900 ms | 0 ms | 0 ms | 0 | 0 | 58.8 KB | 59 KB |
| `/attempt/:id` (share off) | 100 | 100 | 100 | 100 | 100 | 100 | 58 | 58 | 1684 ms | 1240 ms | 0 ms | 0 ms | 0 | 0 | 100.7 KB | 68.7 KB |
| `/result/:id` (private) | 100 | 100 | 100 | 100 | 100 | 100 | 69 | 69 | 930 ms | 900 ms | 0 ms | 0 ms | 0 | 0 | 61.3 KB | 61.6 KB |
| `/attempt/:id` (share on, initial load) | 93 | 100 | 100 | 100 | 100 | 100 | 58 | 58 | 1734 ms | 1240 ms | 276 ms | 0 ms | 0 | 0 | 470.0 KB | 68.7 KB |

"After" was measured on 2026-11-17 with the same method. `/attempt/565` (share off) and `/result/565` used fresh guest attempts on the same mock 85 because baseline attempts 527/535 had expired or belonged to another guest cookie. The attempt and share-on rows show the final P1-8 numbers: the idle font fetch was removed, so opening the Share sheet is the only action that still downloads ~361 KB of share fonts. The earlier Phase 1 snapshot was 101 KB and 470 KB respectively; the interim delta is recorded in §17.

**Phase 2 P1-4 re-measure (2026-11-17).** Same method. The local production build has no GA4 id, so the consent component renders nothing and the gate adds no request or markup to these routes. This measures the unchanged public shell, not the configured-banner path.

| Route | Perf | A11y | BP | SEO | LCP | TBT | CLS | Transfer |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 100 | 100 | 100 | 100 | 981 ms | 0 ms | 0 | 57 KB |
| `/privacy-policy` (new) | 100 | 100 | 100 | 100 | 926 ms | 0 ms | 0 | 56 KB |

One `/` run scored 82 with TBT 518 ms and CLS 0.136 while the preview's Workers runtime restarted; Lighthouse recorded no layout-shift element. The other two runs were 100/0/0, so the median stands. `/privacy-policy` scored 100 in all three runs.

**Phase 3 P1-8 re-measure (2026-11-17, Lighthouse 13.6.0).** Same method. The full nine-route table is in §4; this tracks the material deltas.

| Route | Perf | CLS before → after | Transfer before → after | LCP before → after |
| --- | ---: | ---: | ---: | ---: |
| `/` | 100 | 0 → 0 | 57.2 KB → 57.2 KB | 939 ms → 930 ms |
| `/mock-tests` | 100 | 0 → 0 | 58.8 KB → 58.9 KB | 921 ms → 920 ms |
| `/attempt/:id` (share off) | 100 | 0 → 0 | 100.7 KB → **68.7 KB** | 1684 ms → **1240 ms** |
| `/attempt/:id` (share on, initial load) | 100 | 0 → 0 | 470.0 KB → **68.7 KB** | 1734 ms → **1240 ms** |
| `/result/:id` (private) | 100 | 0 → 0 | 61.3 KB → 61.6 KB | 930 ms → 930 ms |
| `/admin` (mobile) | 100 | **0.328 → 0** | n/a → 44.9 KB | n/a → 1090 ms |
| `/q/[id]` (new) | 100 | n/a → 0 | n/a → 70.6 KB | n/a → 930 ms |
| `/cuet-mock-test/english` (new) | 100 | n/a → 0 | n/a → 55.2 KB | n/a → 930 ms |
| `/mock/[slug]` + instructions (new) | 100 | n/a → 0 | n/a → 52.0-61.1 KB | n/a → 930 ms |

Share-on is now cheap at initial load; opening the Share sheet still fetches ~361 KB of fonts, by design. The admin CLS was measured after the P1-8 fix. The public-question route uses the local E2E sitemap fixture because no non-fixture question is published locally; the runner prefers a real `/q/` URL when one is present.

**Deployed staging check (2026-11-17, Lighthouse 13.6.0).** Same mobile/3-run/light method against the deployed Worker, not a local build. The full evidence is in `docs/report/lighthouse-staging/`. Staging skips `/admin` (no seeded operator) and `/q/[id]` (no public question), so seven routes were measured.

| Route | Perf | A11y | BP | SEO | LCP | TBT | CLS | Transfer | Budget |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `/` | 99 | 100 | 100 | 100 | 1.19 s | 0 ms | 0 | 58.7 KB | PASS |
| `/mock-tests` | 100 | 100 | 100 | 100 | 1.09 s | 0 ms | 0 | 60.0 KB | PASS |
| `/cuet-mock-test/english` | 99 | 100 | 100 | 100 | 1.10 s | 41 ms | 0 | 56.1 KB | **FAIL** — SI 3818 ms > 3500 ms |
| `/mock/[slug]` | 99 | 100 | 100 | 69 | 1.16 s | 0 ms | 0 | 63.0 KB | PASS |
| `/mock/[slug]/instructions` | 100 | 100 | 100 | 69 | 1.04 s | 0 ms | 0 | 53.2 KB | PASS |
| `/attempt/[id]` | 100 | 100 | 100 | 58 | 1.11 s | 0 ms | 0 | 70.0 KB | PASS |
| `/result/[id]` | 100 | 100 | 100 | 69 | 0.97 s | 0 ms | 0 | 63.5 KB | PASS |

The Subject Hub Speed Index breach is a staging artifact of TTFB, not a rendering regression: the two valid runs reported SI 3723 ms and 3913 ms with LCP 0.99 s and 1.22 s, and the Lighthouse LCP breakdown attributes 1754 ms to time-to-first-byte. Staging has `ENV=staging`, which deliberately skips the production edge cache, so TTFB was 1.25-1.53 s versus roughly 0.3 s locally. Perf is still 99 and every other metric is inside budget. Re-measure on the production cache path before treating this as a budget change; do not raise the budget from a staging-only sample.

Lighthouse returned `NO_NAVSTART` on 5 of 21 staging runs. The runner tolerated one failed run per route and every route kept at least two valid samples, so all medians above are computed from real navigations.

---

## 14. Fixed issues log

| Phase | Issue | Fix | Verification |
| --- | --- | --- | --- |
| 0 | No product code changes yet; baseline only | Preserved `docs/AUDIT.md`; wrote this audit; refreshed `docs/report/a11y-results.json` to `716d246` / 272 scans | `npm test`, `npm run build`, a11y report, Lighthouse baseline |
| 1 | ADS-1 / P0-1: AdSense loaded on the active attempt screen, contradicting the privacy policy | Removed the AdSense `<script>`, `AdSlot` usage and unused imports/consts from `src/pages/attempt/[id].astro`; added `/attempt` to `BLOCKED_AD_PATHS`; flipped the unit expectation and added a source-level regression guard | Focused tests 15/15, full suite 543/543, build clean; preview with valid `ADSENSE_*` showed 0 ad markers on `/attempt/535` while `/mock-tests` still served AdSense |
| 1 | SEO-1: 24 non-descriptive "Start" links on `/mock-tests` (Lighthouse SEO 92) | Kept the visible "Start" label and added the paper title as `sr-only` in-flow text in `PaperRow.astro`; added an E2E assertion for the row text | Lighthouse 3/3 runs: SEO **92 -> 100**, perf/a11y/BP 100, LCP 936 ms, 58.8 KB; focused E2E passed |
| 1 | SEO-2 / SEO-3: blog OG images were SVG (not rendered by major social platforms) and Twitter tags used `property=` | Repository guides now get pre-generated 1200x630 PNGs from `scripts/generate-guide-og.mjs` (`npm run og:guides`, committed under `public/og/blog/`); DB posts keep the SVG thumbnail but share `/logo.png`. Twitter tags changed to `name=`. New `src/lib/guide-images.ts` centralises both paths; unit tests cover the mapping, PNG existence and tag attribute | Full suite **547/547**, build clean; preview: `/blog/cuet-ug-syllabus-and-ncert-books` emits `og:image` and `twitter:image` as `.png`, `name="twitter:*"`, PNG served `200 image/png` (46,832 bytes), SVG thumbnail endpoint still `200` |
| 1 | SEO-4: `https://exams.nta.ac.in/CUET-UG/` returns 404 and was stored in six `exam_info` rows | Updated `migrations/0020_exam_info_seed.sql` for fresh databases and added `migrations/0028_fix_cuet_source_url.sql` to update existing rows; `exam-facts.test.ts` asserts the exact working URL and runs the migration | Local migration applied; DB rows all `https://cuet.nta.nic.in/`; `scripts/check-links.mjs http://localhost:4321`: **0/362 internal, 0/39 external broken** |
| 1 | SEC-3: private/auth responses lacked `Cache-Control: no-store` | `applySecurityHeaders()` now sets `Cache-Control: no-store` and `Pragma: no-cache` inside the existing `isPrivatePath()` branch; a unit test pins the gated placement | Preview headers: `/login` 200, `/dashboard` 303, `/attempt/535` 200, `/search` 200, `/result/999` 404 and `/admin` 303 all sent `no-store`/`Pragma: no-cache`; public `/`, `/mock-tests` and `/blog` were unchanged (no forced `no-store`) |
| 1 | SEC-1: `isSameOrigin()` accepted state-changing requests with no `Origin` header | A present `Origin` must match the request host; without it, only `Sec-Fetch-Site: same-origin` is accepted. `same-site`, `cross-site`, malformed and `Origin: null` are rejected. Playwright API contexts now send the suite origin, with a bare context proving the missing-header 403 | New `http.test.ts` 8/8; full suite **556/556**, build clean; E2E `api-contracts` 12/12, `security`/`attempt-flow`/`topic-mapping` 15/15, `admin-flow`/`question-share-public` 29/29 (2 skipped) |
| 1 | SEC-2: `/api/attempts/[id]/answers` had no rate limit | After the ownership check, the endpoint uses the KV limiter with bucket `attempt-answers` and key `attemptId:clientIp`, allowing 120 saves per 60 s and returning 429 beyond that. The autosave client leaves answers dirty and retries on its next normal tick, so a temporary limit does not lose data | E2E sends 120 saves then asserts the 121st is 429 with "Too many autosave"; full `security.spec.ts` 11/11; unit suite **556/556**, build clean |
| 3 | PERF-1 / P1-8: the attempt page fetched 361 KB of share-card fonts during idle (100.7 KB share off, 470 KB share on) | Removed `scheduleSharePrerender()` from page load; `prerenderShareForTrigger()` now runs on Share `pointerover`/`focusin`, so the fonts are fetched only when the user asks for a share card | Attempt initial transfer **68.7 KB** (from 100.7/470 KB), LCP 1.24 s, CLS 0, performance 100 in 3/3 runs; focused share E2E passed |
| 3 | PERF-2: the admin mobile sidebar painted in normal flow before hydration (CLS 0.328) | Set `document.documentElement.dataset.adminJs = "true"` in the `AdminLayout` head script so the sidebar is hidden before first paint | `/admin` CLS **0.328 -> 0**, LCP 1.09 s, 44.9 KB; admin E2E passed |
| 3 | PERF-3: `scripts/lighthouse-audit.mjs` was stale, used hard-coded ids and did not enforce `performance-budget.json` | Rewrote route discovery and auth seeding, added `scripts/lib/perf-budget.mjs`, and made the runner exit non-zero on any route/global breach; it now records the Lighthouse version | 18 unit tests; 9/9 routes pass; evidence in `docs/report/lighthouse/` |
| 4 | SEO-6 / P1-13: E2E fixture questions could enter `/sitemap.xml` and be served as indexable `/q/` pages | Strengthened `isFixtureQuestion` (text starting with `e2e`/`fixture`, plus the existing markers) and applied it in `resolvePublicQuestion`, so page robots, JSON-LD and the sitemap share one rule; added `LIGHTHOUSE_PUBLIC_QUESTION` for audits when the sitemap has no eligible question | Focused E2E sitemap test passed (1/1); unit suite in §17; sitemap returns `qUrls=0` locally after removing the fixture; 3-run Lighthouse verification 9/9 PASS |
| 4 | UX-2 / P2-2/P2-3/P2-4: small leaderboard links, stale autosave copy, 61-character leaderboard title | Raised every small leaderboard link to a 24 px target, changed the autosave copy to 15 seconds and shortened the title to 51 characters; added source guards | Focused tests 20/20; full suite **590/590**; build clean; preview measured title 51 and every sampled leaderboard link 24 px |
| 4 | DOC-1 / P2-9: environment docs only covered `.dev.vars.example`, so tools that look for `.env.example` found nothing | Added a comment-only `.env.example` that points at `.dev.vars.example`, re-included it in `.gitignore`, and added a unit guard that fails if the pointer duplicates a key | Focused `env-separation` **7/7**; full suite in §17 |
| 4 | ADS-5 / P2-8: result pages opted into ads even though the policy allows ads only on selected public content pages, contradicting the `AdSlot` comment and the ads QA checklist | Decided to serve no result ads: removed the `ads` opt-in from the result summary and solutions pages, added `/result` to `BLOCKED_AD_PATHS`, added a source guard, and documented the decision | Unit `integrations` **12/12**; preview with `ADSENSE_CLIENT`, `ADSENSE_SLOT_ID` and `ADSENSE_CMP_ACTIVE=1`: `/result/629` and `/result/629/solutions` returned 0 `adsbygoogle` and 0 AdSense script, while `/` and `/mock-tests` still served the unit |
| 4 | SEO-10 / P2-11: public profiles were noindex but the sitemap exclusion and private-profile 404 had no regression coverage | Kept profiles `noindex, follow` and out of the sitemap, documented the intent in the sitemap source, and added a unit guard plus an E2E covering public-profile 200/noindex, sitemap absence and private-profile 404 | Focused unit `seo-indexability` **19/19**; focused E2E **1/1 passed** |
| 4 | SEO-6 / P2-5: blog structured data had no explicit decision or guard for `FAQPage`/`Quiz`/`LearningResource` | Kept `Article` + `BreadcrumbList` on blog posts, added `LearningResource` to the disallowed set, included `src/pages/blog/[slug].astro` in both structured-data guard tests, and documented the rationale | Focused unit `structured-data` **6/6**; full suite in §17 |
| 4 | SEC-5 / SEC-6 / P2-7: CSP advertised dormant ad/analytics hosts, lacked COOP/CORP, and the global policy overwrote the media route's sandbox policy | Built the CSP from live integration state, added COOP `same-origin-allow-popups` and CORP `same-origin`, and stopped replacing route-specific policies | Focused `security-headers` + `middleware-headers` **18/18**; preview: dormant CSP had no ad/analytics hosts, enabled CSP had all of them, and COOP/CORP were present on `/`, `/login` and `/mock-tests`; full suite in §17 |
| 4 | API-1 / P2-12: `questions/[id]/report.ts` hand-rolled the JSON error envelope, and `/api/v1` had no decision | Routed the route through `apiError()`, kept `/api` unversioned for internal-only use, and added guards against a new raw error envelope or a `v1` prefix | Focused `api-conventions` **3/3**; full suite in §17 |
| 4 | SEC-9 / P1-11: `npm audit` reported a moderate Astro advisory (`GHSA-mh32-jxcr-mh9f` plus `GHSA-r3h5-4585-7x3w`) | Upgraded Astro **7.4.4 -> 7.4.12** within the `^7` range and refreshed the tracked versions in `docs/report/facts.json`, `APPENDIX_D_DEPENDENCIES.md`, `PROJECT_REPORT.md` and `BLUEPRINT-V2-COMPLIANCE.md` | Full suite **608/608**; build clean; `npm audit` **0 vulnerabilities**; axe **272/272** scans, 0 violations |
| 5 | SEC-4 / P2-6: session and guest cookies used unprefixed names and could be overwritten by a sibling subdomain | Added `src/lib/auth/cookies.ts` with `__Host-cuet_session` / `__Host-cuet_guest` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`), kept legacy reads, and promoted a valid legacy token by writing the prefixed cookie and deleting the old one in the same response | Cookie helpers **7/7**; full suite **617/617**; build clean; E2E proves `/dashboard` stays 200, the `__Host-` cookie is set and the legacy cookie is removed; full E2E **96 passed / 2 skipped** |
| 5 | DOC-2: privacy policy, terms, contact copy and admin guidance still described email/password sign-in | Rewrote the account, security, cookies and support copy for Google-only sign-in; disclosed the four legacy password hashes without claiming they are usable | Focused `auth-copy` + `consent` **9/9**; full suite **617/617** |
| 5 | OPS-1: `0026`, `0027` and `0028` were pending on production Turso, and the topic importer only targeted D1 | Dry-ran and applied all three migrations to Turso; added `--turso` to `scripts/tag-practice-questions.mjs` with a single interactive `write` transaction and row-count rollback; updated the runbook | `db:turso:verify`: **28 migrations**, integrity/foreign keys ok, 24,761 published and 7,527 practice questions, 0 orphan/duplicate checks; Turso dry run resolved a real paper/question/topic triple without writing |
| 5 | CI-1: release-branch CI failed at Playwright because `local-practice.spec.ts` asserted the pre-ranked-import counts (42 questions / 58 minutes) on a clean database that now seeds 50 / 60 | Asserted `rankedQuestionCount` and `rankedDurationMinutes` instead of the paper-level fields; reproduced the failure on a freshly seeded local D1 before fixing | Red before the fix (`42` vs rendered `50`); focused E2E **2/2** after; full E2E **96 passed / 2 skipped** |
| 5 | CI-2: the staging workflow could not resolve `cuet-d1-staging` (missing `--env staging`), only ran from `main`, expected `245 papers`, and the Windows backfill script could not spawn `npx` | Added `--env staging` to every staging DB script, allowed `release/*` to dispatch staging, updated the smoke expectation to `137 papers`, and made the backfill run Wrangler through `node` | Workflow now resolves the staging D1; it reaches the migration step and is blocked there by the token permission (see §15) |
| 5 | A11Y-2: the PYQ archive tag row scrolled horizontally but was not keyboard-focusable, so axe reported `scrollable-region-focusable` on four English rows at 375/1280 px in both themes | Kept the single-line layout and added `tabindex="0"` to the scroll container | Focused axe scan at 375 px: **0 violations, 0 overflow**; full a11y run recorded in §17 |
| 5 | A11Y-3: `/admin/seo` overflowed the mobile viewport by 399 px because long path names could not shrink inside the grid | Added `min-w-0` to both grid sections and `min-w-0 flex-1` to the path label | Focused axe scan at 375 px: **0 violations, 0 overflow**; full a11y run recorded in §17 |
| 5 | OPS-2: the staging workers.dev origin served `Allow: /` and no `noindex`, so the preview could compete with production in search | Added a staging-only `X-Robots-Tag: noindex, nofollow` in middleware and a staging-only `Disallow: /` `robots.txt`; production and local development are unchanged | Source guard **5/5**; deployed header check recorded in §17 |

Future phases append one row per fix and a short phase summary at the end of this file.

---

## 15. Remaining risks and blocked items

- AdSense is dormant, and the attempt-page violation (ADS-1) was fixed in Phase 1; ads remain off until consent, `/ads.txt` and the go-live checklist are complete. `ADSENSE_CMP_ACTIVE` now gates both the loader and the unit, but it is an operator attestation, not technical proof: a Google-certified CMP, policy review and AdSense approval are still required before ads can render.
- GA4 is now opt-in and public-only, so its pageviews will be lower than Cloudflare Web Analytics (which counts every page) and lower than historical GA4 totals. Do not reconcile the two as if they were the same measure.
- A visitor who clears site data or blocks `localStorage` loses the stored choice; the banner returns and analytics stays off until they choose again. This fails closed, but the choice cannot be remembered.
- The consent banner is not exercised by Lighthouse with a real GA4 id. Its markup is small and fixed-position, but the configured path should be re-measured on the deployed origin before go-live.
- The privacy policy and support copy now describe Google-only sign-in accurately, including the four production accounts that still carry an unused legacy password hash. Those hashes cannot be used to sign in and are removed when the account is deleted; no password-reset route is exposed.
- The CSP still allows `'unsafe-inline'` for scripts and styles. Astro's hydration bootstrap, the inline consent/theme/share snippets and dynamic `style=` attributes need nonces or hashes before that directive can be removed. Astro 7 has native CSP hashing, but adopting it must also cover `is:inline` third-party snippets (GA4/GTM/AdSense), so it stays a separate, test-heavy migration. Until then, CSP does not stop an injected inline script.
- Session and guest cookies now use `__Host-` names (P2-6). Legacy `cuet_session` / `cuet_guest` cookies are still read during the rollout window; a valid legacy token is promoted and the old cookie deleted on its next request. Remove the dual-read path after all live sessions have rotated (at most 30 days after deploy), then re-run the cookie unit/E2E guards.
- No GSC/Bing access: indexing, coverage and Core Web Vitals field data cannot be verified from this environment.
- No authenticated production admin/dashboard pass; admin RBAC is verified by tests and code review, not by a live production session.
- Production Turso vs local D1 means query counts, content counts and migration state can differ. Do not treat local D1 as production.
- Topic pages are blocked on the editorial CSV topic backfill; migration `0027` itself is applied to Turso. Until the CSV is imported, every `/cuet-mock-test/<subject>/<topic>` URL stays 404.
- Turso backup credentials are missing, so scheduled backups are not running for the production Turso database. The Cloudflare D1 backup workflow succeeded on 2026-11-17, but that artifact covers D1/local data, not Turso.
- The GitHub staging workflow is still blocked at its migration step: the repository `CLOUDFLARE_API_TOKEN` can deploy Workers but lacks D1 access (Cloudflare API error `7403`). Staging was therefore seeded and deployed from the authenticated local Wrangler session. A D1-capable token is required before the workflow can run end to end.
- The manual `Deploy production` workflow still runs D1 migrations and imports before deploying. Production data lives in Turso, so those steps touch a database the app does not read. Until the workflow is rewritten for Turso, release production with `db:turso:migrate` / `db:turso:verify` and `npm run deploy`, or dispatch it only for a code-only deploy with the D1 steps removed.
- `staging.cuetfreemocktest.com` has no DNS record even though the zone is on Cloudflare. The committed staging `SITE_URL` is therefore the workers.dev origin; switch it back and add the custom hostname to the Google redirect URI list once DNS is fixed.
- Staging has no `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`, so `/api/auth/google` returns `/login?error=google_not_configured`. The deployed Google callback cannot be verified until the staging Worker secrets and the Google redirect URI are configured.
- Staging D1 has no seeded operator/admin, so an authenticated staging pass of `/dashboard` and `/admin` was not possible. Those pages were verified to redirect to `/login` when signed out; authenticated staging QA still needs a staging admin. Seeding one is also blocked right now because `cuet-d1-staging` has exhausted Cloudflare's free-tier daily row-write limit (`7500`); the seed attempt wrote nothing and the quota resets at midnight UTC.
- The staging `noindex` guard is now live on `cuet-astro-staging`: every response sampled on 2026-11-17 carried `X-Robots-Tag: noindex, nofollow` and `/robots.txt` returned `User-agent: *\nDisallow: /`. Staging remains a public URL; the guard keeps it out of indexes, not out of reach.
- Cloudflare Access is not configured; production admin uses the session fallback.
- Local Lighthouse excludes GA4, AdSense and edge cache; field performance may differ. The local D1 data set also differs from Turso.
- The P1-8 gate enforces medians, not every run. One subject-hub run scored 99 while the median was 100; a single slow run does not fail the audit. This avoids flaky gates, but a genuine regression that appears in only one of three runs can hide.
- The budgets are app-specific targets, not Core Web Vitals thresholds. `maxInitialDomNodes` counts total DOM and is conservative; a route can pass the cap while a late client-only expansion raises the real initial count.
- Lighthouse is installed via `npx` and the repository does not pin it in `package.json`. Evidence records `13.6.0`, but a later run may use a different version and change scores. Pin or document the version before treating score deltas as regressions.
- The committed `/q/` Lighthouse evidence predates P1-13 and therefore audits the E2E sitemap fixture. Fixtures are now excluded from the sitemap and render `noindex`; the post-P1-13 verification used a temporary non-fixture question. A production audit should use a real published question or `LIGHTHOUSE_PUBLIC_QUESTION=/q/...`. Opening the Share sheet still fetches ~361 KB of fonts by design, so measure that interaction separately if share previews are enabled in production.
- The fixture rule is text-based (`e2e`, `fixture` prefixes). A synthetic question with neutral text would still pass; the local audit question is an example. Keep test fixtures clearly labelled and use `LIGHTHOUSE_PUBLIC_QUESTION` only for audit fixtures that never reach production.
- Real iOS/Android device testing remains outstanding.
- Free-tier row-read quotas remain a cost/availability risk, especially for cold-start practice-library warm-up and submit.

---

## 16. Manual QA checklist

Use this after each phase and before the final close-out. Test at 360, 768 and 1440 px, light and dark, keyboard-only, and with a throttled mobile profile.

### Public pages

- [ ] `/` loads, exactly one H1, no horizontal scroll, primary CTA starts a mock.
- [x] `/mock-tests` filters (search, year, subject, type, sort) work with and without JS; empty state is reachable; every "Start" link has a descriptive accessible name.
- [ ] `/mock/[slug]` wrapper canonicalises to the canonical paper; instructions page starts the exam; discussion page loads and is noindex.
- [ ] PYQ archive, subject hubs, year pages and wrong-category redirects land on the canonical paper with a 301.
- [x] `/blog` and a blog post render; OG/Twitter preview uses a raster image; JSON-LD matches visible content.
- [x] `/leaderboard` loads, links are readable and tappable (small links measure 24 px high), and an empty leaderboard is gated correctly.
- [ ] `/search` is noindex and does not leak private attempts.
- [ ] Legal pages (`/privacy-policy`, `/terms`, `/disclaimer`, `/about`, `/contact`) are reachable from the footer and accurate.

### Auth and account

- [ ] Google sign-in works; the redirect preserves `next`.
- [ ] Sign-out clears the session; a protected page returns to `/login?next=...`.
- [ ] Session expiry is handled without a 500.
- [ ] `/signup` and `/forgot-password` 301 to `/login` as intended.
- [ ] A non-admin cannot reach `/admin`; an admin can; a moderator sees only permitted tools.
- [ ] A second user cannot read, autosave into, submit or view another user's attempt/result.

### Exam flow

- [ ] Start creates an attempt and shows the server deadline.
- [ ] Refresh/resume keeps answers and remaining time; no duplicate attempt is created.
- [x] Autosave debounce and 15-second interval both persist; the help text matches.
- [ ] Closing/reopening the tab flushes the last dirty answer (or shows a clear warning).
- [ ] Palette navigation, mark-for-review, language toggle, timer warning and auto-submit at expiry work.
- [ ] Submit confirmation shows counts; submit scores server-side; result shows score, accuracy, subject analysis and retake CTA.
- [ ] Solutions page loads only for the owner.
- [ ] Share (if enabled) opens only on intent, does not fetch 361 KB fonts on page load, and the generated card is readable.

### Ads and privacy

- [x] With `ADSENSE_*` empty: no AdSense script, no ad unit, `/ads.txt` 404.
- [x] With `ADSENSE_CLIENT`/`ADSENSE_SLOT_ID` set but `ADSENSE_CMP_ACTIVE` empty: no loader and no ad unit on any route (unit guard plus source-level checks).
- [x] With `ADSENSE_CMP_ACTIVE=1` in a preview: no ad script or unit on `/attempt`, `/result`, `/dashboard`, `/login`, `/admin` or `/search` (verified 2026-11-17 with a fresh guest attempt: `/result/629` and its solutions page returned 0 `adsbygoogle` and 0 AdSense script, while `/` and `/mock-tests` still served the unit).
- [ ] Ads appear only on allowed content pages, after the certified CMP is live.
- [x] With GA4 configured on a public page: no `googletagmanager.com` request before a choice, the banner is visible, Reject persists and never loads, Allow loads once, and a reload keeps the choice.
- [x] The footer and privacy-policy controls reopen the banner; rejection after a load clears `_ga*` and reloads.
- [x] No banner, no request and no openable control on `/attempt`, `/result`, `/dashboard`, `/admin`, auth or `/search` (`?allow=0` dev harness plus the shared private-path guard).
- [x] With JavaScript disabled: the banner and controls are hidden and no analytics request occurs (E2E).
- [x] The privacy policy names GA4, its cookies, retention, processor and opt-out, and distinguishes analytics consent from advertising consent.

### SEO and redirects

- [ ] Every indexable page has one title, description, canonical, OG title/image and valid JSON-LD.
- [x] `/sitemap.xml` contains no fixture, private or empty routes; `E2E fixture ...` questions are excluded while a non-fixture eligible question is included. Canonical/`og:url` match.
- [x] `/robots.txt` disallows private paths and points to the sitemap (verified on production 2026-11-17: `Allow: /` with `/admin`, `/api/`, `/attempt/`, `/result/`, `/dashboard`, `/login`, `/search` and the other private routes disallowed, plus the canonical sitemap URL).
- [ ] Legacy paths (`/practice*`, `/mock-test*`, `/pyq`, `/cuet-ug-previous-year-papers`, wrong-category PYQ) 301 once, not in a chain. (`/practice` returned a single 301 on production; the full list was verified on staging.)
- [x] Trailing slash, `www`, `http` and `workers.dev` hosts 301 to the canonical origin (verified on production 2026-11-17).
- [ ] 404 and 500 pages render useful recovery links and are noindex.

### Performance governance

- [x] `npm run audit:lighthouse -- --runs=3` exits 0 and all nine routes pass their route and global budgets.
- [x] `/attempt/:id` does not request `share-fonts-base.json` before the Share control is hovered or focused.
- [x] The admin mobile sidebar does not shift the page on first paint (CLS 0).
- [x] Committed Lighthouse evidence contains no `cuet_session`/`cuet_guest` cookie material and no `headers-*.json`.
- [ ] Re-run the audit on the deployed origin with GA4, AdSense (when enabled) and edge cache active.
- [x] A post-P1-13 local audit passes 9/9 when `/q/` is supplied through `LIGHTHOUSE_PUBLIC_QUESTION` (or a real eligible question is in the sitemap).

### Security and operations

- [x] On deployed staging: `/api/health`, `/mock-tests`, `/sitemap.xml` and a mock instructions page returned 200; `/dashboard` and `/admin` redirected 303 to `/login`.
- [x] On deployed staging: `/sitemap.xml` had 219 URLs with 0 private, profile or `/q/` URLs, all on the workers.dev origin.
- [x] On deployed staging: `/practice`, `/mock-test`, `/mock-test/*`, `/cuet-ug-mock-test` and the old PYQ archive path returned a direct 301.
- [x] On deployed staging: a guest attempt returned 201 with `__Host-cuet_guest`; replaying the legacy `cuet_guest` token resumed it (200) and deleted the legacy cookie; a POST without `Origin` returned 403.
- [x] On deployed staging: every sampled response, including `/robots.txt` and `/sitemap.xml`, carried `X-Robots-Tag: noindex, nofollow`, and `/robots.txt` disallowed all crawlers.
- [x] On deployed staging: homepage had 0 AdSense, analytics, consent-banner and Cloudflare Insights markers; `/ads.txt` was 404 while ads stay off.
- [ ] Google sign-in on staging (blocked: staging has no Google client id/secret).
- [ ] Authenticated staging `/dashboard` and `/admin` (blocked: no seeded staging operator).

- [ ] Security headers are present in production (`CSP`, `HSTS`, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`, `COOP`, `CORP`).
- [x] Private HTML and auth responses send `Cache-Control: no-store`.
- [x] Cross-origin POST/PUT/PATCH/DELETE is rejected; same-origin writes succeed.
- [ ] Login, attempt start, submit, answers and comments rate limits return 429 under load without locking out normal use.
- [x] Session and guest cookies are `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, with the `__Host-` prefix; a legacy `cuet_session` cookie is promoted to `__Host-cuet_session` without signing the user out.
- [ ] `/api/health` reports the expected engine and DB state; `/ads.txt` matches the configured publisher.
- [ ] Deploy, rollback and backup/restore are exercised in staging; production deployment matches the intended commit.

---

## 17. Phase log

### Phase 0 — audit and baseline (2026-11-17)

**Done**

- Inventoried 179 route modules, 82 API endpoints and 33 admin pages.
- Read `docs/WEBSITE_SITEMAP.md`, middleware, auth, DB, SEO and integration code.
- Ran tests (542), build, audit, perf, SEO, copy lint, env check, link crawl, 272-scan axe audit and a five-width responsive pass.
- Captured mobile Lighthouse baselines for home, mock list, attempt and result; corrected the attempt baseline to the production share-off configuration and kept the share-on worst case separately.
- Verified 301 redirects, production headers, sitemap/robots/ads.txt, health engine and deployment/HEAD alignment.
- Preserved the historical `docs/AUDIT.md`; refreshed `docs/report/a11y-results.json`.

**Remaining / blocked**

- GSC/Bing, authenticated production admin/dashboard checks and a physical-device pass were unavailable.
- Production Turso migration `0027` and the CSV topic backfill are still pending.
- D1 backup secrets and Cloudflare Access remain unconfigured.
- No product code has been changed yet; Phase 1 starts with P0-1 (remove AdSense from the attempt page).

**Next**

1. Fix P0-1 and add regression coverage.
2. Then P1-1 (mock start links), P1-2 (social metadata), P1-3 (NTA URL), P1-5 (private cache) and P1-6/P1-7 (Origin/rate limit) in small commits.
3. Re-run build, tests, a11y and the affected Lighthouse routes after each phase; append a summary here.

---

### Phase 1 — P0 and launch fixes (complete)

**Done**

- **P0-1:** removed AdSense from the active attempt screen. The page no longer imports `AdSlot`/`adsenseClient`/`adsenseSlot`, emits the loader script or renders a unit; `/attempt` is blocked in `adSlotAllowed()` as a second line of defence.
- Regression coverage: `tests/unit/integrations.test.ts` now asserts `/attempt/42` and `/attempt/42/` are blocked, and a source-level guard fails if the attempt page regains `AdSlot`, `adsbygoogle` or `pagead2.googlesyndication.com`.
- Verification: focused tests 15/15, full suite **543/543**, `npm run build` clean. A preview with valid `ADSENSE_CLIENT`/`ADSENSE_SLOT_ID` served `/attempt/535` with zero ad markers (86,175 bytes) while `/mock-tests` still loaded AdSense, confirming the env vars were active and the block is route-specific.
- **P1-1 (SEO-1):** mock start links now carry the paper title as `sr-only` text while keeping the visible "Start" label. `/mock-tests` Lighthouse SEO rose from **92 to 100** on all three runs with performance/accessibility/best-practices at 100; an E2E assertion guards the row text.
- **P1-2 (SEO-2/SEO-3):** added `src/lib/guide-images.ts` and `scripts/generate-guide-og.mjs`; 34 repository guides now share as 1200×630 PNGs in `public/og/blog/` (1,534 KB total). Database posts keep the SVG thumbnail and fall back to `/logo.png` for sharing. Twitter card metadata now uses `name=`. Regression tests cover paths, PNG existence and the tag attribute.
- Verification: full suite **547/547**, `npm run build` clean. Preview confirmed `og:image`/`twitter:image` as PNG, `name="twitter:*"`, the PNG served `200 image/png` at 46,832 bytes and the SVG thumbnail endpoint still `200`.
- **P1-3 (SEO-4):** replaced the dead `https://exams.nta.ac.in/CUET-UG/` source with the official `https://cuet.nta.nic.in/` in the seed, added migration `0028_fix_cuet_source_url.sql` for existing databases, and tightened `exam-facts.test.ts`.
- Verification: migration applied locally; all six rows updated; `scripts/check-links.mjs http://localhost:4321` reported **0/362 internal, 0/39 external broken**.
- **P1-5 (SEC-3):** `applySecurityHeaders()` now sends `Cache-Control: no-store` and `Pragma: no-cache` for every `isPrivatePath()` response. Because the header helper also wraps auth failures, maintenance rewrites and redirects, those paths are covered before any page renders. The edge cache allowlist already excludes private paths, so it cannot overwrite the header.
- Verification: focused middleware tests 7/7. Preview headers: `/login`, `/dashboard`, `/attempt/535`, `/search`, `/result/999` and `/admin` all returned `no-store` + `Pragma: no-cache`; public `/`, `/mock-tests` and `/blog` were unchanged.
- **P1-6 (SEC-1):** `isSameOrigin()` no longer fails open. A present `Origin` must match the request host; a missing `Origin` is accepted only with `Sec-Fetch-Site: same-origin`. Requests with neither header, `same-site`, `cross-site` or a malformed origin are rejected. All 57 API route files that export a write method already call this helper, so no route changes were needed. Playwright now sends the suite origin on API request contexts; a dedicated no-header context proves the 403 end to end.
- Verification: new `tests/unit/http.test.ts` covers matching/cross-host/malformed `Origin` and the `Sec-Fetch-Site` fallback. Full unit suite **556/556**, build clean. E2E: `api-contracts` 12/12 (including missing-header 403 and `Sec-Fetch-Site` 200), `security` + `attempt-flow` + `topic-mapping` 15/15, `admin-flow` + `question-share-public` 29/29 with 2 skips.
- **P1-7 (SEC-2):** the autosave endpoint now uses the existing KV limiter after the attempt ownership check: 120 writes per 60 s keyed by `attemptId:clientIp`. Checking ownership first prevents a stranger from draining another attempt's bucket. The client already leaves unsaved answers dirty on failure and retries on its next normal tick, so a temporary 429 does not lose data or create a tight retry loop.
- Verification: the new E2E sends 120 empty autosaves (all 200) and asserts the 121st returns 429 with "Too many autosave"; full `security.spec.ts` 11/11.
- **Close-out verification:** `scripts/a11y-audit.mjs` now sends the suite origin on its three API writes, so the attempt/result walk survives P1-6. The full axe audit completed **272 scans with 0 violations and 0 horizontal overflow**, including `/attempt/570`, `/result/570` and the solutions and discussion pages; the refreshed report is committed.
- Lighthouse after results (§13): `/` and `/mock-tests` score **100 across performance, accessibility, best practices and SEO**; `/mock-tests` SEO moved **92 → 100** and LCP stayed at ~0.9 s. The production-like attempt page is **100/100/100/58** at **101 KB**, and the private result is **100/100/100/69** at **61 KB**. The non-default share-on worst case stayed at **470 KB** at this point; P1-8 later removed the idle font fetch and cut the initial load to 68.7 KB.
- Full unit suite **556/556**, build clean. Phase 1 changes are committed in nine reviewable commits.

**Next**

- Phase 2: P1-4 (consent/GA4 disclosure), P1-8 (performance-budget enforcement and a working Lighthouse runner), then the P2 UI/UX and code items.
- Production operations: apply `npm run db:turso:migrate` so migration `0028` reaches Turso, refresh the D1/Turso backup workflow, and decide whether to configure Cloudflare Access or accept the documented admin-session risk.

---

### Phase 2 — P1-4 consent gate and GA4 disclosure (2026-11-17)

**Done**

- Shared `NOINDEX_PREFIXES`/`isPrivatePath` in `src/lib/private-paths.ts`, consumed by the middleware and the consent code, so analytics scope and `noindex`/`no-store` cannot drift apart.
- Added `src/lib/consent.ts`: versioned `cuet_consent_v1` storage values, strict parsing (malformed and future versions mean "no decision"), GA4/GTM detection and a public-page predicate.
- Removed the unconditional GA4/GTM head loaders and the GTM `<noscript>` iframe from `BaseLayout`. Added `ConsentGate.astro` with equal-prominence Allow/Reject buttons, a polite status message, focus return to the opener, and withdrawal that clears `_ga`/`_ga_*`/`_gid` and reloads.
- Added the development-only `/dev/consent` harness (fake `G-DEVTEST123`, `?allow=0` suppression), Playwright storage-state seeding, six consent E2E tests, source guards and a local-only axe scan.
- Added `ADSENSE_CMP_ACTIVE`; both the BaseLayout loader and `AdSlot` now require `1` or `true`. Ads remain off by owner decision for roughly 5–6 months.
- Updated the privacy policy (review date 17 November 2026), `docs/EXTERNAL_SETUP.md`, `docs/LAUNCH-RUNBOOK.md` and `.dev.vars.example`.

**Verification**

- Unit: **568/568** across 65 files.
- Build: `astro check` 0 errors, 0 warnings; build clean; secret scan passed.
- E2E: **94 passed, 2 skipped**.
- Axe: **276 scans, 0 violations, 0 horizontal overflow** (four new scans cover `/dev/consent`).
- Lighthouse medians (§13): `/` 100/100/100/100, LCP 981 ms; `/privacy-policy` 100/100/100/100, LCP 926 ms, 56 KB.
- Commits: `30eedf0`, `09a7509`, `8ac6999`, `4edfffa`, `2dbd3ae`, plus this audit record. All local with `[skip deploy]`.

**Next**

- P1-8: refresh `scripts/lighthouse-audit.mjs`, make it read `performance-budget.json`, and fail the run when a route breaches its budget.
- Before any push: confirm the consent component on the deployed origin with the real GA4 id, then record the configured-banner Lighthouse run.

---

### Phase 3 — P1-8 performance governance (2026-11-17)

**Done**

- Rebuilt `scripts/lighthouse-audit.mjs` around `performance-budget.json`: live mock/question discovery, guest attempt/result creation, optional admin seeding from `LIGHTHOUSE_ADMIN_COOKIE` or a storage-state file, three-run medians and a non-zero exit on any route/global breach.
- Added `scripts/lib/perf-budget.mjs` (pure route matcher/evaluator) and 18 unit tests covering exact/dynamic matching, score/transfer/LCP/TBT/CLS/FCP/SI/DOM caps, missing metrics, message formatting and source guards.
- `performance-budget.json` v1.2.0 renames the retired `/cuet-ug-mock-test` key to `/mock-tests` and documents the conservative total-DOM check.
- Fixed the attempt share-font regression: `scheduleSharePrerender()` no longer runs during page idle; `pointerover`/`focusin` on the Share control triggers it. Attempt initial transfer fell from 100.7 KB (share off) and 470 KB (share on) to **68.7 KB**.
- Fixed admin mobile CLS: `data-admin-js` is set in the head before the sidebar can paint. CLS fell from **0.328 to 0**.
- Security hygiene: Lighthouse header files now live in `os.tmpdir()`, raw reports are sanitized before writing, `headers-*.json` is ignored, and the previously tracked headers plus stale light `run4`/`run5`/`report` files were removed.
- The runner records `lighthouseVersion` in `lighthouse-results.json` and `SUMMARY.md` (13.6.0 for this run).

**Verification**

- Unit: **586/586** across 66 files (18 in `perf-budget.test.ts`).
- Build: `astro check` 0 errors, 0 warnings, 12 hints; build clean; secret scan passed.
- Lighthouse: **9/9 routes pass**, performance 100 on every median, TBT and CLS 0 everywhere, transfer 44.9–70.6 KB, LCP 0.93–1.24 s. Evidence in `docs/report/lighthouse/`.
- Focused E2E: `question-share-public.spec.ts` + `admin-flow.spec.ts` **29 passed / 2 skipped**. The canonical full Playwright report was left unchanged.
- No session cookie material remains in the committed evidence.

**Next**

- P1-9/P1-10/P1-11 operational items, then the P2 UI/UX and code backlog.
- Re-measure on the deployed origin once GA4 consent, ads and edge cache are active.

---

### Phase 4 — P1-13 sitemap fixture guard and P2 polish (2026-11-17)

**Done**

- `isFixtureQuestion` now detects text that starts with `e2e` or `fixture` (case-insensitive, trimmed) in addition to the existing `e2e fixture` / `fixture question` markers.
- `resolvePublicQuestion` applies the fixture check to `seoEligible`, so the `/q/` page robots tag, the JSON-LD decision and `listSeoIndexableQuestions()` all use one rule. Fixture questions can no longer enter the sitemap through a stale `seo_indexable=1` flag.
- The sitemap E2E now creates a non-fixture eligible question (`Sitemap eligible ...`) and proves it is included, while a separate `E2E fixture ...` question is excluded alongside the noindex, attempted-only and published-mock cases.
- `scripts/lighthouse-audit.mjs` reads `LIGHTHOUSE_PUBLIC_QUESTION=/q/...` when the sitemap has no eligible question. Discovery now trusts the sitemap (fixtures are excluded there) instead of preferring a non-`e2e` URL.
- P2-2: every small leaderboard link uses `inline-block py-0.5` (or `line-clamp-1 py-0.5`) and measures 24 px high.
- P2-3: attempt help text now says 15 seconds, matching the `15000` ms autosave interval.
- P2-4: `/leaderboard` title shortened from 61 to 51 characters.
- P2-9: added a comment-only `.env.example` that points at `.dev.vars.example`. `.gitignore` keeps `.env*` ignored but re-includes the pointer, and a unit guard fails if a key is ever duplicated into it.
- P2-8: decided to serve no result ads. Removed the `ads` opt-in from the result summary and solutions pages, added `/result` to `BLOCKED_AD_PATHS`, and added a source guard. The privacy policy already limits advertising to selected public content pages.
- P2-11: kept public profiles `noindex, follow` and out of the sitemap while leaderboard and discussion usernames link to them. Added a sitemap source guard and an E2E for public-profile 200/noindex, sitemap absence and private-profile 404.
- P2-5: blog posts emit `Article` + `BreadcrumbList`; `FAQPage`, `Quiz`, `Course` and `LearningResource` stay disallowed. Both structured-data guard tests now cover `src/pages/blog/[slug].astro`, and `docs/SEO_RULES.md` explains why `LearningResource` is not a fit for editorial guides.
- P2-7: COOP `same-origin-allow-popups` and CORP `same-origin` are set on every Worker response. The CSP is built from live integration state, so ad and analytics hosts appear only when configured, and route-specific policies are preserved. `'unsafe-inline'` remains until the nonce/hash migration (§15).
- P2-12: kept `/api` unversioned for internal-only use and moved the last hand-rolled error response in `questions/[id]/report.ts` onto `apiError()`. A unit guard pins the shared envelope and blocks a `v1` prefix until an external consumer exists.
- P1-11: upgraded Astro **7.4.4 -> 7.4.12** within the `^7` range, which clears `GHSA-mh32-jxcr-mh9f` and `GHSA-r3h5-4585-7x3w`. Refreshed `docs/report/facts.json` and the three documents that cite the framework version.

**Verification**

- Unit: **608/608** across 68 files, including the fixture-text, runner-override, `.env.example`, result-ad, profile-sitemap, structured-data, CSP and API-convention guards; focused `attempt-time` + `seo-consistency` **20/20**; focused `env-separation` **7/7**; focused `integrations` **12/12**; focused `seo-indexability` **19/19**; focused `structured-data` **6/6**; focused `security-headers` + `middleware-headers` **18/18**; focused `api-conventions` **3/3**.
- Build: `astro check` 0 errors, 0 warnings; build clean; secret scan passed.
- Dependencies: `npm audit` reports **0 vulnerabilities** after the Astro 7.4.12 upgrade; `package-lock.json` and `docs/report/facts.json` agree on the tracked versions.
- Accessibility: `npm run test:a11y` on the dev server (the audit needs the dev-only `/dev/consent` preview) completed **272/272 scans with 0 WCAG A/AA violations and 0 horizontal overflow** at `2c30f3c`; `docs/report/a11y-results.json` was refreshed.
- E2E: focused sitemap test **1/1 passed**; focused public-profile test **1/1 passed**; local `/sitemap.xml` returned **0** `/q/` URLs after the fixture was removed.
- Lighthouse: a post-P1-13 3-run verification passed **9/9** route budgets. The committed evidence was left at the Phase 3 snapshot because route rendering and transfer did not change; the verification used a temporary non-fixture question that was soft-deleted afterwards.
- Preview measurement: `/leaderboard` title 51 characters; every sampled small leaderboard link rendered at 24 px.
- Ads preview: with `ADSENSE_CLIENT`, `ADSENSE_SLOT_ID` and `ADSENSE_CMP_ACTIVE=1`, a fresh guest attempt 629 returned 0 `adsbygoogle` and 0 AdSense script on `/result/629` and `/result/629/solutions`, while `/` and `/mock-tests` still served the unit.
- CSP preview: with every integration unset, `/` and `/login` returned COOP/CORP and no `googlesyndication`, `doubleclick`, `googletagmanager` or `google-analytics` hosts. With AdSense and GA4 configured, `/`, `/login` and `/mock-tests` returned all four host groups.

**Next**

- Phase 4 P2 polish is complete except P2-6 (cookie prefixes), which is deferred to its own rollout window (see §15).
- Apply `npm run db:turso:migrate` when the next push is allowed so `0028` reaches Turso; re-run the production link crawl after deploy.

---

### Phase 5 — Auth accuracy, cookie prefixes and Turso migrations (2026-11-17)

**Done**

- Auth copy is now accurate for the Google-only flow. The privacy policy, terms, contact guidance, admin invite hint and the OAuth config comment no longer describe email/password signup. The policy still discloses that four production accounts carry an unused legacy password hash; it cannot sign in and is deleted with the account.
- Session and guest cookies moved to `__Host-cuet_session` / `__Host-cuet_guest` (`HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/`, no `Domain`). The legacy names remain readable for one rollout window.
- A valid legacy session or guest token is promoted on its next request: the `__Host-` cookie is written and the legacy cookie is deleted in the same response. No user is signed out.
- The privacy policy cookie table, `docs/WEBSITE_SITEMAP.md` and the auth E2E helper now use the prefixed names; the E2E helper exports the legacy name for the migration test.
- Applied production Turso migrations `0026_rename_pyq_archive_path.sql`, `0027_practice_question_topics.sql` and `0028_fix_cuet_source_url.sql` after a dry run reported all three pending.
- `scripts/tag-practice-questions.mjs` now supports `--turso`: it reads mapping context through the Turso client and applies all tags in one interactive `write` transaction, rolling back on an unexpected row count. The production topic import no longer has to go through the unused D1 binding.
- Fixed a stale question-share E2E fixture whose text started with `E2E`; the P1-13 fixture rule correctly refused to index it. The test now uses neutral question text so it can exercise the `seo_indexable` transition.

**Verification**

- Unit: **617/617** across 70 files. Focused cookie helpers **7/7**; focused `auth-copy` + `consent` **9/9**.
- Type check: `astro check` 0 errors, 0 warnings.
- Accessibility: `npm run test:a11y` completed **272 scans with 0 WCAG A/AA violations and 0 horizontal overflow**; `docs/report/a11y-results.json` was refreshed after the Phase 5 copy changes.
- Build: clean; the secret scan passed and removed the local env file from `dist/`.
- E2E: full suite **96 passed / 2 skipped**. The legacy-session promotion test passes — `/dashboard` stays 200, `__Host-cuet_session` is present, and `cuet_session` is gone.
- Turso: `npm run db:turso:verify` reported **28 migrations**, `integrity: ok`, `foreignKeys: ok`, 24,761 published questions, 7,527 practice questions, 87 attempts, 8 users and 0 orphan/duplicate checks. A `tag-practice-questions.mjs --turso` dry run resolved a real paper/question/topic triple and reported `Turso` as the target without writing.

**Next**

- Keep the legacy cookie reads for at most one session lifetime (30 days), then remove them and re-run the cookie guards.
- Import the editorial CSV topic backfill (`docs/TOPIC_BACKFILL.md`); the schema is now live in production.
- Provision Turso backup credentials and exercise a restore.
- Migrate CSP `'unsafe-inline'` to nonces or hashes as a separate, test-heavy change.

---

### Phase 5 — deployed staging verification (2026-11-17)

Staging was seeded and deployed from the authenticated local Wrangler session because the GitHub token lacking D1 permission is still an open blocker. The release branch is `release/audit-phase5`; production stayed on `716d246` during the audit and was released at the end (below).

**Infrastructure**

- Migrations **0021-0028** applied to `cuet-d1-staging`; practice import **7,527** rows; ranked import applied; explanation backfill reported practice **5,378 ai_draft / 26 banner / 2,123 none** and questions **5,645 / 28 / 2,206**.
- `cuet-astro-staging` deployed, then re-deployed with `SITE_URL=https://cuet-astro-staging.cuet-platform.workers.dev` because `staging.cuetfreemocktest.com` has no DNS record.
- Smoke: `/api/health`, `/mock-tests`, `/sitemap.xml` and `/mock/psychology-2024-07-19-shift-1/instructions` all returned **200**. The first text assertion expected `245 papers`; staging publishes **137**, so the workflow expectation was corrected to `137`.

**Deployed QA**

- `/dashboard` and `/admin` redirect **303** to `/login?next=...`; `/login` returns 200. There is no seeded staging operator, so authenticated staging pages could not be exercised.
- `/sitemap.xml`: **219** URLs, **0** `/q/`, **0** private/auth/attempt/result URLs, **0** profile URLs, and every URL uses the workers.dev origin.
- Homepage: **0** AdSense markers, **0** analytics loaders, **0** Cloudflare Insights beacons. `/ads.txt` is 404 while ads stay off.
- Legacy redirects: `/practice`, `/mock-test`, `/mock-test/*`, `/cuet-ug-mock-test` and the old PYQ archive path return **301** to the canonical URLs. `/topics` and `/questions` are not routes and return 404.
- Guest cookie: `/api/attempts/start` returned **201** with `__Host-cuet_guest=...; Max-Age=2592000; Path=/; HttpOnly; Secure; SameSite=Lax`. Replaying the token as `cuet_guest` returned **200 resumed**, set `__Host-cuet_guest` and deleted `cuet_guest`. `/attempt/3` was 200 with the guest cookie and 404 without it; `/result/3` redirected 303 to `/attempt/3` until the attempt is submitted. A POST without `Origin` or `Sec-Fetch-Site` returned **403**.
- Google OAuth: `/api/auth/google?next=%2Fdashboard` redirects 303 to `/login?error=google_not_configured`, and `/login` renders the "not configured" notice with no Google link because the staging secrets are absent.
- Staging noindex is live after re-deploying from the committed build: `/`, `/mock-tests`, `/login`, `/api/health`, `/sitemap.xml` and `/robots.txt` all returned `X-Robots-Tag: noindex, nofollow`, and `/robots.txt` returned `User-agent: *` / `Disallow: /`.

**Lighthouse and accessibility**

- Deployed staging Lighthouse: **6 of 7** routes pass; the Subject Hub Speed Index miss and its TTFB explanation are recorded in §13. Evidence lives in `docs/report/lighthouse-staging/`; the local baseline in `docs/report/lighthouse/` was restored from git.
- Local re-verification after the a11y fixes: unit **618/618** across 70 files, `npm run build` clean (0 errors, 0 warnings, secret scan passed), full E2E **96 passed / 2 skipped**, full axe **272 scans / 0 WCAG A/AA violations / 0 horizontal overflow**.
- Production packaging check: a `CLOUDFLARE_ENV=production npm run build` followed by `npx wrangler deploy --dry-run` exited 0 and resolved `ENV=production`, `SITE_URL=https://cuetfreemocktest.com`, `GA4_MEASUREMENT_ID` present, AdSense vars blank, D1 `cuet-blueprint-db` and both KV bindings. Nothing was uploaded to production.
- The a11y fixes that came out of CI were the PYQ tag scroll container missing `tabindex="0"` and `/admin/seo` overflowing 375 px by 399 px. Source guards for the staging noindex are **5/5**.

**Release verification**

- CI is green on `release/audit-phase5`: runs **44146231049** (`d843187`), **44148732180** (`ca151a8`) and **44150761454** (`ca146d0`) all completed successfully, including the Playwright and accessibility gates that failed before the a11y fixes.
- The release branch contains `main` up to `c604ce3`. `main` itself was never pushed, so the `Auto deploy production` workflow never ran. Production was released explicitly with `npm run deploy`.

**Production release (2026-11-17T21:10:40Z)**

- Pre-flight: `npm run db:turso:verify` reported **28 migrations**, `integrity: ok`, `foreignKeys: ok`, 24,761 questions, 7,527 practice questions, 87 attempts, 8 users and 0 orphan/duplicate checks.
- `npm run deploy` built with `CLOUDFLARE_ENV=production`, uploaded 39 changed assets and the Worker with the production bindings (`ENV=production`, `SITE_URL=https://cuetfreemocktest.com`, GA4 present, AdSense blank), and deployed version **`1f6b53d2-fdf8-4896-992f-2921524386e1`**.
- Live smoke: `/api/health` **200** `{"ok":true,"db":"ok","engine":"turso"}`; `/`, `/mock-tests`, `/sitemap.xml` and `/mock/psychology-2024-07-19-shift-1/instructions` **200**; `/ads.txt` **404**; `/practice` **301** to `/mock-tests`; `/dashboard` **303** to `/login?next=%2Fdashboard`; `/login` **200**.
- Headers: no `X-Robots-Tag: noindex` on production (the staging guard did not leak); `/api/health` and `/ads.txt` send `Cache-Control: no-store`; public pages send the expected `public, max-age` values.
- Sitemap: **235** URLs, **1** real `/q/` URL, **0** profile, **0** private/auth/attempt/result and **0** non-canonical hosts.
- `/robots.txt` serves `Allow: /` with the private paths disallowed and the canonical sitemap URL. `http://`, `www.` and the `workers.dev` host each return a single **301** to `https://cuetfreemocktest.com`; a trailing slash on `/mock-tests/` returns **301** to `/mock-tests`.
- Homepage: **0** `adsbygoogle` markers; the only external script is the Cloudflare Insights beacon. The GA4/GTM snippets are inline definitions behind the consent gate, so no analytics request fires before a choice.
- The PYQ archive serves **64** focusable `tabindex="0"` containers, so the A11Y-2 fix is live.

**Next**

- Obtain a D1-capable GitHub token, a staging admin/OAuth configuration and a DNS record for `staging.cuetfreemocktest.com` to close the operational blockers in §15.
- Re-measure the Subject Hub on production before changing the Speed Index budget.

---

## 18. Reproduction commands

```sh
# Quality gates
npm test
npm run build
npm audit
npm run perf:check
npm run seo:check
npm run lint:copy
npm run check:env
node scripts/check-links.mjs https://cuetfreemocktest.com

# Production-build preview used for Lighthouse
npx wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/state --port 4321 \
  --var USE_LOCAL_D1:1 --var SITE_URL:http://localhost:4321 --var ENV:development

# Budgeted mobile Lighthouse audit (9 routes x 3 runs, light)
npm run audit:lighthouse -- --runs=3

# Local audit when no eligible /q/ question is in the sitemap (fixtures are excluded)
$env:LIGHTHOUSE_PUBLIC_QUESTION="/q/<ten-character-public-id>"; npm run audit:lighthouse -- --runs=3

# Raw single-route run (debug only; the budgeted runner is the source of truth)
npx lighthouse http://localhost:4321/ \
  --chrome-flags="--headless --force-prefers-color-scheme=light --no-sandbox --disable-gpu" \
  --only-categories=performance,accessibility,best-practices,seo \
  --form-factor=mobile --throttling-method=simulate --quiet

# Accessibility
npm run test:a11y
```
