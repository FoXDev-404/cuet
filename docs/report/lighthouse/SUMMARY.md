# Lighthouse Mobile Audit Results

- **Tool Version:** Lighthouse 13.6.0
- **Form Factor:** Mobile (emulated screen: 360x640, dpr 2)
- **Throttling:** Simulated 4G (RTT: 150ms, Throughput: 1.6Mbps, CPU Slowdown: 4x)
- **Audit Date:** 2026-11-03T22:11:12.332Z

| Page | Theme | Perf | A11y | Best Practices | SEO | LCP | CLS | TBT | Top Issues |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| Home | light | 65 | 100 | 100 | 92 | 2.7 s | 0 | 1,590 ms | Minimize main-thread work; Links do not have descriptive text; Forced reflow |
| Home | dark | 82 | 100 | 100 | 92 | 2.5 s | 0 | 490 ms | Links do not have descriptive text; Network dependency tree; Time to Interactive |
| Hubs (Mock Test) | light | 69 | 100 | 100 | 92 | 2.1 s | 0 | 2,270 ms | Max Potential First Input Delay; Reduce initial server response time; Minimize main-thread work |
| Hubs (Mock Test) | dark | 91 | 100 | 100 | 92 | 2.2 s | 0 | 250 ms | Reduce initial server response time; Links do not have descriptive text; Page prevented back/forward cache restoration |
| Mock Detail | light | 88 | 100 | 100 | 92 | 2.3 s | 0 | 300 ms | Links do not have descriptive text; Page prevented back/forward cache restoration; Network dependency tree |
| Mock Detail | dark | 84 | 100 | 100 | 92 | 2.0 s | 0 | 530 ms | Links do not have descriptive text; Forced reflow; Network dependency tree |
| Instructions | light | 92 | 100 | 100 | 61 | 2.3 s | 0 | 170 ms | Links do not have descriptive text; Page is blocked from indexing; Forced reflow |
| Instructions | dark | 67 | 100 | 96 | 61 | 3.7 s | 0 | 550 ms | Browser errors were logged to the console; Avoid multiple page redirects; Minimize main-thread work |
| Attempt Screen | light | 53 | 100 | 100 | 50 | 21.8 s | 0 | 780 ms | Largest Contentful Paint; Reduce initial server response time; Minimize main-thread work |
| Attempt Screen | dark | 50 | 100 | 100 | 50 | 17.9 s | 0.001 | 1,020 ms | Largest Contentful Paint; Reduce initial server response time; Minimize main-thread work |
| Result Screen | light | 83 | 100 | 100 | 61 | 2.2 s | 0 | 500 ms | Reduce initial server response time; Links do not have descriptive text; Page is blocked from indexing |
| Result Screen | dark | 82 | 100 | 100 | 61 | 2.3 s | 0 | 570 ms | Reduce initial server response time; Minimize main-thread work; Links do not have descriptive text |
| Subject Page | light | 67 | 100 | 100 | 92 | 3.5 s | 0 | 650 ms | Minimize main-thread work; Links do not have descriptive text; Page prevented back/forward cache restoration |
| Subject Page | dark | 61 | 100 | 100 | 92 | 3.5 s | 0 | 1,130 ms | Minimize main-thread work; Links do not have descriptive text; Page prevented back/forward cache restoration |
| Public Question Page | light | 84 | 100 | 100 | 61 | 2.2 s | 0 | 490 ms | Links do not have descriptive text; Page is blocked from indexing; Page prevented back/forward cache restoration |
| Public Question Page | dark | 80 | 100 | 100 | 61 | 2.2 s | 0 | 670 ms | Minimize main-thread work; Links do not have descriptive text; Page is blocked from indexing |
| Admin Dashboard | light | 60 | 100 | 100 | 58 | 4.7 s | 0.002 | 870 ms | Reduce initial server response time; Minimize main-thread work; Minify JavaScript |
| Admin Dashboard | dark | 75 | 100 | 100 | 58 | 2.3 s | 0 | 860 ms | Reduce initial server response time; Minimize main-thread work; Links do not have descriptive text |
