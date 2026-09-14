-- MySQL 8.0.16+. Applied by scripts/migrate-templates.mjs after a schema preflight.
-- {{TEMPLATE_ID_TYPE}} is replaced with the inspected original primary-key type.
CREATE TABLE IF NOT EXISTS watermarks_share_links (
 id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
 watermark_name VARCHAR(100) NOT NULL, company_name VARCHAR(100) NULL,
 cover_image_url TEXT NOT NULL, json_download_url TEXT NOT NULL,
 status INT NOT NULL DEFAULT 0, created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 user_id VARCHAR(128) NULL, share_code VARCHAR(10) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
 expire_time BIGINT NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE watermarks_share_links
 ADD COLUMN contract_version SMALLINT NOT NULL DEFAULT 1,
 ADD COLUMN visibility VARCHAR(10) NULL,
 ADD COLUMN discovery_state VARCHAR(10) NOT NULL DEFAULT 'held',
 ADD COLUMN cover_kind VARCHAR(10) NOT NULL DEFAULT 'watermark',
 ADD COLUMN cover_width INT NULL, ADD COLUMN cover_height INT NULL,
 ADD COLUMN payload_schema_version INT NOT NULL DEFAULT 1,
 ADD COLUMN content_version INT NOT NULL DEFAULT 1,
 ADD COLUMN payload_sha256 CHAR(64) NULL,
 ADD COLUMN expires_at DATETIME(3) NULL,
 ADD COLUMN updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 ADD COLUMN removed_at DATETIME(3) NULL, ADD COLUMN removed_reason TEXT NULL,
 ADD COLUMN actor_hash CHAR(64) NULL,
 ADD COLUMN use_count BIGINT UNSIGNED NOT NULL DEFAULT 0,
 ADD COLUMN cover_asset_id CHAR(36) NULL, ADD COLUMN payload_asset_id CHAR(36) NULL,
 ADD COLUMN normalized_share_code VARCHAR(10) CHARACTER SET ascii COLLATE ascii_bin GENERATED ALWAYS AS (UPPER(share_code)) STORED,
 ADD UNIQUE KEY template_share_code_unique (normalized_share_code),
 ADD KEY template_public_order (visibility,discovery_state,status,use_count,created_at,id),
 ADD KEY template_expiry (expires_at),
 ADD CONSTRAINT template_visibility CHECK (visibility IS NULL OR visibility IN ('public','private')),
 ADD CONSTRAINT template_discovery CHECK (discovery_state IN ('eligible','held')),
 ADD CONSTRAINT template_v2_rules CHECK (contract_version IN (1,2) AND (contract_version=1 OR (
 visibility IS NOT NULL AND cover_asset_id IS NOT NULL AND payload_asset_id IS NOT NULL AND cover_width IS NOT NULL AND cover_width>0 AND cover_height IS NOT NULL AND cover_height>0
 AND payload_sha256 IS NOT NULL AND payload_schema_version=1 AND content_version=1
 AND ((visibility='public' AND expires_at IS NULL AND expire_time=0 AND CHAR_LENGTH(TRIM(watermark_name)) BETWEEN 1 AND 100)
 OR (visibility='private' AND cover_kind='watermark' AND expires_at IS NOT NULL AND TIMESTAMPDIFF(SECOND,created_at,expires_at)=2592000 AND expire_time=TIMESTAMPDIFF(SECOND,'1970-01-01 00:00:00',expires_at)))
 )));

CREATE TABLE template_upload_sessions (
 id CHAR(36) PRIMARY KEY, actor_hash CHAR(64) NOT NULL, client_request_id CHAR(36) NOT NULL,
 visibility VARCHAR(10) NULL, purpose VARCHAR(10) NOT NULL DEFAULT 'template', token_hash CHAR(64) NOT NULL,
 state VARCHAR(12) NOT NULL DEFAULT 'open', expires_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)+INTERVAL 1 HOUR),
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)), manifest_hash CHAR(64) NULL, completion_json JSON NULL,
 cover_asset_id CHAR(36) NULL,payload_asset_id CHAR(36) NULL, KEY session_cleanup(state,created_at),
 CHECK (state IN ('open','ready','committed')), CHECK (purpose IN ('template','removal','company'))
) ENGINE=InnoDB;
CREATE TABLE template_publish_requests (
 actor_hash CHAR(64) NOT NULL, client_request_id CHAR(36) NOT NULL, request_hash CHAR(64) NOT NULL,
 state VARCHAR(12) NOT NULL, template_id {{TEMPLATE_ID_TYPE}} NULL, receipt_json JSON NULL,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)), PRIMARY KEY(actor_hash,client_request_id),
 FOREIGN KEY(template_id) REFERENCES watermarks_share_links(id)
) ENGINE=InnoDB;
CREATE TABLE template_uses (
 template_id {{TEMPLATE_ID_TYPE}} NOT NULL, actor_hash CHAR(64) NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 PRIMARY KEY(template_id,actor_hash), FOREIGN KEY(template_id) REFERENCES watermarks_share_links(id)
) ENGINE=InnoDB;
CREATE TABLE template_reports (
 id CHAR(36) PRIMARY KEY, template_id {{TEMPLATE_ID_TYPE}} NOT NULL, actor_hash CHAR(64) NOT NULL,
 client_request_id CHAR(36) NOT NULL, request_hash CHAR(64) NOT NULL, reason VARCHAR(64) NOT NULL, source VARCHAR(64) NOT NULL,
 status VARCHAR(16) NOT NULL DEFAULT 'received', created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),resolved_at DATETIME(3) NULL,resolution TEXT NULL,
 UNIQUE KEY report_idempotency(actor_hash,client_request_id), FOREIGN KEY(template_id) REFERENCES watermarks_share_links(id)
) ENGINE=InnoDB;
CREATE TABLE template_requests (
 id CHAR(36) PRIMARY KEY, kind VARCHAR(10) NOT NULL, template_id {{TEMPLATE_ID_TYPE}} NULL, submitted_code VARCHAR(10) NULL,
 company_name VARCHAR(100) NOT NULL DEFAULT '',description TEXT NOT NULL,contact VARCHAR(254) NOT NULL DEFAULT '',
 required_fields JSON NOT NULL,attachment_ids JSON NOT NULL, status VARCHAR(16) NOT NULL DEFAULT 'received',
 client_request_id CHAR(36) NOT NULL UNIQUE, request_hash CHAR(64) NOT NULL, accepted BOOLEAN NOT NULL DEFAULT FALSE,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),resolved_at DATETIME(3) NULL,resolution TEXT NULL,
 FOREIGN KEY(template_id) REFERENCES watermarks_share_links(id)
) ENGINE=InnoDB;
CREATE TABLE template_assets (
 id CHAR(36) PRIMARY KEY,upload_session_id CHAR(36) NOT NULL,template_id {{TEMPLATE_ID_TYPE}} NULL,request_id CHAR(36) NULL,
 client_asset_id CHAR(36) NOT NULL,kind VARCHAR(10) NOT NULL,object_key VARCHAR(255) NOT NULL,sealed_key VARCHAR(255) NULL,
 mime VARCHAR(32) NOT NULL,bytes BIGINT UNSIGNED NOT NULL,width INT NULL,height INT NULL,sha256 CHAR(64) NOT NULL,sealed_sha256 CHAR(64) NULL,
 state VARCHAR(10) NOT NULL DEFAULT 'staging',created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 UNIQUE KEY asset_idempotency(upload_session_id,client_asset_id),
 FOREIGN KEY(upload_session_id) REFERENCES template_upload_sessions(id),FOREIGN KEY(template_id) REFERENCES watermarks_share_links(id),FOREIGN KEY(request_id) REFERENCES template_requests(id)
) ENGINE=InnoDB;
CREATE TABLE template_search_snapshots(id CHAR(36) PRIMARY KEY,query_hash CHAR(64) NOT NULL,ordered_ids JSON NOT NULL,expires_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)+INTERVAL 5 MINUTE),KEY snapshot_expiry(expires_at)) ENGINE=InnoDB;
CREATE TABLE template_trending_terms(id CHAR(36) PRIMARY KEY,term VARCHAR(100) NOT NULL,locale VARCHAR(35) NOT NULL,sort_order INT NOT NULL DEFAULT 0,enabled BOOLEAN NOT NULL DEFAULT TRUE,updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),UNIQUE KEY term_locale(locale,term)) ENGINE=InnoDB;
-- Auth is still Supabase. Only its verified user UUID is stored here.
CREATE TABLE template_admins(user_id CHAR(36) PRIMARY KEY,enabled BOOLEAN NOT NULL DEFAULT TRUE,role VARCHAR(16) NOT NULL,CHECK(role IN ('admin','moderator'))) ENGINE=InnoDB;
CREATE TABLE template_moderation_actions(id CHAR(36) PRIMARY KEY,template_id VARCHAR(128) NULL,report_id CHAR(36) NULL,request_id CHAR(36) NULL,admin_user_id CHAR(36) NOT NULL,action VARCHAR(32) NOT NULL,reason TEXT NOT NULL,before_state JSON NULL,after_state JSON NULL,created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3))) ENGINE=InnoDB;
CREATE TABLE template_rate_limits(`key` CHAR(64) NOT NULL,action VARCHAR(32) NOT NULL,window_start BIGINT NOT NULL,count INT NOT NULL,PRIMARY KEY(`key`,action,window_start)) ENGINE=InnoDB;
CREATE VIEW template_records AS SELECT CAST(id AS CHAR) AS id,contract_version,visibility,discovery_state,watermark_name,company_name,share_code,status,created_at,updated_at,expires_at,expire_time,removed_at,cover_kind,cover_width,cover_height,cover_asset_id,payload_asset_id,use_count,payload_schema_version,content_version,cover_image_url,json_download_url FROM watermarks_share_links;
CREATE VIEW template_asset_records AS SELECT id,upload_session_id,CAST(template_id AS CHAR) AS template_id,request_id,client_asset_id,kind,object_key,sealed_key,mime,bytes,width,height,sha256,sealed_sha256,state,created_at FROM template_assets;
