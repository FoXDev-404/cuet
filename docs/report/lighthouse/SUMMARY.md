# Lighthouse Mobile Audit Results

*Audited against http://localhost:4321 on 2026-11-19T16:24:59.627Z*
- **Tool:** Lighthouse (via npx) 13.6.0, mobile emulation, simulated 4G throttling
- **Method:** 3 independent run(s) per route and theme; scores and metrics are medians.
- **Themes:** light
- **Environment:** Windows/Linux runner, Node.js v24.18.0, Host: Vijay-Asus
- **Budgets:** `performance-budget.json` — route transfer/score plus LCP, TBT, CLS, FCP, Speed Index and total DOM caps.

| Page | Theme | Runs | Perf [min-max] | A11y | Best Practices | SEO | LCP | TBT | CLS | Transfer | Budget |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| Home | light | 3 | **100** [100-100] | 100 | 100 | 100 | 0.93s | 0ms | 0 | 57.1 KB | PASS (/) |
| Mock Test Hub | light | 3 | **100** [100-100] | 100 | 100 | 100 | 0.93s | 0ms | 0 | 58.6 KB | PASS (/mock-tests) |
| Subject Hub | light | 3 | **100** [100-100] | 100 | 100 | 100 | 0.93s | 0ms | 0 | 55.1 KB | PASS (/cuet-mock-test/english) |
| Mock Detail | light | 3 | **100** [100-100] | 100 | 100 | 69 | 0.94s | 0ms | 0 | 61.2 KB | PASS (/mock/[slug]) |
| Instructions | light | 3 | **100** [100-100] | 100 | 100 | 69 | 0.93s | 0ms | 0 | 52 KB | PASS (/mock/[slug]/instructions) |
| Attempt Screen | light | 3 | **100** [99-100] | 100 | 100 | 58 | 1.60s | 0ms | 0 | 65.9 KB | PASS (/attempt/[id]) |
| Result Screen | light | 3 | **100** [100-100] | 100 | 100 | 69 | 0.94s | 0ms | 0 | 62 KB | PASS (/result/[id]) |
| Admin Dashboard | light | 3 | **100** [100-100] | 100 | 100 | 63 | 1.09s | 0ms | 0 | 44.8 KB | PASS (/admin) |

## Budget results

All audited routes passed their budgets.

> `maxInitialDomNodes` is evaluated against Lighthouse's `dom-size` audit, which counts total DOM nodes. Total DOM is an upper bound for the initial count, so this check is conservative.
