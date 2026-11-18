# Consent banner redesign — evidence

Post-audit change (2026-11-18). Consent logic is unchanged: `cuet_consent_v1`
still stores `v1:analytics=1` / `v1:analytics=0`, GA4 loads only after **Accept**,
and no request is made before a choice. Only layout, styling, copy and the
reopen control changed.

## Before / after

| | Before (production) | After |
|---|---|---|
| Desktop 1440×900 | ~766 px wide, centred card with a heading and three lines of copy; covered the hero's paper-count line | 420×100 px card, 16 px from left and bottom; hero and both CTAs clear |
| Mobile 390×844 | 766 px wide, centred above the 4rem bottom nav, taller than needed | 366×110 px bottom sheet, 12 px side margins, 76 px above the viewport bottom (12 px above the nav) |
| Mobile 360×780 | same wide card | 336×110 px |
| Tablet 768×1024 | wide card | 420×100 px, above the bottom nav |
| Copy | heading + three lines, link could lose the space before "Privacy Policy" | two lines, icon, explicit space before the link |
| Buttons | "Allow analytics" / "Reject" | "Accept" / "Reject", equal size, 44 px tap targets on mobile |
| Reopen | footer "Privacy choices" | footer **Cookie settings** (privacy policy uses "Manage cookie settings") |

Screenshots:

- `before-desktop.png`, `before-mobile.png` — live production before the change.
- `after-desktop-light.png`, `after-desktop-dark.png` — local production build,
  1440×900.
- `after-mobile-light.png`, `after-mobile-dark.png` — 390×844.
- `after-mobile-360.png` — 360×780.

The after captures used a fresh profile, a temporary fake
`GA4_MEASUREMENT_ID="G-DEVTEST123"` in `.dev.vars` (reverted, not committed), and
read-only production Turso for page content. No analytics request is made before
a choice.

## Measurements (Playwright `boundingBox`)

```
1440x900   x=16  width=420  height=100  bottom gap=16   overlaps hero CTA=false
768x1024   width=420  height=100
390x844    x=12  width=366  height=110  bottom gap=76   (64px nav + 12px)
360x780    x=12  width=336  height=110  bottom gap=76
```

Mobile buttons are 44 px tall; desktop buttons are 36 px.

## Verification

| Check | Result |
|---|---|
| `npx playwright test tests/e2e/consent.spec.ts` | 11 passed (`consent-e2e-results.json`) |
| `npm test` | 618 passed / 70 files |
| `npm run test:a11y` | 272 scans, 0 violations, 0 overflow (includes `/dev/consent` × 2 viewports × 2 themes) |
| `npm run lint:copy` | 0 violations |
| `npm run build` | clean (`astro check` 0 errors) |

Run the focused consent suite with:

```sh
$env:PLAYWRIGHT_JSON_OUTPUT_NAME="docs/report/consent-redesign/consent-e2e-results.json"
npx playwright test tests/e2e/consent.spec.ts
```

The audit's `/dev/consent` scan now waits for `#consent-banner[data-visible="true"]`
before injecting axe, so the banner itself is covered rather than skipped as a
hidden element.
