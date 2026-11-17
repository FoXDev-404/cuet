# P1-4 — Consent gate and GA4 disclosure

- **Status:** approved (17 November 2026)
- **Date:** 17 November 2026
- **Scope:** Phase 2, P1-4 (ADS-2, ADS-3, ADS-4)

## Problem

Production loads GA4 (`G-Y1JPT7SNQJ`) unconditionally about two seconds after
load, alongside cookieless Cloudflare Web Analytics. There is no consent UI or
CMP. The privacy policy mentions Cloudflare and AdSense, but not GA4, and
promises a consent mechanism for ads that does not exist. AdSense is dormant
because `ADSENSE_CLIENT` and `ADSENSE_SLOT_ID` are empty.

## Decisions

1. **First-party opt-in gate.** No third-party CMP dependency. Optional
   analytics is denied by default and loads only after an explicit choice.
2. **Public pages only.** GA4 and the automatic banner are excluded from
   `/attempt`, `/result`, `/dashboard`, `/admin`, auth and search. Cloudflare
   Web Analytics still counts those pageviews.
3. **Ads stay off.** The owner plans to revisit advertising in 5–6 months.
   Add a code-level `ADSENSE_CMP_ACTIVE` attestation so setting only
   `ADSENSE_CLIENT`/`ADSENSE_SLOT_ID` cannot activate ads. A Google-certified
   CMP is still required at go-live.

## Design

### Consent model

- Storage: `localStorage` key `cuet_consent_v1`.
- Value: `v1:analytics=1` (allowed) or `v1:analytics=0` (rejected).
- Missing, malformed or unknown-version values mean "no decision" and no
  analytics. The banner is shown again.
- No new cookie, no server round-trip and no cache variation. HTML stays
  anonymously edge-cacheable.
- Choice applies to GA4 and GTM. Cloudflare Web Analytics is cookieless and
  remains unconditional.

Pure helpers live in `src/lib/consent.ts`:

- `CONSENT_STORAGE_KEY`
- `parseConsent(raw)` / `serializeConsent(allowed)`
- `consentRequired(env)` — true when a valid GA4 or GTM id is configured
- `consentUiAllowed(pathname)` — false on private paths

Private-path detection moves to `src/lib/private-paths.ts` and is shared with
the middleware, so consent and `no-store`/`noindex` cannot drift apart.

### UI

- `src/components/ConsentGate.astro` renders a hidden, non-modal region with
  equal-prominence **Allow analytics** and **Reject** buttons, a short
  explanation and a link to `/privacy-policy#advertising-and-analytics`.
- The banner is revealed only when an integration is configured, the path is
  public and no valid decision exists. It sits above the mobile bottom nav and
  causes no layout shift.
- `[data-open-consent]` controls in the footer and on the privacy page reopen
  the banner. They are hidden until the consent script initialises, so a
  JavaScript-disabled visitor never sees a dead control.
- Hiding the banner moves focus to the footer **Privacy choices** button.
- After a choice, a polite status message confirms it was saved.
- No dark patterns: no pre-ticked box, no implied consent, no close button that
  silently ignores the choice.

### Loading and withdrawal

- Moving the GTM/GA4 loaders out of the head into the consent component removes
  the unconditional requests.
- On first allow: store the choice, hide the banner and load immediately if the
  page is already complete; otherwise load two seconds after `load` to keep the
  initial paint budget.
- GTM: only the script tag is used. The `<noscript>` iframe is removed because
  it would otherwise load without consent.
- GA4: `gtag('js')` and `gtag('config', id)` are queued, then
  `googletagmanager.com/gtag/js` is injected.
- Withdrawal after analytics has loaded clears `_ga`, `_ga_*` and `_gid`
  cookies and reloads the page, so the already-loaded tag cannot continue to
  collect. A first-visit rejection does not reload.
- If storage is unavailable, the choice cannot be remembered, so analytics
  stays denied and the banner can reappear. The site remains fully usable.

### Ads guard

- Add `ADSENSE_CMP_ACTIVE` to `IntegrationEnv` and `src/env.d.ts`.
- `adsenseCmpActive(env)` accepts only `1`/`true`.
- `BaseLayout` requires it in addition to `shouldServeAds()` and
  `adSlotAllowed()` before emitting the AdSense loader.
- `AdSlot` requires it before rendering a unit.
- Leave `ADSENSE_CLIENT`/`ADSENSE_SLOT_ID` empty. Ads remain dormant.
- Document the go-live checklist: certified CMP live, `ADSENSE_CMP_ACTIVE=1`,
  privacy policy updated, route tests green, AdSense review complete.

### Privacy policy

- Name Google Analytics 4 (`G-Y1JPT7SNQJ`), its purpose, the `_ga`/`_ga_*`
  cookies, up to 14 months of event retention, Google's role as processor,
  international processing and the Google Analytics opt-out add-on.
- State that GA4 does not load until the visitor allows analytics, that
  rejecting keeps every feature available, and how to change or withdraw the
  choice.
- Update the cookie table and the "if neither integration is configured"
  wording.
- Add an `id="advertising-and-analytics"` anchor and a **Manage privacy
  choices** button.
- Update the visible review date and `dateModified` to 17 November 2026.

### Documentation

- `docs/EXTERNAL_SETUP.md`: new GA4 section, consent verification steps, and
  the updated AdSense/CMP checklist.
- `.dev.vars.example`: add `GA4_MEASUREMENT_ID=` and `ADSENSE_CMP_ACTIVE=`.
- `AUDIT.md`: mark ADS-2/ADS-3 resolved, record the ads decision, add the
  Phase 2 log and verification evidence.

## Test harness

The local dev server cannot receive a fake GA4 id through a process environment
variable; the Cloudflare adapter reads `.dev.vars` and `wrangler.jsonc`. To keep
the suite deterministic without editing a developer's secrets:

- Add `/dev/consent`, a development-only preview following the existing
  `/dev/styleguide` pattern (`import.meta.env.PROD` returns 404 and the
  middleware blocks `/dev/*` in production).
- The preview renders the real `ConsentGate` component with a fake
  `G-DEVTEST123` id and a manual **Privacy choices** button. `?allow=0`
  exercises the private-page suppression path.
- Playwright's shared profile seeds `v1:analytics=0` in localStorage so a
  developer who configures GA4 locally does not see the banner during unrelated
  tests. The consent spec overrides the storage state with an empty one.
- The axe audit adds `/dev/consent` only for a local base URL, so the banner is
  scanned without adding a 404 to remote audits.

## Tests

- Unit: parse/serialise/defaults, malformed and unknown-version values,
  private-path exclusions, config detection, ads guard, and source guards that
  keep the loaders behind the gate and the policy/GA4 disclosure in place.
- E2E: no Google request before consent; reject suppresses and persists;
  allow injects gtag and persists across reload; Privacy choices reopens;
  withdrawal clears and reloads; `?allow=0` never auto-shows or loads;
  JavaScript-disabled pages fail closed.
- Re-run the full axe audit including `/dev/consent`, plus Lighthouse on the
  affected public routes.

## Out of scope

- Enabling AdSense or integrating Funding Choices.
- A Google-certified CMP.
- Geo-targeted consent (`cf-ipcountry`).
- Consent for cookieless Cloudflare Web Analytics.
- GTM container configuration.

## Risks and trade-offs

- Analytics coverage drops because the default is denied. Cloudflare Web
  Analytics remains the aggregate fallback.
- The banner adds about 2–3 KB to pages where an integration is configured,
  but nothing when none is configured.
- `ADSENSE_CMP_ACTIVE` is an operator attestation, not proof that a CMP is
  live. The written checklist remains mandatory.
- Clearing localStorage or using a private window asks the visitor again.
