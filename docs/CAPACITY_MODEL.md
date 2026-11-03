# D1 & KV Capacity Model — CUET Mock Test Platform

*Document verified and benchmarked: November 2026*  
*Benchmarks measured via `scripts/load-test.mjs` and enforced in `tests/unit/capacity-budgets.test.ts`.*

---

## 1. Cloudflare Quotas & Pricing (Current Official Limits)

The platform runs on Cloudflare Workers, Cloudflare D1 (serverless SQLite), and Cloudflare Workers KV.

### D1 Free Plan Limits (Workers Free Tier)
- **Rows Read**: **5,000,000 rows / day** (5M/day)
- **Rows Written**: **100,000 rows / day** (100k/day)
- **Storage**: **5 GB total** account storage (500 MB per database limit on free tier)
- **Reset Schedule**: Counters reset daily at **00:00 UTC**
- **Exceeded Limit Behavior**: If either read or write quotas are exceeded, D1 returns `D1_ERROR: exceeded daily row read/write limit` and rejects queries until the 00:00 UTC reset.

### Workers Paid Plan Upgrade Path ($5 / month)
- **Included Rows Read**: **25,000,000,000 rows / month** (~833M reads/day)
- **Included Rows Written**: **50,000,000 rows / month** (~1.67M writes/day)
- **Included Storage**: **10 GB** ($0.75 / GB-month beyond 10 GB)
- **Overage Rates**:
  - $0.001 per 1,000,000 rows read ($1 per billion reads)
  - $1.000 per 1,000,000 rows written ($1 per million writes)

---

## 2. Measured Resource Usage per User Interaction

Every interaction has been optimized and instrumented in `src/lib/db.ts` (`trackD1Metrics`), with row-budget assertions enforced in unit tests (`tests/unit/capacity-budgets.test.ts`).

| Operation | D1 Rows Read | D1 Rows Written | KV Operations | Optimization Applied |
| :--- | :---: | :---: | :---: | :--- |
| **Public Paper / Hub Browsing** | 0 | 0 | 1 KV read | Full index and paper payloads cached in KV with 10-minute fresh / 7-day stale TTL (`practice-cache.ts`). |
| **Start Mock Attempt** | 1 | 1 | 0 | Single PK check on active attempts; 1 row inserted into `attempts`. |
| **Delta Autosave** (15s / on change) | 1 | 1 - 2 | 0 | Server validates questions via KV mock cache (0 D1 reads); single PK lookup on `attempts`; upserts only changed question rows. |
| **Submit Attempt** | 5 - 6 | 2 - 4 | 0 | Pinned version read; answer count read; batch correctness update + single upsert for user topic stats. |
| **View Result Summary** (`/result/:id`) | 4 - 8 | 0 | 0 | Reads `attempts` (stores pre-computed `section_summary`), version metadata, single aggregate rank query, and top-5 leaderboard rows. |
| **View Leaderboard** (`/leaderboard/:slug`) | 3 - 102 | 0 | 0 | Mock metadata (1 read), top 100 rows (at most 100 reads), aggregate stats (1 read). |

### Full Test Lifecycle Totals (1 Completed Test with 15 Autosaves)
- **Rows Read**: **~25 - 35 rows read** per full test
- **Rows Written**: **~15 - 20 rows written** per full test

---

## 3. Daily Active User (DAU) Projections

### Key Modeling Assumptions:
1. **Average User Behavior**: Each active daily user completes an average of **1.5 full mock tests / practice sessions** per day.
2. **Autosave Frequency**: During a 45-minute test, active students change answers ~15–20 times (delta saves occur only when answers change, on question navigation, or on tab switch/pagehide).
3. **Result & Leaderboard Views**: 2 result views and 1 full leaderboard view per completed test.
4. **Browsing Traffic**: Syllabus, syllabus topics, and practice questions hit Workers KV cache (0 D1 row reads).

---

### Scenario A: 1,000 DAU (Early Growth / Beta Launch)
- **Completed Tests / Day**: 1,500 tests
- **Autosaves / Day**: 22,500 delta autosaves
- **Result & Leaderboard Views**: 4,500 views
- **Projected D1 Reads**:
  - Starts & Autosaves: 1,500 + 22,500 = 24,000 reads
  - Submits: 1,500 × 5 = 7,500 reads
  - Results & Leaderboards: 3,000 × 6 + 1,500 × 20 = 48,000 reads
  - **Total Reads / Day**: **~79,500 reads/day** (1.59% of 5,000,000 free daily limit)
- **Projected D1 Writes**:
  - Starts: 1,500 writes
  - Autosaves: 22,500 writes
  - Submits: 1,500 × 2 = 3,000 writes
  - **Total Writes / Day**: **~27,000 writes/day** (27.0% of 100,000 free daily limit)
- **Verdict**: **100% FREE TIER READY**. Safe operating margin of 73% write capacity and 98.4% read capacity.

---

### Scenario B: 3,000 DAU (Peak Exam Season / Moderate Traction)
- **Completed Tests / Day**: 4,500 tests
- **Autosaves / Day**: 67,500 delta autosaves
- **Projected D1 Reads**:
  - **Total Reads / Day**: **~240,000 reads/day** (4.8% of 5,000,000 free daily limit)
- **Projected D1 Writes**:
  - Starts: 4,500 writes
  - Autosaves: 67,500 writes
  - Submits: 9,000 writes
  - **Total Writes / Day**: **~81,000 writes/day** (81.0% of 100,000 free daily limit)
- **Verdict**: **APPROACHING WRITE LIMIT**. 
  - Read headroom remains immense (95.2% unused).
  - Daily writes reach 81,000 / 100,000 (81%).
  - At 3,700 DAU, writes reach 100,000/day.

---

### Scenario C: 10,000 DAU (High Scale / National Viral Usage)
- **Completed Tests / Day**: 15,000 tests
- **Autosaves / Day**: 225,000 delta autosaves
- **Projected D1 Reads**:
  - **Total Reads / Day**: **~800,000 reads/day** (16.0% of 5,000,000 free daily limit)
- **Projected D1 Writes**:
  - **Total Writes / Day**: **~270,000 writes/day** (Exceeds free 100k daily write quota)
- **Verdict**: **REQUIRES WORKERS PAID ($5/MONTH)**.
  - On Workers Paid ($5/mo), the account receives 50,000,000 writes/month (~1.67M writes/day).
  - 270,000 writes/day uses only 16.2% of the $5 plan's included writes.
  - Zero overage charges incurred ($5.00/mo flat cost covers 10,000 DAU).

---

## 4. Key Architectural Takeaway: Writes are the Bounding Constraint

Before Fix 9, autosaves loaded all 50–100 questions from D1 every 10–30 seconds, generating 2,000+ reads per user attempt. That would have caused D1 daily read quota exhaustion at only ~150–200 active users.

With Fix 9:
1. **Delta-only Autosave**: Reads are reduced from ~80 rows per autosave down to **1 row read** (PK lookup).
2. **KV Mock Version Payload Cache**: 0 D1 reads for question validation.
3. **Persisted Section Summary**: Result view reads are reduced from 50+ rows down to **4–8 rows**.
4. **Primary Constraint Inversion**: Read quota is no longer the bottleneck. **Daily writes (100k/day) are now the primary constraint**.

---

## 5. Alert Thresholds & Upgrade Triggers

To prevent unexpected service interruption, the following operational thresholds are configured:

| Metric | Free Tier Daily Limit | Yellow Alert (70%) | Red Alert / Upgrade Trigger (85%) | Action Triggered |
| :--- | :---: | :---: | :---: | :--- |
| **D1 Daily Writes** | 100,000 | 70,000 writes | **85,000 writes** | Upgrade Cloudflare account to Workers Paid ($5/mo) immediately. |
| **D1 Daily Reads** | 5,000,000 | 3,500,000 reads | 4,250,000 reads | Audit endpoint telemetry for rogue non-indexed queries. |
| **KV Media Storage** | 1 GB (Free) | 700 MB | 850 MB | Run media cleanup / asset optimization pipeline. |

### Outage Prevention Fallbacks:
- If D1 read limits are ever hit, `allOr` / `firstOr` and `practice-cache.ts` gracefully fall back to KV and bundled local JSON. The entire previous-year paper library, reading mode, and solutions view remain 100% accessible to visitors.
- Stale responses are served with `Cache-Control` headers, ensuring students never see raw 500 errors.
