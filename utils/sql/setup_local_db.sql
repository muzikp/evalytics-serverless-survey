-- Local development database setup
-- Run this file against your local MySQL instance

-- Create database
CREATE DATABASE IF NOT EXISTS evalytics_survey CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Use the database
USE evalytics_survey;

-- MySQL 8.x initial schema (draft)
-- NOTE: Adjust lengths/indexes once real usage is known.

CREATE TABLE IF NOT EXISTS users (
  user_id            VARCHAR(16) PRIMARY KEY,
  firstname          VARCHAR(256) NOT NULL,
  lastname           VARCHAR(256) NOT NULL,
  email              VARCHAR(256) NOT NULL UNIQUE,
  password_hash      VARCHAR(256) NOT NULL,
  api_token_hash     VARCHAR(128) NULL,
  roles              JSON NOT NULL,
  created            DATETIME NOT NULL,
  last_update        DATETIME NOT NULL
) ENGINE=InnoDB;

-- Personal Access Tokens (PAT) for programmatic REST access (plaintext shown only once on creation)
CREATE TABLE IF NOT EXISTS user_api_tokens (
  token_id           VARCHAR(32) PRIMARY KEY,
  user_id            VARCHAR(16) NOT NULL,
  name               VARCHAR(128) NOT NULL,
  token_hash         VARCHAR(128) NOT NULL,
  scopes             JSON NOT NULL,
  expires_at         DATETIME NULL,
  last_used          DATETIME NULL,
  revoked_at         DATETIME NULL,
  created            DATETIME NOT NULL,
  last_update        DATETIME NOT NULL,
  UNIQUE KEY uq_user_token_name (user_id, name),
  KEY ix_user_token_user (user_id),
  KEY ix_user_token_hash (token_hash),
  CONSTRAINT fk_user_token_user FOREIGN KEY (user_id) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS templates (
  template_id        VARCHAR(16) PRIMARY KEY,
  name               VARCHAR(256) NOT NULL,
  surveyjs_version   VARCHAR(16) NOT NULL,
  languages          JSON NOT NULL,
  data               JSON NOT NULL,
  created            DATETIME NOT NULL,
  last_update        DATETIME NOT NULL,
  created_by         VARCHAR(16) NOT NULL,
  last_modified_by   VARCHAR(16) NOT NULL,
  CONSTRAINT fk_templates_created_by FOREIGN KEY (created_by) REFERENCES users(user_id),
  CONSTRAINT fk_templates_modified_by FOREIGN KEY (last_modified_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS snapshots (
  snapshot_id        VARCHAR(16) PRIMARY KEY,
  template_id        VARCHAR(16) NOT NULL,
  version            INT NOT NULL,
  surveyjs_version   VARCHAR(16) NOT NULL,
  languages          JSON NOT NULL,
  data               JSON NOT NULL,
  created            DATETIME NOT NULL,
  last_update        DATETIME NOT NULL,
  created_by         VARCHAR(16) NOT NULL,
  last_modified_by   VARCHAR(16) NOT NULL,
  UNIQUE KEY uq_snapshot_version (template_id, version),
  CONSTRAINT fk_snapshots_template FOREIGN KEY (template_id) REFERENCES templates(template_id),
  CONSTRAINT fk_snapshots_created_by FOREIGN KEY (created_by) REFERENCES users(user_id),
  CONSTRAINT fk_snapshots_modified_by FOREIGN KEY (last_modified_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS campaigns (
  campaign_id        VARCHAR(16) PRIMARY KEY,
  snapshot_id        VARCHAR(16) NOT NULL,
  public_id          VARCHAR(256) NOT NULL UNIQUE,
  title              JSON NOT NULL,
  description        JSON NULL,
  email_template     JSON NOT NULL,
  open_on            DATETIME NULL,
  close_on           DATETIME NULL,
  allow_multiple_responses BOOLEAN NOT NULL DEFAULT false,
  max_attempts       INT NULL,
  created            DATETIME NOT NULL,
  last_update        DATETIME NOT NULL,
  created_by         VARCHAR(16) NOT NULL,
  last_modified_by   VARCHAR(16) NOT NULL,
  CONSTRAINT fk_campaigns_snapshot FOREIGN KEY (snapshot_id) REFERENCES snapshots(snapshot_id),
  CONSTRAINT fk_campaigns_created_by FOREIGN KEY (created_by) REFERENCES users(user_id),
  CONSTRAINT fk_campaigns_modified_by FOREIGN KEY (last_modified_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS campaign_respondents (
  respondent_id      VARCHAR(32) PRIMARY KEY,
  campaign_id        VARCHAR(16) NOT NULL,
  email              VARCHAR(256) NOT NULL,
  email_hash         CHAR(64) NOT NULL,
  token_hash         VARCHAR(128) NOT NULL,
  data               JSON NULL,
  created            DATETIME NOT NULL,
  last_update        DATETIME NOT NULL,
  UNIQUE KEY uq_campaign_email (campaign_id, email),
  KEY ix_respondents_email_hash (campaign_id, email_hash),
  CONSTRAINT fk_respondents_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS responses (
  response_id        VARCHAR(64) PRIMARY KEY,
  respondent_id      VARCHAR(32) NOT NULL,
  campaign_id        VARCHAR(16) NOT NULL,
  snapshot_id        VARCHAR(16) NOT NULL,
  attempt_no         INT NOT NULL DEFAULT 1,
  status             ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress',
  request_data       JSON NULL,
  client_meta        JSON NULL,
  data               JSON NOT NULL,
  submitted_at       DATETIME NULL,
  created            DATETIME NOT NULL,
  last_update        DATETIME NOT NULL,
  UNIQUE KEY uq_attempt (respondent_id, attempt_no),
  KEY ix_campaign_status (campaign_id, status),
  CONSTRAINT fk_responses_respondent FOREIGN KEY (respondent_id) REFERENCES campaign_respondents(respondent_id),
  CONSTRAINT fk_responses_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
  CONSTRAINT fk_responses_snapshot FOREIGN KEY (snapshot_id) REFERENCES snapshots(snapshot_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_black_list (
  black_list_id      INT AUTO_INCREMENT PRIMARY KEY,
  email              VARCHAR(256) NOT NULL,
  email_hash         CHAR(64) NOT NULL,
  scope              ENUM('snapshot','global') NOT NULL,
  snapshot_id        VARCHAR(16) NULL,
  reason_code        TINYINT NOT NULL,
  note               VARCHAR(512) NULL,
  created            DATETIME NOT NULL,
  UNIQUE KEY uq_blacklist (email_hash, scope, snapshot_id),
  KEY ix_blacklist_email_hash (email_hash),
  KEY ix_blacklist_scope_snapshot (scope, snapshot_id),
  CONSTRAINT fk_blacklist_snapshot FOREIGN KEY (snapshot_id) REFERENCES snapshots(snapshot_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS storage_items (
  storage_item_id    VARCHAR(32) PRIMARY KEY,
  location           TEXT NOT NULL,
  local_path         TEXT NULL,
  name               VARCHAR(256) NOT NULL,
  description        TEXT NULL,
  filetype           VARCHAR(256) NOT NULL,
  size_bytes         BIGINT NULL,
  checksum_sha256    VARCHAR(64) NULL,
  created            DATETIME NOT NULL,
  last_update        DATETIME NOT NULL,
  created_by         VARCHAR(16) NULL,
  last_modified_by   VARCHAR(16) NULL,
  CONSTRAINT fk_storage_created_by FOREIGN KEY (created_by) REFERENCES users(user_id),
  CONSTRAINT fk_storage_modified_by FOREIGN KEY (last_modified_by) REFERENCES users(user_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS response_attachments (
  upload_id          VARCHAR(32) PRIMARY KEY,
  response_id        VARCHAR(64) NOT NULL,
  storage_item_id    VARCHAR(32) NOT NULL,
  question_name      VARCHAR(256) NULL,
  status             ENUM('pending','ready','rejected') NOT NULL DEFAULT 'pending',
  created            DATETIME NOT NULL,
  last_update        DATETIME NOT NULL,
  CONSTRAINT fk_attach_response FOREIGN KEY (response_id) REFERENCES responses(response_id),
  CONSTRAINT fk_attach_storage FOREIGN KEY (storage_item_id) REFERENCES storage_items(storage_item_id)
) ENGINE=InnoDB;

-- Optional: per-recipient email log (invite/reminder)
CREATE TABLE IF NOT EXISTS campaign_email_log (
  email_log_id        BIGINT AUTO_INCREMENT PRIMARY KEY,
  campaign_id         VARCHAR(16) NOT NULL,
  respondent_id       VARCHAR(32) NOT NULL,
  recipient_email     VARCHAR(256) NOT NULL,
  email_type          ENUM('invite','reminder') NOT NULL,
  provider            ENUM('ses') NOT NULL DEFAULT 'ses',
  provider_message_id VARCHAR(256) NULL,
  status              ENUM('queued','sent','delivered','bounced','complaint','rejected','failed') NOT NULL DEFAULT 'queued',
  last_event_type     VARCHAR(64) NULL,
  last_event_at       DATETIME NULL,
  error_message       TEXT NULL,
  created             DATETIME NOT NULL,
  last_update         DATETIME NOT NULL,
  KEY ix_emaillog_campaign (campaign_id),
  KEY ix_emaillog_respondent (respondent_id),
  KEY ix_emaillog_provider_msg (provider_message_id),
  CONSTRAINT fk_emaillog_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
  CONSTRAINT fk_emaillog_respondent FOREIGN KEY (respondent_id) REFERENCES campaign_respondents(respondent_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS email_delivery_events (
  event_id            BIGINT AUTO_INCREMENT PRIMARY KEY,
  provider            ENUM('ses') NOT NULL DEFAULT 'ses',
  provider_message_id VARCHAR(256) NOT NULL,
  event_type          VARCHAR(64) NOT NULL,
  event_at            DATETIME NOT NULL,
  recipient_email     VARCHAR(256) NULL,
  payload_json        JSON NULL,
  KEY ix_ede_msg (provider_message_id),
  KEY ix_ede_type (event_type),
  KEY ix_ede_at (event_at)
) ENGINE=InnoDB;
