# Topic backfill runbook

**Status:** migration `0027_practice_question_topics.sql` and the editor import
are implemented in the repository. The migration was applied to the local
Miniflare database for verification; the production D1 migration and the first
real CSV import have **not** been applied. Until they are, every
`/cuet-mock-test/<subject>/<topic>` URL stays `404` (topic pages require at
least one live tagged question).

## 1. Why a backfill is required

The topic template (`src/pages/cuet-mock-test/[subject]/[topic].astro`) needs
questions whose `topic_id` points at a row in `topics`. Two data sources were
checked before choosing a fix:

| Source | Rows | Topic state | Can be re-tagged? |
| --- | ---: | --- | --- |
| Timed bank (`questions`) | 22,457 published | all `topic_id IS NULL` | No. `trg_published_question_immutable` blocks updates after publish |
| Previous-year practice (`practice_questions`) | 7,527 live across 245 papers | no topic column | Yes, after migration 0027 |

The topic template also excludes practice papers today
(`m.practice_paper_slug IS NULL`), so the 7,486 practice questions linked
through `mock_questions_current` never contributed a topic count. Guessing a
topic from question text is not acceptable for a syllabus page, and cloning
22k published rows is not a safe bulk operation. The smallest correct fix is:

1. Add a nullable `practice_questions.topic_id` (migration 0027).
2. Let an editor map question keys to syllabus topics from a CSV.
3. Count those tags in the topic page, subject hubs, syllabus pages and the
   sitemap, using the same public listing gate as the paper cards.

## 2. Data model

`migrations/0027_practice_question_topics.sql`:

```sql
ALTER TABLE practice_questions ADD COLUMN topic_id INTEGER REFERENCES topics(id);
CREATE INDEX IF NOT EXISTS idx_practice_questions_topic
  ON practice_questions(topic_id);
```

- The column is nullable; existing rows are unchanged.
- `practice_questions` has no immutability trigger, so a wrong tag can be
  corrected by re-importing the row.
- A tag is valid only when the topic belongs to the paper's subject. The import
  script enforces this before writing.
- A topic page goes live when the topic has at least one live tagged question
  and the paper has **30+ live questions** (`MIN_LISTED_QUESTIONS`). The count
  in the page header and the paper cards therefore use the same eligibility
  rule.

## 3. Migration order

Run the migration **before** deploying the code that counts practice tags.
Without the column, the new count subquery fails; pages fall back to an empty
topic list (the topic pages keep returning `404`, but subject hubs lose their
topic chips and the sitemap marks the read as degraded).

```powershell
# Local Miniflare D1
npm run db:migrate:local

# Production D1 (requires an authenticated Wrangler session)
npm run db:migrate:remote

# Optional staging database
npm run db:migrate:staging
```

Verify the column exists:

```powershell
npx wrangler d1 execute cuet-blueprint-db --local --command "PRAGMA table_info(practice_questions);"
npx wrangler d1 execute cuet-blueprint-db --remote --command "PRAGMA table_info(practice_questions);"
```

## 4. CSV format

Three columns, one question per row. A header row is optional; blank lines and
lines starting with `#` are ignored.

```csv
paper_slug,question_key,topic_slug
chemistry-2026-06-06-shift-1,q01,chemical-bonding
chemistry-2026-06-06-shift-1,q02,thermodynamics
```

| Column | Meaning | Validation |
| --- | --- | --- |
| `paper_slug` | Slug from `practice_papers.slug` | Must exist, be published and not deleted |
| `question_key` | `practice_questions.question_key` for that paper | Must exist on that paper and not be deleted; no spaces or commas |
| `topic_slug` | `topics.slug` | Must belong to the paper's subject and not be deleted |

The import is all-or-nothing. Any bad row aborts the run before a write, and
the report lists every problem with its CSV line number. Conflicting tags for
the same paper/question are rejected; repeating the same tag is allowed and is
a no-op.

### Finding the values

```powershell
# Papers and their subjects
npx wrangler d1 execute cuet-blueprint-db --local --command "SELECT p.slug, s.slug AS subject, p.year FROM practice_papers p JOIN subjects s ON s.id = p.subject_id WHERE p.publication_status = 'published' AND p.deleted_at IS NULL ORDER BY p.slug;"

# Live question keys for one paper
npx wrangler d1 execute cuet-blueprint-db --local --command "SELECT question_key, source_question_no FROM practice_questions WHERE paper_slug = 'chemistry-2026-06-06-shift-1' AND deleted_at IS NULL ORDER BY position, id;"

# Syllabus topics for the paper's subject
npx wrangler d1 execute cuet-blueprint-db --local --command "SELECT t.slug, t.name FROM topics t JOIN subjects s ON s.id = t.subject_id WHERE s.slug = 'chemistry' AND t.deleted_at IS NULL ORDER BY t.name;"
```

Replace `--local` with `--remote` for production reads. Do not edit question
text to create a key; use the existing `question_key`.

## 5. Import commands

```powershell
# Validate and report only (default; writes nothing)
node scripts/tag-practice-questions.mjs --file topic-map.csv

# Apply locally
node scripts/tag-practice-questions.mjs --file topic-map.csv --apply

# Apply to production D1
node scripts/tag-practice-questions.mjs --file topic-map.csv --apply --remote

# Apply to another D1 database
node scripts/tag-practice-questions.mjs --file topic-map.csv --apply --remote --database cuet-d1-staging

# Validate against an explicit SQLite file (tests, backups)
node scripts/tag-practice-questions.mjs --file topic-map.csv --db path/to/local.sqlite
```

The remote path uploads a temporary `.sql` file through
`wrangler d1 execute --remote --file`. Each statement updates one row by its
`(paper_slug, question_key)` pair, so a retry after a partial failure is safe.
The local path wraps the same updates in a transaction and rolls back on the
first unexpected row count.

## 6. Verification

```powershell
# Tagged rows overall
npx wrangler d1 execute cuet-blueprint-db --local --command "SELECT COUNT(*) AS tagged FROM practice_questions WHERE topic_id IS NOT NULL AND deleted_at IS NULL;"

# Tags per topic for one subject
npx wrangler d1 execute cuet-blueprint-db --local --command "SELECT t.slug, COUNT(*) AS tagged FROM practice_questions pq JOIN practice_papers pp ON pp.slug = pq.paper_slug JOIN topics t ON t.id = pq.topic_id WHERE pp.subject_id = (SELECT id FROM subjects WHERE slug = 'chemistry') AND pq.deleted_at IS NULL GROUP BY t.slug ORDER BY tagged DESC;"
```

Then check a topic URL that received tags, for example
`/cuet-mock-test/chemistry/chemical-bonding`. Expected: `200`, the tagged
practice papers listed, and the URL present in `/sitemap.xml`. A topic with no
tags must stay `404`.

Publication gate check: a paper with 29 live questions is excluded even if
tagged; the same paper at 30 questions is included. This is covered by
`tests/unit/practice-topics.test.ts`.

## 7. Rollback and correction

- **Wrong tag for a row:** change the CSV row and re-run with `--apply`. The
  update overwrites the previous topic id.
- **Remove all tags from a paper:**
  ```sql
  UPDATE practice_questions
  SET topic_id = NULL, updated_at = CURRENT_TIMESTAMP
  WHERE paper_slug = 'chemistry-2026-06-06-shift-1';
  ```
- **Disable one topic page:** remove that topic's tags, or leave fewer than 30
  live questions on every tagged paper. The page returns `404` again and the
  sitemap drops it.
- **Schema rollback:** not required. The nullable column and index are inert
  when unused. Dropping the column would require a table rebuild in SQLite; do
  that only with a verified backup.

## 8. Current diagnosis (local D1, 2026-11-15)

| Check | Value |
| --- | ---: |
| Topics | 136 |
| Published timed questions | 22,457 |
| Timed questions with a topic | 0 |
| Draft/soft-deleted rows with a topic | 4 |
| Live practice questions | 7,527 across 245 papers |
| Published timed mocks | 1 |
| Topic pages live | 0 |

This is why `/cuet-mock-test/english/reading-comprehension` is `404`: it is not
a routing bug, it is an empty topic. The backfill above is the content fix.

## 9. Verification performed

On the local Miniflare database (migration 0027 applied):

1. Imported 30 editor tags for `chemistry-2023-06-11-shift-3` to the
   `solutions` topic via `scripts/tag-practice-questions.mjs --apply`.
2. `/cuet-mock-test/chemistry/solutions` returned `200` and listed the tagged
   paper.
3. `/sitemap.xml` grew from 234 to 235 URLs and included the topic URL.
4. Removed the temporary tags; the topic returned to `404` and the sitemap to
   234 URLs. No net tags remain.

The 30-question boundary is also asserted in
`tests/unit/practice-topics.test.ts` against an in-memory SQLite database.
