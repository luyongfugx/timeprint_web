ALTER TABLE watermarks_share_links
 ADD COLUMN language VARCHAR(35) NOT NULL DEFAULT 'en' AFTER json_download_url,
 ADD KEY template_language_public_order (language,visibility,discovery_state,status,use_count,created_at,id);

CREATE OR REPLACE VIEW template_records AS
SELECT CAST(id AS CHAR) AS id,contract_version,visibility,discovery_state,watermark_name,company_name,share_code,status,created_at,updated_at,expires_at,expire_time,removed_at,cover_kind,cover_width,cover_height,cover_asset_id,payload_asset_id,use_count,payload_schema_version,content_version,cover_image_url,json_download_url,language
FROM watermarks_share_links;
