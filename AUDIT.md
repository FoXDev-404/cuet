# CUET Free Mock Test — Audit and Improvement Log

- **Audit date:** 2026-11-17
- **Baseline commit:** `716d246` (`Refine PYQ archive ordering, routing, and SEO safeguards`)
- **Production:** <https://cuetfreemocktest.com>
- **Worker:** `cuet-astro`, deployment `2026-11-17T07:42:43Z` (matches `716d246`)
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
| Auth | Firebase Auth, Google-only | Custom Google OAuth + server sessions (`cuet_session`), guest attempts (`cuet_guest`); Google sign-in is the production path | Keep. Firebase would be a rewrite with no user-visible benefit. |
| Email | Not specified | Resend/Brevo adapters exist; production email is unconfigured and password reset is disabled | Keep disabled until a provider is chosen. |
| Ads | AdSense | Env-gated AdSense; `ADSENSE_CLIENT` and `ADSENSE_SLOT_ID` are empty in production, so ads are dormant and `/ads.txt` is 404 | Keep dormant until consent, policy and route-safety fixes ship. |
| Analytics | Not specified | GA4 `G-Y1JPT7SNQJ` and Cloudflare Web Analytics are live; no GTM, no AdSense, no Funding Choices | Add a consent gate and privacy-policy disclosure before expanding (P1-4). |
| Deploy | — | `npm run deploy` builds with the production env and runs `wrangler deploy`; production deployment matches HEAD | Keep. |

Core versions: Astro `7.4.4`, Tailwind `4.3.3`, React `19.3.0` (islands), TypeScript `5.9.3`, Vitest `5.0.5`, Playwright `1.64.1`, Wrangler `4.156.0`.

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
| `scripts/check-links.mjs` | **1 external broken** | 0/363 internal broken; 1/51 external broken (`exams.nta.ac.in/CUET-UG/` -> 404) |
| `npm run test:a11y` | **PASS** | 272/272 scans, 0 WCAG A/AA violations, 0 horizontal overflow |
| Responsive pass | **PASS** | 360/414/768/1024/1440 on `/`, `/mock-tests`, instructions, `/blog`, `/leaderboard`, PYQ archive and a live attempt: 0 overflow, exactly one H1 per page |

The refreshed `docs/report/a11y-results.json` records the 272/272 pass at commit `716d246` with `/attempt/533` as the attempt fixture.

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
- The per-route budgets in `performance-budget.json` are documented but **not enforced**. `scripts/check-perf-budget.mjs` checks only total JS/CSS; `scripts/lighthouse-audit.mjs` does not read the budget file and is stale (see P1-8).

---

## 5. Broken links and link quality

- **Internal:** 0/363 broken.
- **External:** 1/51 broken — `https://exams.nta.ac.in/CUET-UG/` returns 404. It is used six times in `migrations/0020_exam_info_seed.sql` as `exam_info.source_url`.
- Verified replacement: `https://cuet.nta.nic.in/` returns 200 (as do `https://nta.ac.in/` and `https://exams.nta.ac.in/`). Confirm the official CUET UG landing page with the exam authority before shipping.
- Fix path: add a new migration that updates `exam_info.source_url` (and update the seed for fresh databases), then re-run the link crawler.
- Orphans: `/u/[username]` public profiles are not linked from the main navigation or leaderboard and are `noindex, follow`. This may be intentional; decide whether profiles are a product surface or remove the route from public discovery (P2-11).

---

## 6. SEO findings

Strengths: every audited public page has exactly one H1, a canonical, an OG title/image and JSON-LD (except the intentionally private attempt page); hreflang is correctly absent for a single-locale site; canonical host, HTTPS and slash redirects work in production; the sitemap only emits gated, non-empty routes.

| ID | Severity | Finding | Evidence / fix |
| --- | --- | --- | --- |
| SEO-1 | P1 | `/mock-tests` has 24 non-descriptive "Start" links; SEO 92 | Lighthouse `link-text`. Add `aria-label`/visually hidden paper name, e.g. "Start English 6 August 2022 Shift 1 mock test". Keep the visible word "Start" for WCAG 2.5.3. |
| SEO-2 | P1 | Blog OG images are SVG, which major social platforms do not render | `src/lib/guides.ts:164-165` returns `/og/blog/<slug>.svg`. Generate PNG/JPEG with the existing `@resvg/resvg-js` dependency, or use a PNG fallback; validate with X/Facebook debuggers. |
| SEO-3 | P1 | Twitter card tags use `property=` instead of the standard `name=` | `src/layouts/BaseLayout.astro:230-232`. Change to `name="twitter:card"`, `name="twitter:image"`, `name="twitter:image:alt"`. |
| SEO-4 | P1 | `https://exams.nta.ac.in/CUET-UG/` is a 404 source link | See section 5. |
| SEO-5 | P2 | `/leaderboard` title is 61 characters; `/mock/...` wrapper is 61, `/instructions` 72, `/discussion` 90, `/result/527` 88 | Only `/leaderboard` is indexable; shorten it to <=60. The others are noindex/private and are low priority. |
| SEO-6 | P2 | Blog index and posts carry only `Organization` (plus `BreadcrumbList`/`Article` on posts); no `FAQPage`, `Quiz` or `LearningResource` | Add structured data only where the visible page actually supports it. Do not invent FAQs. |
| SEO-7 | P2 | Local sitemap includes 2 E2E fixture shared-question URLs | `listSeoIndexableQuestions()` in `src/lib/share/public-question-store.ts` lacks the fixture guard used for mocks in `src/pages/sitemap.xml.ts`. Add a fixture-slug filter. |
| SEO-8 | P2 | Public `/u/[username]` profiles are orphaned and noindex | Decide product intent; if discoverable, link from leaderboard/discussion and add to the sitemap; otherwise leave noindex and stop treating them as SEO pages. |
| SEO-9 | Info | Attempt/result pages are intentionally metadata-light | Do not add canonical/OG/JSON-LD to private pages. A meta description would not lift the Lighthouse cap because `is-crawlable` is already 0. |

Metadata audit details: `/signup` 301s to `/login?next=%2Fdashboard`; `/forgot-password` 301s to `/login`; both are intentional for a Google-only flow. Every other audited route has a canonical and OG image. The default OG image `https://cuetfreemocktest.com/logo.png` is live (200, `image/png`, 31,587 bytes), so the non-blog social preview path is healthy.

**Resolved in Phase 1 (SEO-1):** the 24 mock start links keep the visible label "Start" and now include the paper title as in-flow `sr-only` text, so the link inner text is "Start CUET UG … Previous Year Paper". Three mobile Lighthouse runs of `/mock-tests` after the change scored **SEO 100, performance 100, accessibility 100, best practices 100** (LCP median 936 ms, transfer unchanged at 58.8 KB). An E2E assertion covers the row's descriptive text.

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

- Home, mock list and result transfer **57-61 KB** and ship **0 KB of client JS**; the server-rendered architecture is working as intended.
- The attempt page transfers **100.7 KB** with sharing off. With sharing on it jumps to **470 KB** because `prerenderAttemptQuestionShare` fetches `share-fonts-base.json`: 492,391 bytes raw, **361.3 KB** over the wire, plus ~19 KB of JS. This violates the 300 KB attempt budget and adds 276 ms TBT.
- Root cause is the share-card font cache, not the exam UI. Production has `share_question_during_attempt=false`, so this is latent today. If the feature is enabled, it becomes a P1 regression.
- `scripts/check-perf-budget.mjs` enforces only total JS/CSS. `performance-budget.json` claims per-route transfer limits are enforced by the Lighthouse audit, but `scripts/lighthouse-audit.mjs` does not read the budget file and is stale (`/api/auth/login`, mock `439`, attempt `739`, result `740`). The route budgets are therefore decorative.
- Attempt LCP is 1.68 s and the first question image is ~37.7 KB. Preloading/fetch-prioritising the first image is a possible P2 improvement; it is already inside the 4 s budget.
- The first local health request after startup reported 17,687 rows read, consistent with the practice-library warm-up. It is cached, but cold-start Turso row reads should be monitored for cost.
- DB query profile (local): attempt start 2 queries / 59 rows read / 12 written; attempt page 5-6 queries / 7-152 rows; submit 10 queries / 346 rows read / 199 written. Query counts are well inside the invocation budget; rows are the billing metric to watch.

---

## 9. Security

Present and working:

- Security headers on production: CSP, HSTS (`max-age=31536000; includeSubDomains`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: SAMEORIGIN`, `Permissions-Policy`; `X-Robots-Tag: noindex, nofollow` on private paths.
- OAuth `state` is validated; admin RBAC is enforced server-side; session tokens are stored hashed; answer keys are not serialized into the attempt page and scoring is server-side.
- Rate limits exist for attempt start, submit, comments and media upload; admin uploads validate bytes and reject SVG; no secrets are committed.
- `SameSite=Lax`, `HttpOnly` session cookie; `Secure` in production.

Gaps:

| ID | Severity | Finding | Fix |
| --- | --- | --- | --- |
| SEC-1 | P1 | `isSameOrigin()` returns `true` when the `Origin` header is absent (`src/lib/http.ts:15-24`) | For state-changing methods, require a valid `Origin` or `Sec-Fetch-Site: same-origin`; fail closed for browser requests. Keep an explicit allowance only if a non-browser client is supported. |
| SEC-2 | P1 | `/api/attempts/[id]/answers` has no rate limit | Add a per-attempt/IP bucket (for example 120 writes/minute) and a 429 test. Autosave is debounced, so a generous limit is enough. |
| SEC-3 | P1 | Private/auth HTML has no `Cache-Control: no-store`; `/login` returns 200 without it | Add `no-store` (and `Pragma: no-cache`) for `/attempt`, `/result`, `/dashboard`, `/login`, `/reset-password`, `/verify-email`, `/admin` and authenticated API responses. Verify the edge cache already bypasses them. |
| SEC-4 | P2 | Session/guest cookie is `cuet_session` / `cuet_guest`, not `__Host-` | Rename to `__Host-cuet_session` / `__Host-cuet_guest` with `Path=/`, `Secure`, no `Domain`; this logs existing sessions out once. |
| SEC-5 | P2 | CSP allows `script-src 'unsafe-inline'` and advertises AdSense/Google ad domains even when ads are unconfigured | Move inline scripts to nonces/hashes, then drop `'unsafe-inline'`; conditionally narrow ad domains when `ADSENSE_CLIENT` is empty. |
| SEC-6 | P2 | No `Cross-Origin-Opener-Policy` or `Cross-Origin-Resource-Policy` | Add `COOP: same-origin` and `CORP: same-origin` after confirming no cross-origin embedding is required. |
| SEC-7 | P2 | Production admin auth uses the session fallback (`ADMIN_ALLOW_SESSION_IN_PROD=1`); Cloudflare Access is not configured | Enable Access, or document the accepted risk and enforce a strong password + login rate limit. Do not flip the flag without an Access app. |
| SEC-8 | P2 | `.env.example` is missing (`.dev.vars.example` exists) | Add a documented example with empty values and comments. |
| SEC-9 | P2 | `npm audit` reports 1 moderate Astro XSS advisory | Update Astro within the supported range and re-run build/tests. |

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
| ADS-5 | P2 | The submitted result page has no ad slot, although the policy allows post-test ads | Decide explicitly: add a compliant, consent-gated unit after the result summary, or document that the site intentionally serves no result ads. |
| ADS-6 | Info | `/ads.txt` returns 404 while no publisher is configured | Intentional. Add the live URL and expected record to `docs/EXTERNAL_SETUP.md`; verify after configuration. |

The AdSense loader in `BaseLayout` is correctly double-gated by `shouldServeAds()` and `adSlotAllowed()`. The attempt page bypassed both by rendering its own script. That was the defect.

**Resolved in Phase 1 (P0-1):** the attempt page no longer imports `AdSlot` or the AdSense helpers, emits no ad script and renders no unit. `/attempt` is also in `BLOCKED_AD_PATHS`, so a future `AdSlot` placement on that route still renders nothing. Verified with valid `ADSENSE_*` env vars in a preview: `/attempt/535` returned no `adsbygoogle`, `pagead2.googlesyndication.com` or ad-unit markup, while `/mock-tests` still loaded the script and unit.

---

## 11. Data, environment and deployment

- **Production is Turso, not D1.** `/api/health` returns `{"db":"ok","engine":"turso"}` and `wrangler secret list --name cuet-astro` shows `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. The production `DB` D1 binding in `wrangler.jsonc` is unused. `npm run check:migrations-remote` and `npm run db:migrate:remote` target D1, so they do **not** describe or migrate production. This must be resolved before the next schema-dependent feature.
- Decision for this cycle: keep Turso, document it as the production target, and use `db:turso:migrate` / `db:turso:verify` for production. Do not delete the D1 binding or the Turso secrets until a data migration/rollback plan exists.
- Migration `0027_practice_question_topics.sql` is not applied to production; topic pages stay unavailable until it and the CSV topic backfill are applied to Turso. This is a content launch blocker, not a UI bug.
- `npm run check:env` validates D1/KV staging/production separation only. Extend it (or add a sibling check) to assert the effective production engine and required Turso secrets.
- Local dev uses D1 and skips trailing-slash/canonical-host redirects; production uses Turso and enforces them. Local parity is P1-10.
- Production deployment `2026-11-17T07:42:43Z` matches HEAD `716d246`; no unreleased fix is live.
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
- **P1-4 — Consent and GA4 disclosure.** Add a consent gate for ads/analytics where required; update the privacy policy to name GA4 and describe the consent basis.
- **P1-5 — Private response caching.** Add `Cache-Control: no-store` to private/auth HTML and authenticated APIs.
- **P1-6 — Origin/CSRF hardening.** Fail closed when `Origin` is absent on state-changing requests, with an explicit `Sec-Fetch-Site` fallback.
- **P1-7 — Autosave rate limit.** Add a per-attempt/IP bucket to the answers endpoint and test 429 behaviour.
- **P1-8 — Performance governance.** Refresh `scripts/lighthouse-audit.mjs` (remove the removed login endpoint and hard-coded mock/attempt IDs), make it read `performance-budget.json`, and fail the run when a route exceeds its transfer/score budget or the metrics exceed the documented caps.
- **P1-9 — Turso/D1 single source of truth.** Document the production engine, update deploy/runbook commands, apply migration `0027` + topic backfill to Turso, and make `check:env` assert the effective engine. Keep D1 only as an explicit local/legacy path until a migration decision is made.
- **P1-10 — Local/production parity.** Remove the localhost exception for trailing-slash/canonical-host redirects in a test-only-safe way, or add a dedicated preview mode that matches production and document it.
- **P1-11 — Dependency advisory.** Update Astro for `GHSA-mh32-jxcr-mh9f`; re-run build/tests/a11y.
- **P1-12 — Backups.** Provision the D1/Turso backup workflow secrets and verify a restore, or document the accepted risk and manual backup runbook.
- **P1-13 — Sitemap fixture guard.** Filter E2E fixture questions from `listSeoIndexableQuestions()`.

### P2 — polish and hardening

- **P2-1 — Lazy share fonts.** If `share_question_during_attempt` is ever enabled, fetch the 361 KB font JSON only after the user opens Share, not during page idle. Promote to P1 at that moment.
- **P2-2 — Leaderboard touch targets.** Raise the 20 px links to at least 24 px.
- **P2-3 — Autosave copy.** Align "every 10 seconds" with the 15-second interval.
- **P2-4 — Title lengths.** Shorten `/leaderboard` (the only indexable page over 60 characters) to <=60; leave `/mock/...` wrapper, instructions, discussion and result titles alone unless those pages are edited.
- **P2-5 — Blog structured data.** Add `FAQPage`/`Quiz`/`LearningResource` only where the visible content supports it.
- **P2-6 — Cookie prefixes.** Move to `__Host-` names with a one-time logout.
- **P2-7 — CSP/COOP/CORP.** Replace `'unsafe-inline'` with nonces/hashes; add COOP/CORP; narrow ad domains when ads are off.
- **P2-8 — Result-page ad decision.** Add a consent-gated post-test unit or explicitly document "no result ads".
- **P2-9 — Environment docs.** Add `.env.example` alongside `.dev.vars.example`.
- **P2-10 — Attempt LCP/CLS.** Preload or fetch-prioritise the first question image; investigate the one run with CLS 0.093.
- **P2-11 — Public-profile intent.** Link profiles from leaderboard/discussion or keep them noindex and out of the sitemap.
- **P2-12 — API consistency.** Internal only: consider `/api/v1` and a consistent `{ ok, error }` envelope when the API is next touched; not worth a standalone refactor.

---

## 13. Before/after tracking

"Before" is this Phase 0 baseline. "After" is filled at close-out with the same method (mobile, light, 3-run median, production build, local D1). The attempt row uses the production-like share-off configuration; the share-on worst case is tracked separately.

| Route | Perf before | Perf after | A11y before | A11y after | BP before | BP after | SEO before | SEO after | LCP before | LCP after | TBT before | TBT after | CLS before | CLS after | Transfer before | Transfer after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| `/` | 100 | pending | 100 | pending | 100 | pending | 100 | pending | 939 ms | pending | 0 ms | pending | 0 | pending | 57.2 KB | pending |
| `/mock-tests` | 100 | pending | 100 | pending | 100 | pending | 92 | pending | 921 ms | pending | 0 ms | pending | 0 | pending | 58.8 KB | pending |
| `/attempt/:id` (share off) | 100 | pending | 100 | pending | 100 | pending | 58 | pending | 1684 ms | pending | 0 ms | pending | 0 | pending | 100.7 KB | pending |
| `/result/:id` (private) | 100 | pending | 100 | pending | 100 | pending | 69 | pending | 930 ms | pending | 0 ms | pending | 0 | pending | 61.3 KB | pending |
| `/attempt/:id` (share on, worst case) | 93 | pending | 100 | pending | 100 | pending | 58 | pending | 1734 ms | pending | 276 ms | pending | 0 | pending | 470.0 KB | pending |

---

## 14. Fixed issues log

| Phase | Issue | Fix | Verification |
| --- | --- | --- | --- |
| 0 | No product code changes yet; baseline only | Preserved `docs/AUDIT.md`; wrote this audit; refreshed `docs/report/a11y-results.json` to `716d246` / 272 scans | `npm test`, `npm run build`, a11y report, Lighthouse baseline |
| 1 | ADS-1 / P0-1: AdSense loaded on the active attempt screen, contradicting the privacy policy | Removed the AdSense `<script>`, `AdSlot` usage and unused imports/consts from `src/pages/attempt/[id].astro`; added `/attempt` to `BLOCKED_AD_PATHS`; flipped the unit expectation and added a source-level regression guard | Focused tests 15/15, full suite 543/543, build clean; preview with valid `ADSENSE_*` showed 0 ad markers on `/attempt/535` while `/mock-tests` still served AdSense |
| 1 | SEO-1: 24 non-descriptive "Start" links on `/mock-tests` (Lighthouse SEO 92) | Kept the visible "Start" label and added the paper title as `sr-only` in-flow text in `PaperRow.astro`; added an E2E assertion for the row text | Lighthouse 3/3 runs: SEO **92 -> 100**, perf/a11y/BP 100, LCP 936 ms, 58.8 KB; focused E2E passed |

Future phases append one row per fix and a short phase summary at the end of this file.

---

## 15. Remaining risks and blocked items

- AdSense is dormant, and the attempt-page violation (ADS-1) was fixed in Phase 1; ads remain off until consent, `/ads.txt` and the go-live checklist are complete.
- No GSC/Bing access: indexing, coverage and Core Web Vitals field data cannot be verified from this environment.
- No authenticated production admin/dashboard pass; admin RBAC is verified by tests and code review, not by a live production session.
- Production Turso vs local D1 means query counts, content counts and migration state can differ. Do not treat local D1 as production.
- Topic pages are blocked on migration `0027` + CSV backfill applied to Turso.
- D1 backup secrets are missing; backups are not running.
- Cloudflare Access is not configured; production admin uses the session fallback.
- Local Lighthouse excludes GA4, AdSense and edge cache; field performance may differ.
- Real iOS/Android device testing remains outstanding.
- Free-tier row-read quotas remain a cost/availability risk, especially for cold-start practice-library warm-up and submit.

---

## 16. Manual QA checklist

Use this after each phase and before the final close-out. Test at 360, 768 and 1440 px, light and dark, keyboard-only, and with a throttled mobile profile.

### Public pages

- [ ] `/` loads, exactly one H1, no horizontal scroll, primary CTA starts a mock.
- [ ] `/mock-tests` filters (search, year, subject, type, sort) work with and without JS; empty state is reachable; every "Start" link has a descriptive accessible name.
- [ ] `/mock/[slug]` wrapper canonicalises to the canonical paper; instructions page starts the exam; discussion page loads and is noindex.
- [ ] PYQ archive, subject hubs, year pages and wrong-category redirects land on the canonical paper with a 301.
- [ ] `/blog` and a blog post render; OG/Twitter preview uses a raster image; JSON-LD matches visible content.
- [ ] `/leaderboard` loads, links are readable and tappable, and an empty leaderboard is gated correctly.
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
- [ ] Autosave debounce and 15-second interval both persist; the help text matches.
- [ ] Closing/reopening the tab flushes the last dirty answer (or shows a clear warning).
- [ ] Palette navigation, mark-for-review, language toggle, timer warning and auto-submit at expiry work.
- [ ] Submit confirmation shows counts; submit scores server-side; result shows score, accuracy, subject analysis and retake CTA.
- [ ] Solutions page loads only for the owner.
- [ ] Share (if enabled) opens only on intent, does not fetch 361 KB fonts on page load, and the generated card is readable.

### Ads and privacy

- [ ] With `ADSENSE_*` empty: no AdSense script, no ad unit, `/ads.txt` 404.
- [ ] With `ADSENSE_*` set in a preview: no ad script or unit on `/attempt`, `/result`, `/dashboard`, `/login`, `/admin` or `/search`.
- [ ] Ads appear only on allowed content pages, after consent where required.
- [ ] The consent banner can accept/reject; rejection prevents personalised ads/GA4 where required.
- [ ] The privacy policy names GA4, Cloudflare Web Analytics and AdSense accurately.

### SEO and redirects

- [ ] Every indexable page has one title, description, canonical, OG title/image and valid JSON-LD.
- [ ] `/sitemap.xml` contains no fixture, private or empty routes; canonical/`og:url` match.
- [ ] `/robots.txt` disallows private paths and points to the sitemap.
- [ ] Legacy paths (`/practice*`, `/mock-test*`, `/pyq`, `/cuet-ug-previous-year-papers`, wrong-category PYQ) 301 once, not in a chain.
- [ ] Trailing slash, `www`, `http` and `workers.dev` hosts 301 to the canonical origin.
- [ ] 404 and 500 pages render useful recovery links and are noindex.

### Security and operations

- [ ] Security headers are present in production (`CSP`, `HSTS`, `nosniff`, `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`).
- [ ] Private HTML and auth responses send `Cache-Control: no-store`.
- [ ] Cross-origin POST/PUT/PATCH/DELETE is rejected; same-origin writes succeed.
- [ ] Login, attempt start, submit, answers and comments rate limits return 429 under load without locking out normal use.
- [ ] Session cookie is `HttpOnly`, `Secure`, `SameSite=Lax`, and ideally `__Host-`.
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

### Phase 1 — P0 and launch fixes (in progress)

**Done**

- **P0-1:** removed AdSense from the active attempt screen. The page no longer imports `AdSlot`/`adsenseClient`/`adsenseSlot`, emits the loader script or renders a unit; `/attempt` is blocked in `adSlotAllowed()` as a second line of defence.
- Regression coverage: `tests/unit/integrations.test.ts` now asserts `/attempt/42` and `/attempt/42/` are blocked, and a source-level guard fails if the attempt page regains `AdSlot`, `adsbygoogle` or `pagead2.googlesyndication.com`.
- Verification: focused tests 15/15, full suite **543/543**, `npm run build` clean. A preview with valid `ADSENSE_CLIENT`/`ADSENSE_SLOT_ID` served `/attempt/535` with zero ad markers (86,175 bytes) while `/mock-tests` still loaded AdSense, confirming the env vars were active and the block is route-specific.
- **P1-1 (SEO-1):** mock start links now carry the paper title as `sr-only` text while keeping the visible "Start" label. `/mock-tests` Lighthouse SEO rose from **92 to 100** on all three runs with performance/accessibility/best-practices at 100; an E2E assertion guards the row text.

**Next in this phase**

- P1-2 (social metadata), P1-3 (NTA URL), P1-5 (private cache), P1-6/P1-7 (Origin/rate limit), then re-run the affected Lighthouse routes.

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

# Mobile Lighthouse (light theme)
npx lighthouse http://localhost:4321/ \
  --chrome-flags="--headless --force-prefers-color-scheme=light --no-sandbox --disable-gpu" \
  --only-categories=performance,accessibility,best-practices,seo \
  --form-factor=mobile --throttling-method=simulate --quiet

# Accessibility
npm run test:a11y
```
