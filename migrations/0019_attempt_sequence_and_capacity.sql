-- Migration 0019: Attempt Sequence, Ordering & Capacity Optimizations
-- Adds client sequence tracking to prevent out-of-order overwrite and
-- section summary persistence to prevent full question scans on result view.

ALTER TABLE attempts ADD COLUMN last_client_seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempt_answers ADD COLUMN client_seq INTEGER NOT NULL DEFAULT 0;
ALTER TABLE attempts ADD COLUMN section_summary TEXT;

