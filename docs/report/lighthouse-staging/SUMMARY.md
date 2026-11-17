# Lighthouse Mobile Audit Results — deployed staging

This directory holds the deployed-staging evidence only. The committed local
baseline still lives in `docs/report/lighthouse/`. Staging intentionally skips
`/admin` (no seeded staging operator) and `/q/[id]` (no public question in the
staging sitemap).

*Audited against https://cuet-astro-staging.cuet-platform.workers.dev on 2026-11-17T17:55:17.440Z*
- **Tool:** Lighthouse (via npx) 13.6.0, mobile emulation, simulated 4G throttling
- **Method:** 3 independent run(s) per route and theme; scores and metrics are medians.
- **Themes:** light
- **Environment:** Windows/Linux runner, Node.js v24.18.0, Host: Vijay-Asus
- **Budgets:** `performance-budget.json` — route transfer/score plus LCP, TBT, CLS, FCP, Speed Index and total DOM caps.

| Page | Theme | Runs | Perf [min-max] | A11y | Best Practices | SEO | LCP | TBT | CLS | Transfer | Budget |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| Home | light | 3 | **99** [99-100] | 100 | 100 | 100 | 1.19s | 0ms | 0 | 58.7 KB | PASS (/) |
| Mock Test Hub | light | 2 | **100** [100-100] | 100 | 100 | 100 | 1.09s | 0ms | 0 | 60 KB | PASS (/mock-tests) |
| Subject Hub | light | 2 | **99** [98-99] | 100 | 100 | 100 | 1.10s | 41ms | 0 | 56.1 KB | FAIL (/cuet-mock-test/english) |
| Mock Detail | light | 3 | **99** [99-99] | 100 | 100 | 69 | 1.16s | 0ms | 0 | 63 KB | PASS (/mock/[slug]) |
| Instructions | light | 2 | **100** [100-100] | 100 | 100 | 69 | 1.04s | 0ms | 0 | 53.2 KB | PASS (/mock/[slug]/instructions) |
| Attempt Screen | light | 2 | **100** [100-100] | 100 | 100 | 58 | 1.11s | 0ms | 0 | 70 KB | PASS (/attempt/[id]) |
| Result Screen | light | 2 | **100** [99-100] | 100 | 100 | 69 | 0.97s | 0ms | 0 | 63.5 KB | PASS (/result/[id]) |

## Budget results

The following checks failed:

- /cuet-mock-test/english (light): Speed Index 3818 ms exceeds 3500 ms

> `maxInitialDomNodes` is evaluated against Lighthouse's `dom-size` audit, which counts total DOM nodes. Total DOM is an upper bound for the initial count, so this check is conservative.
