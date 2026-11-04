-- Migration: 0017_paper_provenance_and_rights.sql
-- Adds provenance, source attribution, and copyright rights status to practice_papers.

ALTER TABLE practice_papers ADD COLUMN source_url TEXT;
ALTER TABLE practice_papers ADD COLUMN source_type TEXT NOT NULL DEFAULT 'unknown'
  CHECK (source_type IN ('official_public', 'licensed', 'original', 'unknown'));
ALTER TABLE practice_papers ADD COLUMN rights_status TEXT NOT NULL DEFAULT 'unknown'
  CHECK (rights_status IN ('unknown', 'cleared', 'restricted'));
ALTER TABLE practice_papers ADD COLUMN rights_note TEXT;
ALTER TABLE practice_papers ADD COLUMN verified_by TEXT;
ALTER TABLE practice_papers ADD COLUMN verified_at TEXT;

CREATE INDEX IF NOT EXISTS idx_practice_papers_rights ON practice_papers(rights_status);
CREATE INDEX IF NOT EXISTS idx_practice_papers_source_type ON practice_papers(source_type);

