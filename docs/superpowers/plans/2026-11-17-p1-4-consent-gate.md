# P1-4 Consent Gate and GA4 Disclosure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop GA4 and GTM from loading before an explicit analytics consent choice, keep ads off until a certified CMP is attested, and disclose both accurately in the privacy policy.

**Architecture:** A versioned `localStorage` choice is read by a small client script rendered from `ConsentGate.astro`. Public pages show a hidden-until-needed banner; private pages render no component and therefore load nothing. The existing server-rendered AdSense path gains an `ADSENSE_CMP_ACTIVE` attestation that defaults to off. The privacy policy and operator docs are updated in the same branch.

**Tech Stack:** Astro 7 SSR, Cloudflare Workers, Tailwind, Vitest, Playwright, axe-core.

**Spec:** `docs/plans/2026-11-17-p1-4-consent-gate.md`

## Global Constraints

- Everything stays on existing free tiers; add no runtime dependency and no third-party CMP.
- Do not break existing URLs; this work adds no redirects.
- Consent must be resolved client-side; do not server-render different HTML per consent choice or fragment the anonymous edge cache.
- No request to Google Analytics or Google Tag Manager before an explicit `Allow analytics` choice.
- GA4/GTM must never load on `/attempt`, `/result`, `/dashboard`, `/admin`, auth or `/search`.
- AdSense stays dormant. Setting only `ADSENSE_CLIENT`/`ADSENSE_SLOT_ID` must not activate the loader or ad units.
- Keep `docs/AUDIT.md` (the historical Phase A audit) unchanged; update root `AUDIT.md`.
- Follow existing Astro/Tailwind patterns and use the repo's neutral/brand/ink classes.
- Every commit stays local and carries `[skip deploy]`.
- Run `npm test` and `npm run build` before the final Phase 2 P1-4 commit.

## Review Focus

1. A visitor who ignores the banner: no Google request, no visible dead control, every feature usable.
2. Reject-then-allow and allow-then-reject: one loads once, the other clears `_ga*` and reloads with no tag.
3. A granted visitor on a private route: no automatic banner, no analytics, no manual control that could load it.
4. JavaScript disabled or storage unavailable: fail closed, banner stays hidden, no analytics request.
5. A developer or test run with GA4 configured: the shared storage state keeps unrelated tests free of the banner.

---

### Task 1: Share private-path detection

**Files:**
- Create: `src/lib/private-paths.ts`
- Modify: `src/middleware.ts`
- Create: `tests/unit/private-paths.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `NOINDEX_PREFIXES: readonly string[]` and `isPrivatePath(pathname: string): boolean`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import { isPrivatePath, NOINDEX_PREFIXES } from "../../src/lib/private-paths";

describe("private paths", () => {
  it("matches a prefix only at a segment boundary", () => {
    expect(isPrivatePath("/attempt/1")).toBe(true);
    expect(isPrivatePath("/attempt/1/")).toBe(true);
    expect(isPrivatePath("/attempting")).toBe(false);
    expect(isPrivatePath("/dashboard/history")).toBe(true);
    expect(isPrivatePath("/api/admin/users")).toBe(true);
  });

  it("keeps public content routes public", () => {
    for (const path of ["/", "/blog/a-guide", "/mock-tests", "/privacy-policy", "/q/abc123"]) {
      expect(isPrivatePath(path), path).toBe(false);
    }
  });

  it("keeps the noindex list available to the middleware", () => {
    expect(NOINDEX_PREFIXES).toContain("/attempt");
    expect(NOINDEX_PREFIXES).toContain("/api/attempts");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/private-paths.test.ts`
Expected: FAIL because `src/lib/private-paths.ts` does not exist.

- [ ] **Step 3: Move the list out of the middleware**

Create `src/lib/private-paths.ts` with the exact `NOINDEX_PREFIXES` array currently at `src/middleware.ts:27-48` and the exact `isPrivatePath` function at `src/middleware.ts:50-54`. Export both. In `src/middleware.ts`, delete the local array/function and import them:

```ts
import { isPrivatePath } from "./lib/private-paths";
```

Do not change the list contents. The consent gate and the middleware must agree on what is private.

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run tests/unit/private-paths.test.ts tests/unit/middleware-headers.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/private-paths.ts src/middleware.ts tests/unit/private-paths.test.ts
git commit -m "refactor: share private-path detection [skip deploy]"
```

---

### Task 2: Add consent decision helpers

**Files:**
- Create: `src/lib/consent.ts`
- Create: `tests/unit/consent.test.ts`

**Interfaces:**
- Consumes: `isPrivatePath` from Task 1; `ga4MeasurementId` and `gtmContainerId` from `src/lib/integrations.ts`.
- Produces:
  - `CONSENT_STORAGE_KEY = "cuet_consent_v1"`
  - `CONSENT_GRANTED = "v1:analytics=1"`
  - `CONSENT_DENIED = "v1:analytics=0"`
  - `type ConsentChoice = "granted" | "denied" | null`
  - `parseConsent(raw: string | null | undefined): ConsentChoice`
  - `serializeConsent(granted: boolean): string`
  - `consentRequired(envLike: IntegrationEnv): boolean`
  - `consentUiAllowed(pathname: string): boolean`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, it } from "vitest";
import {
  CONSENT_DENIED,
  CONSENT_GRANTED,
  CONSENT_STORAGE_KEY,
  consentRequired,
  consentUiAllowed,
  parseConsent,
  serializeConsent,
} from "../../src/lib/consent";

describe("consent decisions", () => {
  it("uses a versioned storage key and exact values", () => {
    expect(CONSENT_STORAGE_KEY).toBe("cuet_consent_v1");
    expect(CONSENT_GRANTED).toBe("v1:analytics=1");
    expect(CONSENT_DENIED).toBe("v1:analytics=0");
  });

  it("treats missing, malformed and future values as no decision", () => {
    for (const raw of [null, undefined, "", "1", "true", "v1:analytics=", "v2:analytics=1", " v1:analytics=1 "]) {
      expect(parseConsent(raw), String(raw)).toBeNull();
    }
    expect(parseConsent("v1:analytics=1")).toBe("granted");
    expect(parseConsent("v1:analytics=0")).toBe("denied");
  });

  it("serialises the two choices", () => {
    expect(serializeConsent(true)).toBe(CONSENT_GRANTED);
    expect(serializeConsent(false)).toBe(CONSENT_DENIED);
  });

  it("requires consent only for a valid GA4 or GTM id", () => {
    expect(consentRequired({ GA4_MEASUREMENT_ID: "G-Y1JPT7SNQJ" })).toBe(true);
    expect(consentRequired({ GTM_CONTAINER_ID: "GTM-P7XXQ9TF" })).toBe(true);
    expect(consentRequired({})).toBe(false);
    expect(consentRequired({ GA4_MEASUREMENT_ID: "TODO_VERIFY" })).toBe(false);
    expect(consentRequired({ ADSENSE_CLIENT: "ca-pub-1234567890123456" })).toBe(false);
  });

  it("allows the UI only on public routes", () => {
    for (const path of ["/", "/mock-tests", "/blog/a-guide", "/q/abc123", "/privacy-policy"]) {
      expect(consentUiAllowed(path), path).toBe(true);
    }
    for (const path of ["/attempt/1", "/result/1", "/dashboard", "/admin/x", "/login", "/api/x", "/dev/styleguide", "/search?q=x"]) {
      expect(consentUiAllowed(path), path).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/consent.test.ts`
Expected: FAIL because `src/lib/consent.ts` does not exist.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/consent.ts`:

```ts
import { ga4MeasurementId, gtmContainerId, type IntegrationEnv } from "./integrations";
import { isPrivatePath } from "./private-paths";

export const CONSENT_STORAGE_KEY = "cuet_consent_v1";
export const CONSENT_GRANTED = "v1:analytics=1";
export const CONSENT_DENIED = "v1:analytics=0";

export type ConsentChoice = "granted" | "denied" | null;

export function parseConsent(raw: string | null | undefined): ConsentChoice {
  if (raw === CONSENT_GRANTED) return "granted";
  if (raw === CONSENT_DENIED) return "denied";
  return null;
}

export function serializeConsent(granted: boolean): string {
  return granted ? CONSENT_GRANTED : CONSENT_DENIED;
}

export function consentRequired(envLike: IntegrationEnv): boolean {
  return Boolean(ga4MeasurementId(envLike) || gtmContainerId(envLike));
}

export function consentUiAllowed(pathname: string): boolean {
  return !isPrivatePath(pathname);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/consent.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/consent.ts tests/unit/consent.test.ts
git commit -m "feat: add consent decision helpers [skip deploy]"
```

---

### Task 3: Require a CMP attestation before ads render

**Files:**
- Modify: `src/lib/integrations.ts`
- Modify: `src/env.d.ts`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `src/components/AdSlot.astro`
- Modify: `tests/unit/integrations.test.ts`

**Interfaces:**
- Consumes: `IntegrationEnv` from `src/lib/integrations.ts`.
- Produces: `adsenseCmpActive(envLike: IntegrationEnv): boolean`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/unit/integrations.test.ts`:

```ts
it("keeps ads off until a certified CMP is attested", () => {
  expect(adsenseCmpActive({})).toBe(false);
  expect(adsenseCmpActive({ ADSENSE_CMP_ACTIVE: "" })).toBe(false);
  expect(adsenseCmpActive({ ADSENSE_CMP_ACTIVE: "0" })).toBe(false);
  expect(adsenseCmpActive({ ADSENSE_CMP_ACTIVE: "yes" })).toBe(false);
  expect(adsenseCmpActive({ ADSENSE_CMP_ACTIVE: "TODO_VERIFY" })).toBe(false);
  expect(adsenseCmpActive({ ADSENSE_CMP_ACTIVE: "1" })).toBe(true);
  expect(adsenseCmpActive({ ADSENSE_CMP_ACTIVE: "true" })).toBe(true);
});

it("requires the CMP attestation in both ad render paths", () => {
  const layout = readFileSync(resolve(process.cwd(), "src/layouts/BaseLayout.astro"), "utf8");
  expect(layout).toContain("adsenseCmpActive(env)");
  const slot = readFileSync(resolve(process.cwd(), "src/components/AdSlot.astro"), "utf8");
  expect(slot).toContain("adsenseCmpActive(env)");
});
```

Add `adsenseCmpActive` to the import list at the top of the file.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/integrations.test.ts`
Expected: FAIL because `adsenseCmpActive` is not exported and the source strings are absent.

- [ ] **Step 3: Implement the guard**

In `src/lib/integrations.ts`:

- Add `ADSENSE_CMP_ACTIVE?: string;` to `IntegrationEnv`.
- Add:

```ts
/**
 * Ads are allowed only after the operator attests that a Google-certified CMP
 * is live. The client/slot pair alone must never activate advertising.
 */
export function adsenseCmpActive(envLike: IntegrationEnv): boolean {
  const value = clean(envLike.ADSENSE_CMP_ACTIVE).toLowerCase();
  return value === "1" || value === "true";
}
```

In `src/env.d.ts`, add `ADSENSE_CMP_ACTIVE?: string;` next to `ADSENSE_SLOT_ID`.

In `src/layouts/BaseLayout.astro`, import `adsenseCmpActive` and make the ad gate:

```ts
const adsCanRender =
  shouldServeAds(ads, robots) && adSlotAllowed(path) && adsenseCmpActive(env);
const adClient = adsCanRender ? adsenseClient(env) : "";
```

In `src/components/AdSlot.astro`, import `adsenseCmpActive` and update `visible`:

```ts
const visible = Boolean(
  client && slot && adsenseCmpActive(env) && adSlotAllowed(Astro.url.pathname),
);
```

- [ ] **Step 4: Run the focused tests**

Run: `npx vitest run tests/unit/integrations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/integrations.ts src/env.d.ts src/layouts/BaseLayout.astro src/components/AdSlot.astro tests/unit/integrations.test.ts
git commit -m "fix: require CMP attestation before ads render [skip deploy]"
```

---

### Task 4: Add the consent UI, loader and test harness

**Files:**
- Create: `src/components/ConsentGate.astro`
- Create: `src/pages/dev/consent.astro`
- Modify: `src/layouts/BaseLayout.astro`
- Modify: `playwright.config.ts`
- Create: `tests/e2e/consent.spec.ts`
- Modify: `scripts/a11y-audit.mjs`
- Modify: `tests/unit/consent.test.ts`

**Interfaces:**
- Consumes: `CONSENT_DENIED`, `CONSENT_GRANTED`, `CONSENT_STORAGE_KEY` from Task 2; `isPrivatePath` from Task 1.
- Produces: `ConsentGate` with props `{ ga4Id?: string; gtmId?: string; allowAnalytics?: boolean }`; a development-only `/dev/consent` page that accepts `?allow=0`.

- [ ] **Step 1: Write the failing E2E test**

Create `tests/e2e/consent.spec.ts`:

```ts
import { expect, test } from "@playwright/test";

const PAGE = "/dev/consent";
const GTAG = 'script[src*="googletagmanager.com/gtag/js"]';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe("consent gate", () => {
  test.beforeEach(async ({ page }) => {
    await page.route("https://www.googletagmanager.com/**", (route) => route.abort());
  });

  test("shows the banner and loads nothing before a choice", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeVisible();
    await expect(page.locator(GTAG)).toHaveCount(0);
    await page.waitForTimeout(2500);
    await expect(page.locator(GTAG)).toHaveCount(0);
  });

  test("reject hides the banner, persists and never loads", async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole("button", { name: "Reject" }).click();
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await expect(page.getByRole("status")).toHaveText("Analytics rejected.");
    await page.reload();
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem("cuet_consent_v1"))).toBe("v1:analytics=0");
  });

  test("allow loads gtag once and persists across reload", async ({ page }) => {
    await page.goto(PAGE);
    await page.getByRole("button", { name: "Allow analytics" }).click();
    await expect(page.locator(GTAG)).toHaveCount(1);
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await page.reload();
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(1, { timeout: 5000 });
  });

  test("Privacy choices reopens and withdrawal clears and reloads", async ({ page, context }) => {
    await page.goto(PAGE);
    await page.getByRole("button", { name: "Allow analytics" }).click();
    await context.addCookies([
      { name: "_ga", value: "GA1.1.123", url: new URL(page.url()).origin },
    ]);
    await page.getByRole("button", { name: "Privacy choices" }).click();
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeVisible();
    const reloaded = page.waitForEvent("load");
    await page.getByRole("button", { name: "Reject" }).click();
    await reloaded;
    expect(await page.evaluate(() => localStorage.getItem("cuet_consent_v1"))).toBe("v1:analytics=0");
    expect((await context.cookies()).some((cookie) => cookie.name === "_ga")).toBe(false);
    await expect(page.locator(GTAG)).toHaveCount(0);
  });

  test("?allow=0 suppresses the component entirely", async ({ page }) => {
    await page.goto(`${PAGE}?allow=0`);
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Privacy choices" })).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(0);
  });
});

test.describe("consent without JavaScript", () => {
  test.use({ javaScriptEnabled: false, storageState: { cookies: [], origins: [] } });

  test("fails closed", async ({ page }) => {
    await page.goto(PAGE);
    await expect(page.getByRole("region", { name: "Privacy choices" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Privacy choices" })).toBeHidden();
    await expect(page.locator(GTAG)).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx playwright test tests/e2e/consent.spec.ts`
Expected: FAIL because `/dev/consent` returns 404.

- [ ] **Step 3: Implement the component**

Create `src/components/ConsentGate.astro` with:

- Props `ga4Id = ""`, `gtmId = ""`, `allowAnalytics = true`.
- `const active = allowAnalytics && Boolean(ga4Id || gtmId);`
- Render nothing when `!active`.
- When active, render:
  - `<p id="consent-status" role="status" aria-live="polite" class="sr-only"></p>`
  - `<aside id="consent-banner" role="region" aria-labelledby="consent-banner-title" hidden class="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 px-3 lg:bottom-4 lg:px-4">`
  - Inside: a `max-w-3xl` card with `border-neutral-200 bg-white dark:border-white/10 dark:bg-ink-950`, a `consent-banner-title` heading "Your privacy choices", the explanation from the design doc, a link to `/privacy-policy#advertising-and-analytics`, and two equal-weight buttons: `data-consent-choice="granted"` labelled "Allow analytics" and `data-consent-choice="denied"` labelled "Reject".
  - An inline `<script is:inline define:vars={{ CONSENT_STORAGE_KEY, CONSENT_GRANTED, CONSENT_DENIED, ga4Id, gtmId }}>` that:
    - Reads the stored value; missing/malformed means no decision.
    - Reveals every `[data-open-consent]` element by removing `hidden` and setting `aria-expanded="false"`.
    - Wires `[data-open-consent]` click handlers to show the banner and set `aria-expanded="true"` on all openers.
    - Wires `[data-consent-choice]` handlers:
      - Write `CONSENT_GRANTED` or `CONSENT_DENIED` to `localStorage` in a try/catch.
      - Set the status text to "Analytics allowed." or "Analytics rejected."
      - Hide the banner, set `aria-expanded="false"` and move focus to the first opener.
      - On grant, load analytics; on denial after analytics was loaded, clear `_ga`, `_ga_*` and `_gid` cookies and `location.reload()`.
    - On init: if stored granted, load analytics; if no decision, show the banner automatically.
    - `loadAnalytics()` loads GTM when `gtmId` is set (script only, no `<noscript>` iframe); otherwise loads GA4 by defining `gtag`, queueing `js`/`config`, and injecting `https://www.googletagmanager.com/gtag/js?id=<id>` immediately when `document.readyState === "complete"`, or after `load` + 2 seconds.
    - Uses `encodeURIComponent` on the ids in the URLs.
    - Never loads when GTM/GA4 ids are both empty.
- Keep the script dependency-free and ES5-compatible (`var`, function declarations) like the existing inline scripts.

- [ ] **Step 4: Wire it into `BaseLayout.astro`**

- Import `ConsentGate` and `isPrivatePath`.
- Keep the validated `ga4Id`/`gtmId` logic.
- Delete the two head blocks that begin `{gtmId ? (` and `{ga4Id ? (` and the GTM `<noscript>` iframe.
- Add `const analyticsPathAllowed = !isPrivatePath(path);`.
- In the footer's legal-links `div`, add when `Boolean(ga4Id || gtmId)`:

```astro
<button
  type="button"
  data-open-consent
  aria-controls="consent-banner"
  aria-expanded="false"
  hidden
  class="cursor-pointer hover:text-white/70"
>
  Privacy choices
</button>
```

- Before the production service-worker script, render:

```astro
<ConsentGate ga4Id={ga4Id} gtmId={gtmId} allowAnalytics={analyticsPathAllowed} />
```

- Leave the Cloudflare Web Analytics beacon and all AdSense code unchanged except the Task 3 guard.

- [ ] **Step 5: Add the development-only preview**

Create `src/pages/dev/consent.astro`:

```astro
---
import "../../styles/global.css";
import ConsentGate from "../../components/ConsentGate.astro";

if (import.meta.env.PROD) {
  return new Response("Not found", { status: 404 });
}

const allow = Astro.url.searchParams.get("allow") !== "0";
---

<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Consent gate preview</title>
  </head>
  <body class="min-h-screen bg-neutral-50 p-6 text-neutral-900">
    <main class="mx-auto max-w-2xl">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-500">Internal · not indexed</p>
      <h1 class="mt-2 text-2xl font-black">Consent gate preview</h1>
      <p class="mt-2 text-sm text-neutral-600">
        The real consent component with a fake GA4 id. Development only.
      </p>
      <button
        type="button"
        data-open-consent
        aria-controls="consent-banner"
        aria-expanded="false"
        hidden
        class="mt-6 cursor-pointer rounded-lg border border-neutral-300 px-3 py-1.5 text-xs font-semibold"
      >
        Privacy choices
      </button>
    </main>
    <ConsentGate ga4Id="G-DEVTEST123" allowAnalytics={allow} />
  </body>
</html>
```

- [ ] **Step 6: Seed a rejected choice in the Playwright profile**

In `playwright.config.ts`, build:

```ts
const consentStorageState = {
  cookies: [],
  origins: [
    {
      origin,
      localStorage: [{ name: "cuet_consent_v1", value: "v1:analytics=0" }],
    },
  ],
};
```

and add `storageState: consentStorageState` to `use`. This prevents a locally configured GA4 from showing the banner during unrelated tests. The consent spec overrides it.

- [ ] **Step 7: Add the banner to the local axe audit**

In `scripts/a11y-audit.mjs`, immediately after `STATIC_PUBLIC_PATHS`:

```js
if (isLocalBase) STATIC_PUBLIC_PATHS.push("/dev/consent");
```

Do not add it for remote audits, where the dev route is a 404.

- [ ] **Step 8: Add source guards**

Append to `tests/unit/consent.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("keeps the loaders out of BaseLayout and behind the consent component", () => {
  const layout = readFileSync(resolve(process.cwd(), "src/layouts/BaseLayout.astro"), "utf8");
  expect(layout).toContain("<ConsentGate");
  expect(layout).not.toContain('gtag("config"');
  expect(layout).not.toContain("googletagmanager.com/gtm.js");
  const gate = readFileSync(resolve(process.cwd(), "src/components/ConsentGate.astro"), "utf8");
  expect(gate).toContain("localStorage.getItem");
  expect(gate).toContain("googletagmanager.com/gtag/js");
  expect(gate).toContain("location.reload()");
  expect(gate).toContain('data-open-consent');
});
```

- [ ] **Step 9: Run the focused tests**

Run: `npx playwright test tests/e2e/consent.spec.ts`
Expected: PASS (7 tests).

Run: `npx vitest run tests/unit/consent.test.ts`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/ConsentGate.astro src/pages/dev/consent.astro src/layouts/BaseLayout.astro playwright.config.ts tests/e2e/consent.spec.ts scripts/a11y-audit.mjs tests/unit/consent.test.ts
git commit -m "feat: gate Google Analytics behind consent [skip deploy]"
```

---

### Task 5: Disclose GA4 and document the ads gate

**Files:**
- Modify: `src/pages/privacy-policy.astro`
- Modify: `docs/EXTERNAL_SETUP.md`
- Modify: `docs/LAUNCH-RUNBOOK.md`
- Modify: `.dev.vars.example`
- Modify: `tests/unit/consent.test.ts`

**Interfaces:**
- Consumes: the copy and anchors from the design doc.
- Produces: an accurate policy and operator checklist; no runtime interface changes.

- [ ] **Step 1: Write the failing policy guard**

Append to `tests/unit/consent.test.ts`:

```ts
it("discloses GA4, the consent basis and the ads gate", () => {
  const policy = readFileSync(resolve(process.cwd(), "src/pages/privacy-policy.astro"), "utf8");
  expect(policy).toContain("Google Analytics 4");
  expect(policy).toContain("G-Y1JPT7SNQJ");
  expect(policy).toContain('id="advertising-and-analytics"');
  expect(policy).toContain("data-open-consent");
  expect(policy).toContain("Google-certified consent management platform");
  expect(policy).not.toContain("If neither integration is configured");
  const setup = readFileSync(resolve(process.cwd(), "docs/EXTERNAL_SETUP.md"), "utf8");
  expect(setup).toContain("GA4_MEASUREMENT_ID");
  expect(setup).toContain("ADSENSE_CMP_ACTIVE");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/consent.test.ts`
Expected: FAIL on the policy assertions.

- [ ] **Step 3: Update the privacy policy**

In `src/pages/privacy-policy.astro`:

- Change `PageHero updated` to `17 November 2026` and `dateModified` to `2026-11-17`.
- Update the intro to name cookieless Cloudflare analytics, optional GA4 that loads only with consent, and advertising that is not currently enabled.
- Section 2: add the optional analytics bullet. State that page views, approximate location derived from IP, device/browser information and a random client identifier are sent; name, email, answers and scores are not.
- Section 3: add the GA4 cookie rows `_ga` and `_ga_*` (up to 2 years) marked "set only after you allow analytics"; mention that Google may set additional short-lived identifiers for the same purpose. Add that `cuet_consent_v1` in localStorage stores the choice and is not sent to the server.
- Section 4: add the analytics purpose.
- Section 5: add consent for optional analytics and withdrawal.
- Section 6: add Google as the analytics processor.
- Section 7: add GA4 event retention (up to 14 months) and the consent choice lifetime.
- Section 9: add the Privacy choices withdrawal path.
- Replace section 11 with the three-part copy from `docs/plans/2026-11-17-p1-4-consent-gate.md`: Cloudflare Web Analytics; Google Analytics 4 (measurement ID, cookies, data, retention, international processing, consent basis, private-route exclusion, withdrawal, Google opt-out add-on and privacy policy links); and Advertising (currently off; future AdSense only on selected public content pages; certified CMP required; analytics consent is not advertising consent). Add `id="advertising-and-analytics"` and the `data-open-consent` "Manage privacy choices" button.
- Keep the existing statements that the active test screen never loads advertising and that ads are never placed on private/thin routes.

- [ ] **Step 4: Update the operator docs**

In `.dev.vars.example`, add:

```dotenv
# Google Analytics 4 (optional). GA4 loads only after a visitor allows it.
GA4_MEASUREMENT_ID=

# Set to 1 only after a Google-certified CMP is live; ads stay off otherwise.
ADSENSE_CMP_ACTIVE=
```

In `docs/EXTERNAL_SETUP.md`:

- Add `GA4_MEASUREMENT_ID` and `ADSENSE_CMP_ACTIVE` rows to the variable table. Say GA4 emits nothing when empty and that ads emit nothing without the CMP attestation.
- Add a "Google Analytics 4 and consent" section (renumber the following sections if needed) covering: where to find the measurement ID; GTM-vs-direct GA4 suppression; the localStorage key and public-page scope; the verification steps (no gtag request before the choice, request after Allow, none after Reject + reload, footer control reopens); the private-route exclusion; and the fact that this is not a certified CMP.
- In the AdSense section, add `ADSENSE_CMP_ACTIVE=1` after the CMP step, explain it is an attestation rather than proof, and state that ads remain off now. Keep the route checks.
- Update the verification checklist with the consent and ads-guard checks.

In `docs/LAUNCH-RUNBOOK.md`:

- In the Search Console/analytics section, add the GA4 environment variable and the consent verification.
- In the AdSense section, add the certified CMP step and `ADSENSE_CMP_ACTIVE=1`, and note that setting only the client/slot is no longer sufficient.

- [ ] **Step 5: Run the policy guard and copy checks**

Run: `npx vitest run tests/unit/consent.test.ts tests/unit/copy-lint.test.ts tests/unit/seo-consistency.test.ts`
Expected: PASS. Fix any copy-lint findings in the new policy text.

- [ ] **Step 6: Commit**

```bash
git add src/pages/privacy-policy.astro docs/EXTERNAL_SETUP.md docs/LAUNCH-RUNBOOK.md .dev.vars.example tests/unit/consent.test.ts
git commit -m "docs: disclose GA4 consent and ads gate [skip deploy]"
```

---

### Task 6: Run the full gates and record P1-4

**Files:**
- Modify: `AUDIT.md`

**Interfaces:**
- Consumes: all previous tasks.
- Produces: audit evidence for P1-4 and an explicit pointer to the still-pending P1-8.

- [ ] **Step 1: Run the unit suite**

Run: `npm test`
Expected: all tests pass, including the new private-path, consent and ads-guard tests.

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: clean `astro check` and build; no unresolved imports or type errors.

- [ ] **Step 3: Run the full E2E suite**

Run: `npx playwright test`
Expected: all tests pass. Focused runs overwrite `docs/report/playwright-results.json`; restore it with `git checkout -- docs/report/playwright-results.json` if needed.

- [ ] **Step 4: Run the axe audit**

Start the dev server with local D1:

```powershell
$env:USE_LOCAL_D1="1"; npm run dev
```

In another shell run the audit command from `package.json` (normally `npm run test:a11y`). Confirm 0 violations and 0 overflow, including the new `/dev/consent` scan. Stop the dev server.

- [ ] **Step 5: Re-measure the affected Lighthouse routes**

Build and start the preview with the existing Phase 1 command (`npx wrangler dev --config dist/server/wrangler.json --persist-to .wrangler/state --port 4321 --var USE_LOCAL_D1:1 --var SITE_URL:http://localhost:4321 --var ENV:development`). Run mobile light Lighthouse three times on `/` and `/privacy-policy`, and record the medians. Because local GA4 is empty, the consent component renders nothing; expect the existing Phase 1 numbers to stay within noise and the policy page to stay within its transfer budget.

- [ ] **Step 6: Update `AUDIT.md`**

- §10: add a "Resolved in Phase 2 (P1-4)" paragraph covering ADS-2 (opt-in gate, public-only scope, Cloudflare fallback), ADS-3 (GA4 disclosure, cookies, retention, opt-out, date), and ADS-4 (`ADSENSE_CMP_ACTIVE` guard; ads intentionally off for 5–6 months; certified CMP still required). Note that `AdSlot` and the loader now both require the attestation.
- §12: mark P1-4 done and leave P1-8 as the next Phase 2 item.
- §13: add the measured after numbers and a note that the local build does not include GA4, so the gate adds no local requests; state the configured-page markup cost if measured.
- §15: add the analytics-undercount, localStorage-clearing, CMP-attestation and banner-weight risks.
- §16: add the consent QA checks (ignore/allow/reject/persist/withdraw/no-JS/private route/policy/ads-off-with-client-and-slot).
- §17: append a Phase 2 P1-4 entry with date, commit hashes and verification results; state that Phase 2 continues with P1-8.

- [ ] **Step 7: Commit**

```bash
git add AUDIT.md
git commit -m "docs: record P1-4 consent work [skip deploy]"
```

---

## Self-Review Notes

- Spec coverage: storage model (Task 2), UI/loader (Task 4), private-page scope (Tasks 1, 2, 4), withdrawal (Task 4), ads guard (Task 3), policy (Task 5), docs (Task 5), verification (Task 6), dev harness (Task 4).
- Type consistency: `ConsentChoice`, `CONSENT_*`, `consentRequired`, `consentUiAllowed`, `adsenseCmpActive` and the `ConsentGate` props are used with the same names in every task.
- Deliberately deferred: P1-8 performance governance, a certified CMP, AdSense activation, geo-targeting and consent for Cloudflare Web Analytics.
