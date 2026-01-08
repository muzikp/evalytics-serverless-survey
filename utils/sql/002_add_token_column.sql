-- Migration: Add token column to campaign_respondents
-- Date: 2026-01-08
-- Reason: Store plaintext token for private campaign URL generation in UI

ALTER TABLE campaign_respondents 
ADD COLUMN token VARCHAR(64) NULL 
COMMENT 'Plaintext token for private campaign URLs' 
AFTER email;

-- Note: Existing respondents will have NULL token
-- They need to be regenerated or updated manually

-- Add emailTemplateFields to campaigns for multilingual custom placeholders
ALTER TABLE campaigns
ADD COLUMN email_template_fields JSON NULL
COMMENT 'Custom email placeholders with multilingual values: [{"id":"greeting","cs":"Dobrý den","en":"Hello"}]'
AFTER email_template;

-- Add emailTemplateFields to campaigns for multilingual custom placeholders
ALTER TABLE campaigns
ADD COLUMN email_template_fields JSON NULL
COMMENT 'Custom email placeholders with multilingual values: [{"id":"greeting","cs":"Dobrý den","en":"Hello"}]'
AFTER email_template;
