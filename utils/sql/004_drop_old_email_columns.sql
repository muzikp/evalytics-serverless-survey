-- Drop old email_template and email_title columns
-- These are replaced by email_template_json

-- Verify data migration first
SELECT 
  campaign_id,
  CASE WHEN email_template IS NOT NULL THEN 'has_old' ELSE 'empty' END as email_template_status,
  CASE WHEN email_template_json IS NOT NULL THEN 'has_new' ELSE 'empty' END as email_template_json_status,
  CASE WHEN email_title IS NOT NULL THEN 'has_title' ELSE 'empty' END as email_title_status
FROM campaigns
LIMIT 5;

-- After verification, drop old columns:
ALTER TABLE campaigns DROP COLUMN email_template;
ALTER TABLE campaigns DROP COLUMN email_title;

-- Rename email_template_json to email_template
ALTER TABLE campaigns CHANGE COLUMN email_template_json email_template JSON NULL COMMENT 'Email template with title and body as JSON';
