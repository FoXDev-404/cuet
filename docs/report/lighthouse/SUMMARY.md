# Lighthouse Mobile Audit Results (Median Across 5 Runs)

*Audited against Production Build (`wrangler dev` on `dist/`) on 2026-11-04T11:52:36.469Z*
- **Tool Version:** Lighthouse v13.6.0
- **Form Factor:** Mobile (emulated screen: 360x640, dpr 2)
- **Throttling:** Simulated 4G (RTT: 150ms, Throughput: 1.6Mbps, CPU Slowdown: 4x)
- **Environment:** Windows, Node.js v24.18.0, Host: Vijay-Asus
- **Methodology:** 5 independent runs per route and theme. Scores, LCP, and TBT report the **MEDIAN** value with min-max spread.

| Page | Theme | Runs | Perf (Median [min-max]) | A11y | Best Practices | SEO | LCP (Median) | CLS | TBT (Median) | Top Issues |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| Home | light | 5 | **100** [89-100] | 100 | 100 | 100 | 0.9s | 0.000 | 0ms | Network dependency tree; Render-blocking requests; Max Potential First Input Delay |
| Home | dark | 5 | **100** [100-100] | 100 | 100 | 100 | 0.9s | 0.000 | 0ms | Network dependency tree; Render-blocking requests |
| Hubs (Mock Test) | light | 5 | **100** [100-100] | 100 | 100 | 100 | 0.9s | 0.000 | 0ms | Network dependency tree; Render-blocking requests |
| Hubs (Mock Test) | dark | 5 | **100** [100-100] | 100 | 100 | 100 | 0.9s | 0.000 | 0ms | Network dependency tree; Render-blocking requests |
| Mock Detail | light | 5 | **100** [100-100] | 100 | 100 | 69 | 0.9s | 0.000 | 0ms | Page is blocked from indexing; Network dependency tree |
| Mock Detail | dark | 5 | **100** [100-100] | 100 | 100 | 69 | 0.9s | 0.000 | 0ms | Page is blocked from indexing; Page prevented back/forward cache restoration |
| Instructions | light | 5 | **100** [100-100] | 100 | 100 | 69 | 0.9s | 0.000 | 0ms | Page is blocked from indexing; Network dependency tree |
| Instructions | dark | 5 | **100** [100-100] | 100 | 100 | 69 | 0.9s | 0.000 | 0ms | Page is blocked from indexing; Network dependency tree |
| Attempt Screen | light | 5 | **100** [99-100] | 100 | 96 | 58 | 1.6s | 0.003 | 0ms | Serves images with low resolution; Document does not have a meta description |
| Attempt Screen | dark | 5 | **100** [100-100] | 100 | 96 | 58 | 1.6s | 0.000 | 0ms | Serves images with low resolution; Document does not have a meta description |
| Result Screen | light | 5 | **100** [100-100] | 96 | 100 | 69 | 0.9s | 0.000 | 0ms | Background and foreground colors do not have a sufficient contrast ratio.; Page is blocked from indexing |
| Result Screen | dark | 5 | **100** [100-100] | 96 | 100 | 69 | 0.9s | 0.000 | 0ms | Background and foreground colors do not have a sufficient contrast ratio.; Page is blocked from indexing |
| Subject Page | light | 5 | **100** [100-100] | 100 | 100 | 100 | 0.9s | 0.000 | 0ms | Network dependency tree; Render-blocking requests |
| Subject Page | dark | 5 | **100** [100-100] | 100 | 100 | 100 | 0.9s | 0.000 | 0ms | Network dependency tree; Render-blocking requests |
| Public Question Page | light | 5 | **100** [100-100] | 100 | 100 | 69 | 0.9s | 0.000 | 0ms | Page is blocked from indexing; Network dependency tree |
| Public Question Page | dark | 5 | **100** [100-100] | 100 | 100 | 69 | 0.9s | 0.000 | 0ms | Page is blocked from indexing; Network dependency tree; Forced reflow |
| Admin Dashboard | light | 5 | **100** [100-100] | 100 | 100 | 66 | 0.9s | 0.000 | 0ms | Page is blocked from indexing; Network dependency tree |
| Admin Dashboard | dark | 5 | **100** [100-100] | 100 | 100 | 66 | 0.9s | 0.000 | 0ms | Page is blocked from indexing; Network dependency tree |

## Performance Budget Verification

| Route | Target LCP Budget | Measured LCP (Median) | Target TBT Budget | Measured TBT (Median) | Budget Status |
| :--- | :---: | :---: | :---: | :---: | :--- |
| Home | <= 4.0s | 0.9s | <= 600ms | 0ms | PASS |
| Hubs (Mock Test) | <= 4.0s | 0.9s | <= 600ms | 0ms | PASS |
| Mock Detail | <= 4.0s | 0.9s | <= 600ms | 0ms | PASS |
| Instructions | <= 4.0s | 0.9s | <= 600ms | 0ms | PASS |
| Attempt Screen | <= 4.0s | 1.6s | <= 600ms | 0ms | PASS |
| Result Screen | <= 4.0s | 0.9s | <= 600ms | 0ms | PASS |
| Subject Page | <= 4.0s | 0.9s | <= 600ms | 0ms | PASS |
| Public Question Page | <= 4.0s | 0.9s | <= 600ms | 0ms | PASS |
| Admin Dashboard | <= 4.0s | 0.9s | <= 600ms | 0ms | PASS |
