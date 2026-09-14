-- Repeatable initialization: never resets an existing account password/role.
CREATE TABLE IF NOT EXISTS admin_accounts (
 id CHAR(36) PRIMARY KEY,
 email VARCHAR(254) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL UNIQUE,
 password_hash VARCHAR(255) NOT NULL,
 role VARCHAR(16) NOT NULL DEFAULT 'admin',
 enabled BOOLEAN NOT NULL DEFAULT TRUE,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 CHECK (role IN ('admin','moderator'))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS admin_sessions (
 token_hash CHAR(64) PRIMARY KEY,
 admin_id CHAR(36) NOT NULL,
 password_version CHAR(64) NOT NULL,
 expires_at DATETIME(3) NOT NULL,
 created_at DATETIME(3) NOT NULL DEFAULT (UTC_TIMESTAMP(3)),
 KEY admin_session_expiry(expires_at),
 FOREIGN KEY(admin_id) REFERENCES admin_accounts(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO admin_accounts (id,email,password_hash,role,enabled)
VALUES (UUID(),'luyongfugx@gmail.com','scrypt$32768$8$3$64619e00c836e9176f90408fa73eb721$a5ece9107de2d044d3d6e2bfefcbe85bffb3a23bc9133feddd4dd4095615faee84e32aa19be4aa53760e52bebfe5b59a21e7be9508525225b87ae4a6effd1ffe','admin',1)
ON DUPLICATE KEY UPDATE id=id;
