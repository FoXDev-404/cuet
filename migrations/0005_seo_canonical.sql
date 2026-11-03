-- Blueprint v2 SEO editor: an editor-managed canonical URL override.
-- NULL means the page keeps its self-referencing canonical URL.
ALTER TABLE page_seo ADD COLUMN canonical_url TEXT;
