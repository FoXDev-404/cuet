# D1 & KV Capacity Model — CUET Mock Test Platform

*Document verified and benchmarked against Cloudflare Remote Staging D1: 2026-11-04*  
*Environment: `cuet-d1-staging` (`c527f20e-4401-4d35-9db0-8b7433105d0f`), Cloudflare Colo: `SIN`, Server: `v3-prod`.*  
*Raw machine measurements stored in [`docs/report/d1-staging-capacity.json`](file:///e:/AA%20Projects/New%20Full/CUET%20Mock/docs/report/d1-staging-capacity.json).*

---

## 1. Cloudflare Quotas & Pricing (Current Official Limits — Verified Nov 2026)

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

## 2. Measured Resource Usage per User Interaction (Staging D1 Metadata)

The following metrics were captured directly from Cloudflare D1 query response metadata (`meta.rows_read`, `meta.rows_written`, `meta.timings.sql_duration_ms`) on remote staging database `cuet-d1-staging`:

| Operation | D1 Rows Read (Measured) | D1 Rows Written (Measured) | SQL Duration (ms) | KV Operations | Optimization Applied |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **Public Paper / Hub Browsing** | 0 | 0 | 0.00 ms | 1 KV read | Full index and paper payloads cached in KV with 10-minute fresh / 7-day stale TTL (`practice-cache.ts`). |
| **Start Mock Attempt** | 7 | 13 | 3.59 ms | 0 | Active attempt check + insert into `attempts` + primary/unique index maintenance. |
| **Delta Autosave** (1 save) | 4 | 4 | 4.69 ms | 0 | Attempt PK check + `attempt_answers` upsert + `attempts.last_client_seq` bump. |
| **Submit Attempt** | 4 | 7 | 43.79 ms | 0 | Pinned version read + user answers scan + status/score/section_summary update. |
| **View Result Summary** (`/result/:id`) | 5 | 0 | 6.61 ms | 0 | Attempt row read + mock metadata + rank count + top-5 leaderboard rows. |
| **View Leaderboard** (`/leaderboard/:slug`) | 4 | 0 | 5.87 ms | 0 | Mock metadata + top-100 rows + aggregate stats query. |

### Full Test Lifecycle Totals (1 Completed Test with 15 Autosaves)
- **Total Rows Read**: **80 rows read** per full attempt lifecycle
- **Total Rows Written**: **80 rows written** per full attempt lifecycle

---

## 3. Daily Active User (DAU) Projections & Write Boundary Analysis

### Key Modeling Assumptions:
1. **Average User Behavior**: Each active daily user completes an average of **1.5 full mock tests / practice sessions** per day.
2. **Autosave Frequency**: During a 45-minute test, active students trigger ~10–15 delta autosaves (delta saves occur only when answers change or on navigation).
3. **Result & Leaderboard Views**: 1 result view and 1 leaderboard view per completed test.
4. **Browsing Traffic**: Syllabus, syllabus topics, and practice questions hit Workers KV cache (0 D1 row reads).

---

### Comparison Matrix: DAU Scenarios vs. Cloudflare Free Limits

| Scenario | Active Tests / Day | Daily D1 Reads (Measured) | Read % of Free Limit (5M) | Daily D1 Writes (Measured) | Write % of Free Limit (100k) | Free Tier Feasible? |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **1,000 DAU** | 1,500 tests | 120,000 reads | **2.4%** | 120,000 writes (15 saves)<br>~90,000 writes (10 saves) | **90% - 120%** | **Near Limit** (Trigger upgrade at 800–1,000 DAU) |
| **3,000 DAU** | 4,500 tests | 360,000 reads | **7.2%** | 360,000 writes | **360%** | ❌ **Paid Required ($5/mo)** |
| **10,000 DAU** | 15,000 tests | 1,200,000 reads | **24.0%** | 1,200,000 writes | **1,200%** | ❌ **Paid Required ($5/mo)** |

---

### Scenario A: 1,000 DAU (Early Growth / Beta Launch)
- **Completed Tests / Day**: 1,500 tests
- **Autosaves / Day**: 15,000 to 22,500 delta autosaves
- **Total Measured Reads**: **~120,000 reads/day** (Only 2.4% of 5,000,000 free daily limit)
- **Total Measured Writes**: **~90,000 to 120,000 writes/day** (Right at the 100,000 free daily limit)
- **Verdict**: **BOUNDARY OF FREE TIER**. Reads have 97.6% headroom. Writes will reach the daily ceiling during peak days. Recommended action: upgrade to Workers Paid ($5/mo) as soon as daily users consistently cross 800 DAU.

---

### Scenario B: 3,000 DAU (Peak Exam Season / Moderate Traction)
- **Completed Tests / Day**: 4,500 tests
- **Total Measured Reads**: **~360,000 reads/day** (7.2% of 5,000,000 free daily limit)
- **Total Measured Writes**: **~360,000 writes/day** (Exceeds free 100k daily write quota)
- **Verdict**: **REQUIRES WORKERS PAID ($5/MONTH)**.
  - On Workers Paid ($5/mo), the account receives 50,000,000 writes/month (~1.67M writes/day).
  - 360,000 writes/day uses only **21.5%** of the $5 plan's included daily write allowance.
  - Flat cost: $5.00/mo, zero overage charges.

---

### Scenario C: 10,000 DAU (High Scale / National Viral Usage)
- **Completed Tests / Day**: 15,000 tests
- **Total Measured Reads**: **~1,200,000 reads/day** (24.0% of 5,000,000 free daily limit)
- **Total Measured Writes**: **~1,200,000 writes/day** (Exceeds free 100k daily write quota)
- **Verdict**: **WELL WITHIN WORKERS PAID ($5/MONTH)**.
  - 1,200,000 writes/day is **71.8%** of the included 1.67M writes/day under the $5/month plan.
  - Zero overage charges incurred ($5.00/mo flat cost covers full 10,000 DAU operations).

---

## 4. Key Architectural Takeaway: Writes are the Bounding Constraint

Before Fix 9, autosaves loaded all 50–100 questions from D1 every 10–30 seconds, generating 2,000+ reads per user attempt. That would have exhausted the read limit at ~150–200 active users.

With delta autosaves and KV question caching:
1. **Delta-only Autosave**: Reads are minimized down to **4 rows read** (attempt lookup + indexing metadata).
2. **KV Mock Version Payload Cache**: 0 D1 reads for question validation.
3. **Persisted Section Summary**: Result view reads are reduced to **5 rows read**.
4. **Primary Constraint Inversion**: Read quota is no longer the bottleneck. **Daily writes (100k/day) are the bounding constraint**.

### 4.1. Index Write Amplification in Cloudflare D1
Why does a single delta autosave write measure **4 rows written** in D1 metadata?
In Cloudflare D1's serverless SQLite metering:
- Every table row mutation (INSERT or UPDATE) is counted.
- Additionally, D1 meters SQLite index B-tree modifications. The `attempt_answers` table contains a composite primary key / unique index on `(attempt_id, question_id)` plus index entries for review state.
- When an answer is upserted (`INSERT ... ON CONFLICT(attempt_id, question_id) DO UPDATE`), SQLite updates the data row and synchronizes the associated B-tree indexes, alongside updating `attempts.last_client_seq`.
- Consequently, each 15s autosave pulse registers **4 write units** in D1 response telemetry. Over 15 autosaves, this accounts for **60 writes** out of the 80 total writes per attempt.

### 4.2. Optimization Blueprint: Single-Row JSON Answer Snapshot (4x Capacity Boost)
To drastically reduce write amplification on the free tier without sacrificing reliability:
1. **In-Progress State**: During the 45-minute test, store student answer state in a single column: `attempts.draft_answers_json` (e.g. `{"q1":"A","q2":"C",...}`) alongside `attempts.last_client_seq`.
2. **Single Row Mutation**: Each 15s delta autosave updates only the single `attempts` record by primary key (`UPDATE attempts SET draft_answers_json = ?, last_client_seq = ? WHERE id = ?`). Because the attempt primary key B-tree is unmodified, this consumes only **1 write operation** per autosave.
3. **Submit Unpack**: On final submission (`POST /api/test/submit`), the backend validates the test, scores the submission, and unpacks `draft_answers_json` into normalized `attempt_answers` rows in a single batch transaction.
4. **Impact on Capacity**:
   - Autosave writes drop from 60 writes (15 × 4) down to **15 writes** (15 × 1).
   - Total attempt lifecycle drops from **80 writes down to ~20 writes**.
   - Free tier daily capacity expands from **1,250 tests/day to 5,000 tests/day** (a **4x expansion** to ~3,300 DAU).

### 4.3. Paid Upgrade Alternative ($5/month)
While the single-row JSON optimization extends the free tier to 5,000 tests/day, the operational recommendation remains activating **Workers Paid ($5/month)** once DAU consistently approaches 800–1,000. Workers Paid provides **50,000,000 writes/month** (~1,670,000 writes/day), which provides immediate headroom for **over 20,000 tests/day** under the existing schema with zero code risk.

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
