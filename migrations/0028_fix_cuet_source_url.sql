-- Migration 0028: replace the retired CUET (UG) source URL.
--
-- `https://exams.nta.ac.in/CUET-UG/` returns 404 (checked 2026-11-17). The
-- official CUET (UG) landing page is `https://cuet.nta.nic.in/`, which returns
-- 200 and is already the fallback used by the exam-info pages when no source
-- URL is stored.
--
-- This updates existing databases. `0020_exam_info_seed.sql` carries the same
-- URL for fresh databases.
UPDATE exam_info
SET source_url = 'https://cuet.nta.nic.in/'
WHERE source_url = 'https://exams.nta.ac.in/CUET-UG/';
