-- Add email_title and respondent_fields columns to campaigns table
ALTER TABLE campaigns 
ADD COLUMN email_title TEXT NULL COMMENT 'Email subject line with placeholders' AFTER email_template_fields,
ADD COLUMN respondent_fields JSON NULL COMMENT 'Configuration of respondent table fields (name, label, type, required)' AFTER email_title;
