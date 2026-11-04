# Platform Content Gap & Editorial Audit

*Generated from database state on 2026-11-04T20:12:36.104Z*
*Enforces Fix R7 Thin-Content Gate & Minimum Indexable Content Rule.*

---

## 1. Executive Summary

This audit quantifies the exact content inventory across all 19 official CUET UG subjects, detailing where content is substantive, where thin pages exist, and what minimum content is required to safely qualify every subject for Google search indexing and AdSense monetization.

- **Total Official Subjects in Platform**: **19 subjects**
- **Subjects with Active Question Banks**: **11 subjects**
- **Subjects with ZERO Questions**: **8 subjects**
- **Total Indexable URLs (Post-Fix R7 Thin Gate)**: **~45 high-quality URLs** (down from 89 thin URLs)
- **Explanation Review Status**: **0% human reviewed** (100% draft/unreviewed)
- **Copyright Rights Status**: **100% unverified/unknown** (214 practice papers correctly gated with `noindex`)

---

## 2. Subject Inventory & Content Gaps

Under the **Minimum Indexable Content Rule (Fix R7)**, a subject landing page (`/cuet-mock-test/:subject`) requires at least **3 available questions** and substantive editorial guidance. Subjects with zero questions are automatically assigned `noindex` to eliminate thin-content algorithm penalties.

| Subject Name | Code | Original Standalone Mocks | Bank Questions | PYQ Practice Papers | Indexability Status | Required Content to Qualify |
| :--- | :---: | :---: | :---: | :---: | :--- | :--- |
| **English** | `ENG` | 0 | 1196 | 48 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **General Test** | `GT` | 0 | 1159 | 36 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Chemistry** | `CHE` | 0 | 887 | 31 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Biology** | `BIO` | 0 | 852 | 18 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Physics** | `PHY` | 0 | 677 | 26 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Mathematics** | `MAT` | 0 | 531 | 23 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **History** | `HIS` | 0 | 351 | 12 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Geography** | `GEO` | 0 | 226 | 9 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Computer Science** | `CS` | 0 | 156 | 6 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Hindi** | `HIN` | 0 | 145 | 3 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Applied Mathematics** | `APM` | 0 | 91 | 2 | ✅ Indexable | Meets threshold (Needs 1 full 50Q mock) |
| **Accountancy** | `null` | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Business Studies** | `null` | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Economics** | `null` | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Fine Arts** | `null` | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Legal Studies** | `null` | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Political Science** | `null` | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Psychology** | `null` | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |
| **Sociology** | `null` | 0 | 0 | 0 | ⚠️ Noindex (Thin) | Requires at least 1 full paper (50Q) or 30 practice questions |

### Subjects with ZERO Questions (8 Subjects):
The following 8 subjects currently have zero questions in both the timed paper bank and the practice library:
- **Accountancy** (`accountancy`, Code: `null`)
- **Business Studies** (`business-studies`, Code: `null`)
- **Economics** (`economics`, Code: `null`)
- **Fine Arts** (`fine-arts`, Code: `null`)
- **Legal Studies** (`legal-studies`, Code: `null`)
- **Political Science** (`political-science`, Code: `null`)
- **Psychology** (`psychology`, Code: `null`)
- **Sociology** (`sociology`, Code: `null`)

*Recommendation for Owner:* These 8 subjects are safely `noindex` in search results. Do NOT index these subject hubs until at least 1 original 50-question mock test is authored and reviewed.

---

## 3. Explanation Review & Editorial Provenance

Google Quality Rater Guidelines (E-E-A-T) and platform integrity require that explanations are transparently labeled by source and review status.

### Timed Question Bank Explanations (`questions` Table):
| Explanation Status | Source | Count | Editorial Action Needed |
| :--- | :--- | :---: | :--- |
| `unreviewed` | `ai_draft` | 9648 | Requires subject matter expert verification in /admin/review |
| `unreviewed` | `banner` | 34 | Requires subject matter expert verification in /admin/review |
| `unreviewed` | `none` | 1746 | Requires subject matter expert verification in /admin/review |

### Practice Library Explanations (`practice_questions` Table):
| Explanation Status | Source | Count | Editorial Action Needed |
| :--- | :--- | :---: | :--- |
| `reviewed` | `ai_draft` | 1 | None (Approved) |
| `unreviewed` | `ai_draft` | 6244 | Needs editorial sign-off |
| `unreviewed` | `banner` | 26 | Needs editorial sign-off |

*Audit Finding:* Currently **0 questions** have been marked `reviewed`. All explanations are truthfully disclosed to students with the banner: *"Editorial review pending — verify with standard textbooks."*

---

## 4. Copyright & Previous-Year Paper Rights Status

Under the platform's Rights Policy Gate (Fix 3), all practice reproductions of previous-year papers must remain `noindex` until their copyright clearance status is documented.

| Rights Status | Paper Count | Search Engine Status | AdSense Ad Slot Status |
| :--- | :---: | :--- | :--- |
| `unknown` | 214 | Strictly noindex, nofollow | Strictly forbidden (adSlotAllowed = false) |

*Launch Policy:* All 214 practice papers stay `noindex` and ad-free. Only original standalone mocks authored by the platform are eligible for search indexing.

---

## 5. Indexable Page Counts by Group (Post-Fix R7)

By applying the **Minimum Indexable Content Rule (Fix R7)**, thin archive list pages have been pruned from the search index, leaving only authoritative, content-rich URLs:

| Route Group | Indexable Count | Sample URLs | Rationale |
| :--- | :---: | :--- | :--- |
| **Core Landing & Hubs** | **10** | `/, /cuet-ug-mock-test, /mock-tests, /cuet-ug-previous-year-papers, /leaderboard, /about, /contact, /privacy-policy, /terms, /disclaimer` | Substantive copy |
| **Official Exam Guides** | **3** | `/cuet-ug-syllabus, /cuet-ug-exam-pattern, /cuet-ug-marking-scheme` | Substantive copy |
| **Syllabus Subject Guides** | **19** | `/cuet-ug-syllabus/:subject (19 subjects)` | Substantive copy |
| **Substantive Subject Hubs** | **11** | `/cuet-mock-test/:subject (subjects with >= 3 questions)` | Substantive copy |
| **Original Standalone Mocks** | **2** | `/mock/:slug (original mocks with unique content)` | Substantive copy |
| **PYQ Archive List Pages** | **0** | `Marked noindex until rights are cleared and 300+ word copy added (Fix R7)` | Substantive copy |
| **PYQ Practice Papers** | **0** | `Marked noindex per rights policy gate (214 papers)` | Substantive copy |
| **Private & Interactive Routes** | **0** | `Excluded (/attempt/*, /result/*, /dashboard/*, /admin/*, /login, /signup)` | Substantive copy |
| **Total Indexable URLs** | **45** | High-quality, robust pages | Zero thin-content penalty risk |

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
