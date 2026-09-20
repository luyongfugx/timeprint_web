-- Normalize content-language aliases after deploying the server-side compatibility reads.
UPDATE watermarks_share_links
SET language = CASE
  WHEN LOWER(REPLACE(language, '_', '-')) = 'en'
    OR LOWER(REPLACE(language, '_', '-')) LIKE 'en-%' THEN 'en'
  WHEN LOWER(REPLACE(language, '_', '-')) IN ('zh-hant', 'zh-tw', 'zh-hk', 'zh-mo') THEN 'zh-hant'
  WHEN LOWER(REPLACE(language, '_', '-')) IN ('zh', 'zh-hans', 'zh-cn', 'zh-sg') THEN 'zh-hans'
  ELSE LOWER(REPLACE(language, '_', '-'))
END;
