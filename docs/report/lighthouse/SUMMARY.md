# Lighthouse Mobile Audit Results

- **Tool Version:** Lighthouse 13.6.0
- **Form Factor:** Mobile (emulated screen: 360x640, dpr 2)
- **Throttling:** Simulated 4G (RTT: 150ms, Throughput: 1.6Mbps, CPU Slowdown: 4x)
- **Audit Date:** 2026-11-03T22:18:33.300Z

| Page | Theme | Perf | A11y | Best Practices | SEO | LCP | CLS | TBT | Top Issues |
| :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :--- |
| Home | light | 78 | 100 | 100 | 92 | 2.5 s | 0 | 630 ms | Reduce initial server response time; Links do not have descriptive text; Page prevented back/forward cache restoration |
| Home | dark | 75 | 100 | 100 | 92 | 2.6 s | 0 | 770 ms | Reduce initial server response time; Minimize main-thread work; Links do not have descriptive text |
| Hubs (Mock Test) | light | 74 | 100 | 100 | 92 | 2.2 s | 0 | 910 ms | Reduce initial server response time; Minimize main-thread work; Links do not have descriptive text |
| Hubs (Mock Test) | dark | 70 | 100 | 100 | 92 | 2.7 s | 0.001 | 1,140 ms | Reduce initial server response time; Minimize main-thread work; Minify JavaScript |
| Mock Detail | light | 79 | 100 | 100 | 92 | 2.3 s | 0.001 | 690 ms | Reduce initial server response time; Minimize main-thread work; Links do not have descriptive text |
| Mock Detail | dark | 49 | 100 | 96 | 92 | 5.2 s | 0 | 760 ms | Browser errors were logged to the console; Reduce initial server response time; Avoid multiple page redirects |
| Instructions | light | 63 | 100 | 96 | 61 | 4.4 s | 0 | 430 ms | Browser errors were logged to the console; Reduce initial server response time; Avoid multiple page redirects |
| Instructions | dark | 62 | 100 | 96 | 61 | 3.7 s | 0 | 800 ms | Browser errors were logged to the console; Avoid multiple page redirects; Minimize main-thread work |
| Attempt Screen | light | 46 | 100 | 100 | 50 | 16.9 s | 0.001 | 1,300 ms | Largest Contentful Paint; Reduce initial server response time; Minimize main-thread work |
| Attempt Screen | dark | 47 | 100 | 100 | 50 | 16.5 s | 0.001 | 1,140 ms | Largest Contentful Paint; Reduce initial server response time; Minimize main-thread work |
| Result Screen | light | 74 | 100 | 100 | 61 | 2.3 s | 0 | 1,010 ms | Reduce initial server response time; Minimize main-thread work; Links do not have descriptive text |
| Result Screen | dark | 73 | 100 | 100 | 61 | 2.7 s | 0 | 720 ms | Reduce initial server response time; Minimize main-thread work; Links do not have descriptive text |
| Subject Page | light | 44 | 100 | 100 | 92 | 4.1 s | 0.001 | 3,040 ms | Max Potential First Input Delay; Reduce initial server response time; Minimize main-thread work |
| Subject Page | dark | 61 | 100 | 100 | 92 | 4.1 s | 0.001 | 670 ms | Reduce initial server response time; Minimize main-thread work; Minify JavaScript |
| Public Question Page | light | 76 | 100 | 100 | 61 | 3.1 s | 0 | 580 ms | Reduce initial server response time; Minimize main-thread work; Minify JavaScript |
| Public Question Page | dark | 48 | 100 | 100 | 61 | 4.2 s | 0.001 | 1,890 ms | Reduce initial server response time; Avoid multiple page redirects; Minimize main-thread work |
| Admin Dashboard | light | 83 | 100 | 100 | 58 | 2.3 s | 0 | 460 ms | Reduce initial server response time; Minimize main-thread work; Links do not have descriptive text |
| Admin Dashboard | dark | 82 | 100 | 100 | 58 | 2.3 s | 0 | 550 ms | Minimize main-thread work; Links do not have descriptive text; Page is blocked from indexing |
