-- Bootstrap taxonomy. Exam facts (dates, pattern, marking) stay in exam_info and
-- are intentionally NOT seeded here: they must be verified against NTA sources.

INSERT OR IGNORE INTO exams (name, slug, is_active) VALUES ('CUET UG', 'cuet-ug', 1);

INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'English', 'english', 'language', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Hindi', 'hindi', 'language', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Mathematics', 'mathematics', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Physics', 'physics', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Chemistry', 'chemistry', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Biology', 'biology', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Computer Science', 'computer-science', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Accountancy', 'accountancy', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Business Studies', 'business-studies', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Economics', 'economics', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'History', 'history', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Political Science', 'political-science', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Geography', 'geography', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Sociology', 'sociology', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Psychology', 'psychology', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Legal Studies', 'legal-studies', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'Fine Arts', 'fine-arts', 'domain', 1 FROM exams WHERE slug = 'cuet-ug';
INSERT OR IGNORE INTO subjects (exam_id, name, slug, type, is_active)
SELECT id, 'General Test', 'general-test', 'general', 1 FROM exams WHERE slug = 'cuet-ug';

-- The first Access-authenticated email must already exist here.
INSERT OR IGNORE INTO admins (email, role) VALUES ('admin@cuetfreemocktest.com', 'super');

INSERT OR IGNORE INTO badges (code, name, description) VALUES
  ('first_mock', 'First Mock', 'Completed the first mock test'),
  ('tests_10', '10 Mocks', 'Completed 10 mock tests'),
  ('tests_25', '25 Mocks', 'Completed 25 mock tests'),
  ('streak_7', '7-Day Streak', 'Studied for seven days in a row');

INSERT OR IGNORE INTO site_settings (key, value) VALUES
  ('discussion_enabled', 'true'),
  ('registration_enabled', 'true'),
  ('maintenance_mode', 'false');
