-- Immutable daily reviews; issues retain their workflow across new observations.
CREATE TABLE IF NOT EXISTS error_review_runs (
 id CHAR(36) PRIMARY KEY, review_date CHAR(10) NOT NULL, payload_hash CHAR(64) NOT NULL,
 summary TEXT NOT NULL, payload JSON NOT NULL, created_by VARCHAR(100) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)), INDEX review_date_idx(review_date, created_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS error_review_issues (
 id CHAR(64) PRIMARY KEY, platform VARCHAR(10) NOT NULL, title VARCHAR(180) NOT NULL,
 priority VARCHAR(2) NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'new', owner VARCHAR(100) NOT NULL DEFAULT '',
 fix_version VARCHAR(100) NOT NULL DEFAULT '', fix_link VARCHAR(500) NOT NULL DEFAULT '',
 first_seen CHAR(10) NOT NULL, last_seen CHAR(10) NOT NULL, version INT NOT NULL DEFAULT 1,
 updated_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)), INDEX issue_status_idx(status, last_seen)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS error_review_findings (
 run_id CHAR(36) NOT NULL, issue_id CHAR(64) NOT NULL, detail JSON NOT NULL,
 PRIMARY KEY(run_id, issue_id), FOREIGN KEY(run_id) REFERENCES error_review_runs(id),
 FOREIGN KEY(issue_id) REFERENCES error_review_issues(id), INDEX finding_issue_idx(issue_id)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS error_review_actions (
 id CHAR(36) PRIMARY KEY, issue_id CHAR(64) NOT NULL, actor VARCHAR(100) NOT NULL,
 note TEXT NOT NULL, before_state JSON, after_state JSON NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 FOREIGN KEY(issue_id) REFERENCES error_review_issues(id), INDEX action_issue_idx(issue_id, created_at)
) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
