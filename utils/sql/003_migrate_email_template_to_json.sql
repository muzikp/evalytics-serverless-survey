-- Change email_template to JSON structure with title and body
-- Backup existing data first, then migrate structure

-- Step 1: Add new column for JSON structure
ALTER TABLE campaigns 
ADD COLUMN email_template_json JSON NULL COMMENT 'Email template with title and body' AFTER email_template;

-- Step 2: Migrate existing data (if any)
UPDATE campaigns 
SET email_template_json = JSON_OBJECT(
  'title', COALESCE(email_title, ''),
  'body', COALESCE(email_template, '')
)
WHERE email_template IS NOT NULL OR email_title IS NOT NULL;

-- Step 3: After verification, can drop old columns:
-- ALTER TABLE campaigns DROP COLUMN email_template;
-- ALTER TABLE campaigns DROP COLUMN email_title;
-- ALTER TABLE campaigns CHANGE COLUMN email_template_json email_template JSON NULL;
