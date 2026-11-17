# Production Subject Hub performance evidence

Deployed-origin measurement of `https://cuetfreemocktest.com/cuet-mock-test/english`
after the 2026-11-17 production release (`c604ce3`, version
`1f6b53d2-fdf8-4896-992f-2921524386e1`).

**Why this exists:** the deployed staging run failed the 3500 ms Speed Index
budget on this route. Staging intentionally skips the production edge cache
(`ENV=staging`), so the miss was suspected to be TTFB, not rendering. This run
checks the real cache path before anyone changes the budget.

**Method:** the same mobile, simulated-4G, light-theme, three-run method the
budgeted runner uses, invoked directly because only this route was in question:

```sh
npx lighthouse "https://cuetfreemocktest.com/cuet-mock-test/english" \
  --chrome-flags="--headless --force-prefers-color-scheme=light --no-sandbox --disable-gpu" \
  --output=json --output-path="subject-hub.light.runN.json" \
  --only-categories=performance,accessibility,best-practices,seo \
  --form-factor=mobile --throttling-method=simulate --quiet
```

| Run | Perf | Speed Index | LCP | FCP | TBT | CLS | TTFB |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 (cold cache) | 98 | 3534 ms | 1598 ms | 1598 ms | 0 ms | 0 | 1321 ms |
| 2 | 100 | 1491 ms | 1072 ms | 1072 ms | 0 ms | 0 | 172 ms |
| 3 | 99 | 1641 ms | 1616 ms | 1616 ms | 0 ms | 0 | 211 ms |
| **Median** | **99** | **1641 ms** | **1598 ms** | **1598 ms** | **0 ms** | **0** | **211 ms** |

**Conclusion:** on the production cache path the route is inside the 3500 ms
Speed Index budget (median 1641 ms). Run 1 populated the edge cache; runs 2-3
are the steady-state samples. The staging failure is confirmed as a
staging-only TTFB artifact. Keep the budget at 3500 ms.

A cold-cache visitor can still see ~3.5 s Speed Index on the first request after
a deployment. That is a cache-warming characteristic, not a per-visit
regression, but it is why one run per route should not gate the budget.
