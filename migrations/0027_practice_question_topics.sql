-- Topic tags for the previous-year practice library.
--
-- Local practice questions live in `practice_questions`, not in the immutable
-- timed `questions` bank, so they can be re-tagged in place without cloning a
-- published row. The importer leaves this column NULL: tags are editor-assigned
-- from the official syllabus and are never guessed from question text.
--
-- Populate it with `scripts/tag-practice-questions.mjs` (see
-- docs/TOPIC_BACKFILL.md). Topic pages, subject chips, syllabus links and the
-- sitemap count these rows alongside tagged timed-bank questions.
ALTER TABLE practice_questions ADD COLUMN topic_id INTEGER REFERENCES topics(id);

CREATE INDEX IF NOT EXISTS idx_practice_questions_topic
  ON practice_questions(topic_id);
