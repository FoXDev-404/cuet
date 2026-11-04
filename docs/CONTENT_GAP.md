# Platform Content Gap & Editorial Audit

*Generated from database state on 2026-11-04*
*Enforces Fix R7 Thin-Content Gate & Minimum Indexable Content Rule.*

---

## 1. Executive Summary

This audit quantifies the exact content inventory across the platform's initial catalog of 19 subjects (contrasted with the 63+ subjects in the official NTA CUET UG Information Bulletin), detailing where content is substantive, where thin pages exist, and what minimum content is required to safely qualify every subject for Google search indexing and AdSense monetization.

- **Official NTA CUET UG Subject Universe**: **63+ subjects** (Section IA & IB Languages 101–210, Section II Domain Subjects 301–329, Section III General Test 501).
- **Initial Platform Catalog (Database Schema)**: **19 subjects** (11 active domain subjects with question banks, 8 empty domain subjects with `code = NULL`).
- **Subjects with Active Question Banks**: **11 subjects** (12,066 total questions in timed bank).
- **Subjects with ZERO Questions**: **8 subjects** (Accountancy, Business Studies, Economics, Political Science, Psychology, Sociology, Fine Arts, Legal Studies).
- **Total Indexable URLs (Post-Fix R7 Thin Gate)**: **Exactly 35 high-quality URLs** (0 mismatches across 968 audited URLs).
- **Explanation Review Status**: **0% human reviewed** (16,533 `ai_draft` explanations, 1,861 questions with no explanation, 0 reviewed).
- **Unkeyed Practice Questions**: **332 questions** (retained as `correct_option IS NULL` from original scanned sources; never synthetically guessed).
- **Copyright Rights Status**: **100% unverified/unknown** (214 practice papers correctly gated with `noindex`).

---

## 2. Subject Inventory & Content Gaps

Under the **Minimum Indexable Content Rule (Fix R7)**, a subject landing page (`/cuet-mock-test/:subject`) requires at least **3 available questions** and substantive editorial guidance. Subjects with zero questions are automatically assigned `noindex` to eliminate thin-content algorithm penalties.

> [!NOTE]
> The platform schema currently lists 19 subject slugs. The 11 active subjects have short codes (`ENG`, `GT`, `CHE`, etc.), whereas the 8 empty subjects currently hold `code = NULL`. To align with official NTA standards, these should be updated with NTA 3-digit subject codes (e.g., 301 for Accountancy, 305 for Business Studies, 309 for Economics, 323 for Political Science, 324 for Psychology, 326 for Sociology, 312 for Fine Arts/Visual Arts, 317 for Legal Studies).

| Subject Name | Platform Code | NTA Code | Original Standalone Mocks | Bank Questions | PYQ Practice Papers | Indexability Status | Required Content to Qualify |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- | :--- |
| **English** | `ENG` | 101 | 0 | 1196 | 48 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **General Test** | `GT` | 501 | 0 | 1159 | 36 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Chemistry** | `CHE` | 306 | 0 | 887 | 31 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Biology** | `BIO` | 304 | 0 | 852 | 18 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Physics** | `PHY` | 322 | 0 | 677 | 26 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Mathematics** | `MAT` | 319 | 0 | 531 | 23 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **History** | `HIS` | 314 | 0 | 351 | 12 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Geography** | `GEO` | 313 | 0 | 226 | 9 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Computer Science** | `CS` | 308 | 0 | 156 | 6 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Hindi** | `HIN` | 102 | 0 | 145 | 3 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Applied Mathematics** | `APM` | 319B | 0 | 91 | 2 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Accountancy** | `null` | 301 | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Business Studies** | `null` | 305 | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Economics** | `null` | 309 | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Fine Arts** | `null` | 312 | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Legal Studies** | `null` | 317 | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Political Science** | `null` | 323 | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Psychology** | `null` | 324 | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Sociology** | `null` | 326 | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |

### Subjects with ZERO Questions (8 Subjects):
The following 8 high-demand subjects currently have zero questions in both the timed paper bank and the practice library:
- **Accountancy** (`accountancy`, NTA Code 301, current DB Code: `null`)
- **Business Studies** (`business-studies`, NTA Code 305, current DB Code: `null`)
- **Economics** (`economics`, NTA Code 309, current DB Code: `null`)
- **Fine Arts** (`fine-arts`, NTA Code 312, current DB Code: `null`)
- **Legal Studies** (`legal-studies`, NTA Code 317, current DB Code: `null`)
- **Political Science** (`political-science`, NTA Code 323, current DB Code: `null`)
- **Psychology** (`psychology`, NTA Code 324, current DB Code: `null`)
- **Sociology** (`sociology`, NTA Code 326, current DB Code: `null`)

*Recommendation for Owner:* These 8 subjects are safely `noindex` in search results and omitted from `sitemap.xml`. Do NOT index these subject hubs until at least 1 original 50-question mock test is authored and reviewed.

---

## 3. Explanation Review & Editorial Provenance

Google Quality Rater Guidelines (E-E-A-T) and platform integrity require that explanations are transparently labeled by source and review status.

### Timed Question Bank Explanations (`questions` Table):
| Explanation Status | Source | Count | Editorial Action Needed |
| :--- | :--- | :---: | :--- |
| `unreviewed` | `ai_draft` | 10,288 | Requires subject matter expert verification in /admin/review |
| `unreviewed` | `banner` | 34 | Requires subject matter expert verification in /admin/review |
| `unreviewed` | `none` | 1,861 | Requires subject matter expert authoring |

### Practice Library Explanations (`practice_questions` Table):
| Explanation Status | Source | Count | Editorial Action Needed |
| :--- | :--- | :---: | :--- |
| `unreviewed` | `ai_draft` | 6,245 | Needs editorial review |
| `unreviewed` | `banner` | 358 | Needs editorial review |
| `unreviewed` | `none` | 0 | Fully populated with initial draft or banner |

### Answer Key Provenance & 332 Unkeyed Practice Questions
- **Zero Unkeyed Questions in Timed Bank**: All 12,066 questions in `questions` have validated `correct_option` values derived from official NTA answer keys.
- **332 Unkeyed Questions in Practice Library**: 332 questions in `practice_questions` hold `correct_option IS NULL`. These derive from raw student/paper scans where official provisional keys were absent or ambiguous.
- **Strict Integrity Rule**: The platform has **never** synthetically guessed or AI-filled these 332 unkeyed answers. They remain strictly `NULL` in the database and are omitted from scoring until human reviewers confirm the key via `/admin/review`.

*Total Explanation Census*: **16,533 `ai_draft` explanations**, **1,861 questions with no explanation**, and **0 questions marked `reviewed`**. All student-facing views truthfully display an unreviewed AI draft banner.

---

## 4. Copyright & Previous-Year Paper Rights Status

Under the platform's Rights Policy Gate (Fix 3), all practice reproductions of previous-year papers must remain `noindex` until their copyright clearance status is documented.

| Rights Status | Paper Count | Search Engine Status | AdSense Ad Slot Status |
| :--- | :---: | :--- | :--- |
| `unknown` | 214 | Strictly noindex, nofollow | Strictly forbidden (adSlotAllowed = false) |

*Launch Policy:* All 214 practice papers stay `noindex` and ad-free. Only original standalone mocks authored by the platform are eligible for search indexing.

---

## 5. Indexable Page Counts by Group (Post-Fix R7)

By applying the **Minimum Indexable Content Rule (Fix R7)**, all 51 thin PYQ archive list pages have been pruned from the search index, leaving exactly **35 authoritative, content-rich URLs** in `sitemap.xml`:

| Route Group | Indexable Count | Sample URLs | Rationale |
| :--- | :---: | :--- | :--- |
| **Core Landing & Informational** | **13** | `/, /cuet-ug-mock-test, /cuet-ug-syllabus, /cuet-ug-exam-pattern, /cuet-ug-marking-scheme, /cuet-ug-previous-year-papers, /practice, /leaderboard, /about, /contact, /privacy-policy, /terms, /disclaimer` | Substantive content meeting 300+ word threshold |
| **Substantive Subject Mock Hubs** | **11** | `/cuet-mock-test/:subject (11 active subjects)` | Each has active questions and playable mocks |
| **Substantive Syllabus Guides** | **11** | `/cuet-ug-syllabus/:subject (11 active subjects)` | Comprehensive syllabus breakdowns |
| **Thin Subject Hubs (8 empty)** | **0** | `/cuet-mock-test/:subject (Accountancy, etc.)` | Gated with `noindex, nofollow`; excluded from sitemap |
| **PYQ Archive List Pages** | **0** | `/pyq/:year, /pyq/:year/:subject (51 pages)` | Gated with `noindex, nofollow`; excluded from sitemap |
| **PYQ Practice Papers** | **0** | `/practice/:id (214 papers)` | Gated with `noindex, nofollow` per rights policy gate |
| **Private & Interactive Routes** | **0** | `/attempt/*, /result/*, /dashboard/*, /admin/*, /login, /signup` | Excluded by robots directives |
| **Total Indexable URLs** | **35** | High-quality, robust pages | **0 mismatches** across 968 audited URLs |

---

## 6. Actionable Content Roadmap for Site Owner

To advance the platform from `PARTIAL` launch readiness to a full, unassailable `DONE` status:

1. **Phase 1: Seed Missing Subjects (Top Priority)**:
   - Create 1 original full-length mock (50 questions with verified step-by-step solutions) for each of the 8 empty subjects.
   - Priority sequence: Accountancy, Business Studies, Economics, Geography, History, Political Science, Psychology, Sociology.
2. **Phase 2: Explanation Review Pipeline**:
   - Use the `/admin/review` queue to verify and approve explanations for the core subjects (Physics, Chemistry, Mathematics, English, General Test).
3. **Phase 3: Original Ranked Mock Creation**:
   - Author 2 original full-length mocks per high-traffic subject to build a rich first-attempt leaderboard and unlock student retention.

---

## 6. Actionable Content Roadmap for Site Owner

To advance the platform from `PARTIAL` launch readiness to a full, unassailable `DONE` status:

1. **Phase 1: Seed Missing Subjects (Top Priority)**:
   - Create 1 original full-length mock (50 questions with verified step-by-step solutions) for each of the 8 empty subjects.
   - Priority sequence: Accountancy, Business Studies, Economics, Geography, History, Political Science, Psychology, Sociology.
2. **Phase 2: Explanation Review Pipeline**:
   - Use the `/admin/review` queue to verify and approve explanations for the core subjects (Physics, Chemistry, Mathematics, English, General Test).
3. **Phase 3: Original Ranked Mock Creation**:
   - Author 2 original full-length mocks per high-traffic subject to build a rich first-attempt leaderboard and unlock student retention.
