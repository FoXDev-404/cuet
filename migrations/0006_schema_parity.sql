PRAGMA foreign_keys = ON;

-- ============================================================================
-- Blueprint v2 schema parity: mock catalogue lookup index.
--
-- 0001 created idx_mocks_status(status, published_at). Blueprint section 5.2
-- specifies (status, type). Replace it with the blueprint shape and keep a
-- separate publication-order index for catalogue/search queries that sort by
-- published_at.
-- ============================================================================

DROP INDEX IF EXISTS idx_mocks_status;

CREATE INDEX idx_mocks_status ON mock_tests(status, type);
CREATE INDEX idx_mocks_status_published ON mock_tests(status, published_at DESC);
