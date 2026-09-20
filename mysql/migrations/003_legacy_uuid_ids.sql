-- Only for an EMPTY sharing schema originally created by 001.
-- Preserve the Supabase UUIDs rather than renumbering historical shares.
ALTER TABLE template_publish_requests DROP FOREIGN KEY template_publish_requests_ibfk_1;
ALTER TABLE template_uses DROP FOREIGN KEY template_uses_ibfk_1;
ALTER TABLE template_reports DROP FOREIGN KEY template_reports_ibfk_1;
ALTER TABLE template_requests DROP FOREIGN KEY template_requests_ibfk_1;
ALTER TABLE template_assets DROP FOREIGN KEY template_assets_ibfk_2;
ALTER TABLE watermarks_share_links MODIFY id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL DEFAULT (UUID()), MODIFY watermark_name VARCHAR(255) NOT NULL;
ALTER TABLE template_publish_requests MODIFY template_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE template_uses MODIFY template_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
ALTER TABLE template_reports MODIFY template_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL;
ALTER TABLE template_requests MODIFY template_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE template_assets MODIFY template_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL;
ALTER TABLE template_publish_requests ADD CONSTRAINT template_publish_requests_ibfk_1 FOREIGN KEY(template_id) REFERENCES watermarks_share_links(id);
ALTER TABLE template_uses ADD CONSTRAINT template_uses_ibfk_1 FOREIGN KEY(template_id) REFERENCES watermarks_share_links(id);
ALTER TABLE template_reports ADD CONSTRAINT template_reports_ibfk_1 FOREIGN KEY(template_id) REFERENCES watermarks_share_links(id);
ALTER TABLE template_requests ADD CONSTRAINT template_requests_ibfk_1 FOREIGN KEY(template_id) REFERENCES watermarks_share_links(id);
ALTER TABLE template_assets ADD CONSTRAINT template_assets_ibfk_2 FOREIGN KEY(template_id) REFERENCES watermarks_share_links(id);
CREATE OR REPLACE VIEW template_records AS SELECT CAST(id AS CHAR) AS id,contract_version,visibility,discovery_state,watermark_name,company_name,share_code,status,created_at,updated_at,expires_at,expire_time,removed_at,cover_kind,cover_width,cover_height,cover_asset_id,payload_asset_id,use_count,payload_schema_version,content_version,cover_image_url,json_download_url,language FROM watermarks_share_links;
CREATE OR REPLACE VIEW template_asset_records AS SELECT id,upload_session_id,CAST(template_id AS CHAR) AS template_id,request_id,client_asset_id,kind,object_key,sealed_key,mime,bytes,width,height,sha256,sealed_sha256,state,created_at FROM template_assets;
