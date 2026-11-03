# Appendix D: Dependencies and Security Audit

> Complete inventory of production and development dependencies, version freshness, and npm vulnerability audit.

## 1. Security Audit Summary (`npm audit`)

| Scope | Info | Low | Moderate | High | Critical | Total Vulnerabilities | Status |
|---|---|---|---|---|---|---|---|
| **Production (`--omit=dev`)** | 0 | 0 | 0 | 0 | 0 | **0** | ✅ CLEAN (0 vulnerabilities) |
| **Development & Build** | 0 | 0 | 2 | 0 | 0 | **2** | ℹ️ 2 moderate in dev dependencies |

> [!NOTE]
> Production deployment has **zero known security vulnerabilities** in its shipped dependencies.

---

## 2. Production Dependencies (`dependencies`)

| Package Name | Defined Range | Outdated / Current | Latest Available | Purpose / Role |
|---|---|---|---|---|
| `@astrojs/cloudflare` | `^14.4.3` | `14.4.3` (upgrade: `14.4.4`) | `14.4.4` | Astro web framework & Cloudflare adapter |
| `@astrojs/react` | `^7.1.2` | `^7.1.2` | `Up to date` | Astro web framework & Cloudflare adapter |
| `astro` | `^7.4.4` | `7.4.4` (upgrade: `7.4.5`) | `7.4.5` | Astro web framework & Cloudflare adapter |
| `html-to-image` | `^1.11.13` | `^1.11.13` | `Up to date` | Image generation & processing |
| `jose` | `^6.1.0` | `6.2.14` (upgrade: `6.2.15`) | `6.2.15` | Core framework |
| `katex` | `^0.19.1` | `^0.19.1` | `Up to date` | KaTeX math formula renderer |
| `react` | `^19.3.0` | `^19.3.0` | `Up to date` | React UI component engine |
| `react-dom` | `^19.3.0` | `^19.3.0` | `Up to date` | React UI component engine |
| `zod` | `^4.6.7` | `^4.6.7` | `Up to date` | Core framework |

---

## 3. Development Dependencies (`devDependencies`)

| Package Name | Defined Range | Outdated / Current | Latest Available | Purpose / Role |
|---|---|---|---|---|
| `@astrojs/check` | `^0.9.12` | `^0.9.12` | `Up to date` | Development tooling |
| `@cloudflare/workers-types` | `^5.20261031.1` | `5.20261031.1` (upgrade: `5.20261103.1`) | `5.20261103.1` | Development tooling |
| `@fontsource/inter` | `^5.3.0` | `^5.3.0` | `Up to date` | Development tooling |
| `@fontsource/noto-sans-devanagari` | `^5.3.0` | `^5.3.0` | `Up to date` | Development tooling |
| `@playwright/test` | `^1.64.1` | `^1.64.1` | `Up to date` | End-to-End browser test automation |
| `@resvg/resvg-js` | `^2.6.2` | `^2.6.2` | `Up to date` | Development tooling |
| `@tailwindcss/vite` | `^4.3.3` | `4.3.3` (upgrade: `4.3.4`) | `4.3.4` | Development tooling |
| `@types/node` | `^26.6.6` | `^26.6.6` | `Up to date` | Development tooling |
| `axe-core` | `^4.14.0` | `^4.14.0` | `Up to date` | Automated accessibility scanner |
| `satori` | `^0.63.2` | `^0.63.2` | `Up to date` | Development tooling |
| `tailwindcss` | `^4.3.3` | `4.3.3` (upgrade: `4.3.4`) | `4.3.4` | Development tooling |
| `typescript` | `^5.9.3` | `5.9.3` (upgrade: `7.0.2`) | `7.0.2` | TypeScript language compiler |
| `vitest` | `^5.0.5` | `5.0.5` (upgrade: `5.1.0`) | `5.1.0` | Unit test runner & assertions |
| `wrangler` | `^4.156.0` | `4.156.0` (upgrade: `4.157.0`) | `4.157.0` | Cloudflare Workers & D1 CLI tool |