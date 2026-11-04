# Search Engine Optimization (SEO) & Structured Data Rules

*Platform Standard: CUETFreeMockTest.com*  
*Status: Enforced by automated tests (`tests/unit/structured-data.test.ts` and `tests/e2e/security.spec.ts`)*

---

## 1. Structured Data (JSON-LD) Allow-List by Route Group

Google enforces strict guidelines regarding schema markup. Markup must accurately reflect visible content on the page and adhere to Google Search Central eligibility criteria.

| Route Group | Path Pattern | Permitted `@type` Schemas | Disallowed Schemas | Notes |
| :--- | :--- | :--- | :--- | :--- |
| **Home Page** | `/` | `Organization`, `WebSite`, `ItemList` | `Quiz`, `Course`, `FAQPage` | `WebSite` carries site search / branding; `ItemList` lists popular papers. |
| **Editorial Guides** | `/cuet-ug-exam-pattern`, `/cuet-ug-marking-scheme`, `/cuet-ug-syllabus`, `/cuet-ug-important-dates`, `/blog/:slug` | `Organization`, `BreadcrumbList`, `Article` | `FAQPage`, `Quiz`, `Course` | `Article` schema includes author, publisher (`Organization`), and `dateModified`. |
| **Hubs & Archives** | `/cuet-ug-mock-test`, `/cuet-mock-test`, `/cuet-ug-previous-year-papers`, `/pyq/:year`, `/leaderboard` | `Organization`, `BreadcrumbList`, `ItemList` | `Quiz`, `Course`, `FAQPage` | `ItemList` lists papers/subjects contained in the archive. |
| **Paper Details** | `/mock/:slug`, `/mock-tests/:slug` | `Organization`, `BreadcrumbList` | `Quiz`, `Course`, `FAQPage`, `Product` | Single mock/practice landing pages. |
| **Public Questions** | `/q/:slug` | `Organization`, `BreadcrumbList` | `Quiz`, `Question`, `FAQPage` | Standard question sharing page. Breadcrumbs allowed when question is SEO-eligible (`seoEligible = true`). |
| **Legal / About** | `/about`, `/contact`, `/privacy-policy`, `/terms`, `/disclaimer` | `Organization`, `BreadcrumbList` | `FAQPage`, `Article` | Basic organizational and navigational metadata. |
| **Private Routes** | `/attempt/*`, `/result/*`, `/dashboard/*`, `/admin/*`, `/dev/*`, `/login`, `/signup` | **NONE** (or `Organization` via base layout) | All Rich Results Schemas | All private routes are strictly gated with `noindex, nofollow`. |

Legacy `/practice`, `/practice/*`, `/mock-test` and `/mock-test/*` paths 301-redirect to
`/mock-tests` and are never listed in the sitemap; the canonical target is always the
matching `/mock-tests` URL.

---

## 2. Rationale for Disallowed Schemas

### Why `FAQPage` is Disallowed:
In August 2023, Google Search updated its rich result guidelines to restrict `FAQPage` rich snippets exclusively to authoritative government (`.gov`) and healthcare websites. For commercial, non-profit, or educational platforms, emitting `FAQPage` structured data provides zero rich snippet benefits and increases the risk of structured data mismatch warnings or manual actions. All visible FAQs on the site are rendered as clean HTML semantic components without JSON-LD `FAQPage`.

### Why `Course` is Disallowed:
Google's `Course` structured data is explicitly reserved for accredited educational course series that include an instructor, a curriculum, prerequisites, and a formal academic or vocational credential upon completion. Individual practice tests, mock exams, or previous-year question sets do not qualify as courses.

### Why `Quiz` / `PracticeProblem` is Disallowed:
Google's `Quiz` / `PracticeProblem` schema requires specialized multi-step MathML/LaTeX markup and interactive card layouts designed for educational publishers partnered with Google. Emitting ad-hoc `Quiz` markup on timed mock test landing pages violates Google's structured data policies because the full questions and answers are not visibly rendered on the server-rendered landing page prior to taking the test.

---

## 3. Metadata & Tagging Standards

1. **Title Tag**:
   - Length: **35 to 65 characters**.
   - Format: `{Subject / Topic / Exam Name} — CUET Free Mock Test`.
   - Never use unverifiable superlatives ("#1", "Official", "Guaranteed", "Largest").

2. **Meta Description**:
   - Length: **120 to 160 characters**.
   - Must provide an accurate summary of visible page content.

3. **Canonical URLs**:
   - Every indexable page must declare an absolute self-canonical matching `SITE_URL` (e.g. `<link rel="canonical" href="https://cuetfreemocktest.com/cuet-ug-mock-test" />`).
   - Query parameters (such as `?page=`, `?sort=`, `?lang=`) must canonicalize back to the clean canonical URL.

4. **Headings Hierarchy**:
   - Exactly **one `<h1>`** per page.
   - Subheadings must follow logical semantic nesting (`<h2>` followed by `<h3>`).

---

## 4. Indexing & Quality Gates

A page is automatically assigned `noindex, nofollow` if ANY of the following conditions are met:
1. **Private Prefix**: The URL path starts with `/admin`, `/api`, `/attempt`, `/result`, `/dashboard`, `/dev`, `/login`, `/signup`, `/reset-password`, `/verify-email`.
2. **Copyright Provenance Gate**: For practice papers, `rights_status != 'cleared'`.
3. **Fact Verification Gate**: For exam guide pages, the corresponding `exam_info` key has `value = 'TODO_VERIFY'` or `last_verified = NULL`.
4. **Thin Content Gate**: A subject or topic landing page with fewer than 3 available practice questions.

---

## 5. Thin Content & Minimum Indexable Content Rule (Fix R7)

To protect the platform against Google thin-content algorithm penalties and AdSense rejection, indexability is strictly governed by substantive content requirements:

1. **Minimum Word Count**: Every indexable page must contain at least **300 words of unique, substantive body copy** (excluding standard navigation bars, header/footer chrome, and lists of card links).
2. **Substantive Content Requirement**: In addition to the word count, the page must provide:
   - At least one real, original, playable item (e.g. an original cleared mock paper), OR
   - A verified official examination facts block (with `source_url` and recent `last_verified` date).
3. **Application to Archive & List Pages**:
   - `/pyq/:year` and `/pyq/:year/:subject` archive pages are marked `noindex, nofollow` and excluded from `sitemap.xml` until they feature cleared playable papers and substantive editorial guidance.
   - Subjects with 0 available questions are automatically marked `noindex, nofollow` and excluded from `sitemap.xml`.
4. **Automated Enforcement**: Enforced by `scripts/seo-consistency.mjs` and verified in unit tests (`tests/unit/seo-consistency.test.ts`).

