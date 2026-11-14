INSERT INTO page_seo (
  path, title, description, intro_html, faq_json, noindex, updated_at, canonical_url
)
SELECT
  '/cuet-ug-previous-year-question-papers',
  title,
  description,
  intro_html,
  faq_json,
  noindex,
  updated_at,
  CASE
    WHEN canonical_url = '/cuet-ug-previous-year-papers'
      THEN '/cuet-ug-previous-year-question-papers'
    WHEN substr(canonical_url, -length('/cuet-ug-previous-year-papers')) = '/cuet-ug-previous-year-papers'
      THEN substr(canonical_url, 1, length(canonical_url) - length('/cuet-ug-previous-year-papers'))
        || '/cuet-ug-previous-year-question-papers'
    ELSE canonical_url
  END
FROM page_seo
WHERE path = '/cuet-ug-previous-year-papers'
ON CONFLICT(path) DO UPDATE SET
  title = COALESCE(page_seo.title, excluded.title),
  description = COALESCE(page_seo.description, excluded.description),
  intro_html = COALESCE(page_seo.intro_html, excluded.intro_html),
  faq_json = COALESCE(page_seo.faq_json, excluded.faq_json),
  noindex = MAX(page_seo.noindex, excluded.noindex),
  updated_at = COALESCE(page_seo.updated_at, excluded.updated_at),
  canonical_url = CASE
    WHEN page_seo.canonical_url = '/cuet-ug-previous-year-papers'
      THEN '/cuet-ug-previous-year-question-papers'
    WHEN substr(page_seo.canonical_url, -length('/cuet-ug-previous-year-papers')) = '/cuet-ug-previous-year-papers'
      THEN substr(page_seo.canonical_url, 1, length(page_seo.canonical_url) - length('/cuet-ug-previous-year-papers'))
        || '/cuet-ug-previous-year-question-papers'
    ELSE COALESCE(page_seo.canonical_url, excluded.canonical_url)
  END;

DELETE FROM page_seo
WHERE path = '/cuet-ug-previous-year-papers';

UPDATE site_settings
SET value = '/cuet-ug-previous-year-question-papers'
WHERE key = 'home_hero_secondary_href'
  AND value = '/cuet-ug-previous-year-papers';
