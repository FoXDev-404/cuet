# Appendix D: Dependencies & Security Audit

_Extracted from `package.json` and `package-lock.json` on 2026-11-04T20:12:11.329Z._

## Production Dependencies

| Package | Version | Purpose / Notes |
| :--- | :---: | :--- |
| `@astrojs/cloudflare` | `14.4.3` | Cloudflare Workers adapter |
| `@astrojs/react` | `^7.1.2` | Interactive client components |
| `astro` | `7.4.4` | Core web framework with SSR support |
| `html-to-image` | `^1.11.13` | Production runtime dependency |
| `jose` | `^6.1.0` | JWT verification for Cloudflare Access |
| `katex` | `0.19.1` | LaTeX math rendering for questions and formulas |
| `react` | `^19.3.0` | Interactive client components |
| `react-dom` | `^19.3.0` | Production runtime dependency |
| `zod` | `^4.6.7` | Schema validation for forms, APIs, and uploads |

## Key Development & Tooling Dependencies

| Package | Version | Purpose / Notes |
| :--- | :---: | :--- |
| `@astrojs/check` | `^0.9.12` | Astro TypeScript and template diagnostics |
| `@cloudflare/workers-types` | `^5.20261031.1` | Dev tool / testing harness |
| `@fontsource/inter` | `^5.3.0` | Dev tool / testing harness |
| `@fontsource/noto-sans-devanagari` | `^5.3.0` | Dev tool / testing harness |
| `@playwright/test` | `1.64.1` | Browser E2E test runner |
| `@resvg/resvg-js` | `^2.6.2` | Dev tool / testing harness |
| `@tailwindcss/vite` | `^4.3.3` | Dev tool / testing harness |
| `@types/node` | `^26.6.6` | Dev tool / testing harness |
| `axe-core` | `4.14.0` | Automated accessibility auditing engine |
| `satori` | `0.63.2` | SVG / OpenGraph image generation from HTML |
| `tailwindcss` | `4.3.3` | Dev tool / testing harness |
| `typescript` | `^5.9.3` | Dev tool / testing harness |
| `vitest` | `5.0.5` | Unit and integration test runner |
| `wrangler` | `4.156.0` | Cloudflare CLI for D1, KV, and Workers |

## Package Overrides & Hardening

| Package | Override Rule | Vulnerability Addressed |
| :--- | :---: | :--- |
| `fflate` | `^0.8.2` | Addressed `GHSA-px8p-9vwx-vf98` (Moderate prototype pollution in `fflate` subdependency) |

## Vulnerability Audit Summary

- **Command:** `npm audit`
- **Status:** **0 vulnerabilities found** (0 critical, 0 high, 0 moderate, 0 low)
- **Vulnerabilities Closed:** 2 moderate advisories resolved via package overrides without `--force`.