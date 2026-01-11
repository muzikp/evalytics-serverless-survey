-- ========================================
-- MIGRATION 010: Email Sending Features
-- ========================================
-- Adds support for:
-- - Reminder email templates
-- - Unsubscribe tokens
-- - Enhanced blacklist with scope (campaign vs global)
--
-- Run: mysql -u vcagent -pPASSWORD evalytics_survey < 010_email_sending.sql
-- ========================================

USE evalytics_survey;

-- 1. Add reminder_template to campaigns (check if exists first)
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'evalytics_survey' 
    AND TABLE_NAME = 'campaigns' 
    AND COLUMN_NAME = 'reminder_template'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE campaigns 
   ADD COLUMN reminder_template JSON NULL 
     COMMENT ''Reminder email template (same structure as email_template)'' 
   AFTER email_template',
  'SELECT "Column reminder_template already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 2. Add unsubscribe_token to campaign_respondents
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'evalytics_survey' 
    AND TABLE_NAME = 'campaign_respondents' 
    AND COLUMN_NAME = 'unsubscribe_token'
);

SET @sql = IF(@col_exists = 0,
  'ALTER TABLE campaign_respondents 
   ADD COLUMN unsubscribe_token VARCHAR(64) NULL 
     COMMENT ''Unique token for unsubscribe links'' 
   AFTER token_hash',
  'SELECT "Column unsubscribe_token already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add unique index for unsubscribe_token
SET @idx_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = 'evalytics_survey' 
    AND TABLE_NAME = 'campaign_respondents' 
    AND INDEX_NAME = 'uq_unsubscribe_token'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE campaign_respondents 
   ADD UNIQUE KEY uq_unsubscribe_token (unsubscribe_token)',
  'SELECT "Index uq_unsubscribe_token already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 3. Enhance email_blacklist with scope
-- Check if scope column exists
SET @col_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'evalytics_survey' 
    AND TABLE_NAME = 'email_blacklist' 
    AND COLUMN_NAME = 'scope'
);

-- Add scope if it doesn't exist
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE email_blacklist 
   ADD COLUMN scope ENUM(''global'', ''campaign'') NOT NULL DEFAULT ''global'' 
     COMMENT ''global=all emails, campaign=specific campaign only'' 
   AFTER email',
  'SELECT "Column scope already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add campaign_id if scope column was just added
SET @sql = IF(@col_exists = 0,
  'ALTER TABLE email_blacklist 
   ADD COLUMN campaign_id VARCHAR(16) NULL 
     COMMENT ''Campaign ID (if scope=campaign, FK → campaigns.campaign_id)'' 
   AFTER scope',
  'SELECT "Skipping campaign_id" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add unsubscribe_all flag
SET @col_exists2 = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.COLUMNS 
  WHERE TABLE_SCHEMA = 'evalytics_survey' 
    AND TABLE_NAME = 'email_blacklist' 
    AND COLUMN_NAME = 'unsubscribe_all'
);

SET @sql = IF(@col_exists2 = 0,
  'ALTER TABLE email_blacklist 
   ADD COLUMN unsubscribe_all TINYINT(1) NOT NULL DEFAULT 0 
     COMMENT ''0=campaign only, 1=all emails'' 
   AFTER campaign_id',
  'SELECT "Column unsubscribe_all already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Add index for scope+campaign lookup
SET @idx_exists = (
  SELECT COUNT(*) 
  FROM INFORMATION_SCHEMA.STATISTICS 
  WHERE TABLE_SCHEMA = 'evalytics_survey' 
    AND TABLE_NAME = 'email_blacklist' 
    AND INDEX_NAME = 'idx_scope_campaign'
);

SET @sql = IF(@idx_exists = 0,
  'ALTER TABLE email_blacklist 
   ADD KEY idx_scope_campaign (scope, campaign_id)',
  'SELECT "Index idx_scope_campaign already exists" AS message'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ========================================
-- VERIFICATION
-- ========================================
SELECT 
  'campaigns' AS table_name,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'evalytics_survey' 
  AND TABLE_NAME = 'campaigns'
  AND COLUMN_NAME = 'reminder_template'

UNION ALL

SELECT 
  'campaign_respondents' AS table_name,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'evalytics_survey' 
  AND TABLE_NAME = 'campaign_respondents'
  AND COLUMN_NAME = 'unsubscribe_token'

UNION ALL

SELECT 
  'email_blacklist' AS table_name,
  COLUMN_NAME,
  COLUMN_TYPE,
  IS_NULLABLE,
  COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'evalytics_survey' 
  AND TABLE_NAME = 'email_blacklist'
  AND COLUMN_NAME IN ('scope', 'campaign_id', 'unsubscribe_all');

-- ========================================
-- NOTES
-- ========================================
-- 1. Unsubscribe tokens are generated when respondents are created
-- 2. Reminder template has same structure as email_template (multilingual JSON)
-- 3. Blacklist scope:
--    - 'campaign': only blocks emails for specific campaign
--    - 'global': blocks all emails from the service
-- 4. unsubscribe_all flag helps quick filtering without checking scope
