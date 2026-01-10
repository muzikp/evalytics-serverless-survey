-- Migration: Add respondent_fields and default_language to campaigns table
-- Date: 2026-01-09
-- Description: Add columns for storing respondent field configuration and default campaign language

ALTER TABLE campaigns 
ADD COLUMN respondent_fields JSON NULL COMMENT 'Respondent field configuration: [{"id":"field_ra_...","label":"Salutation","type":"dictionary","dataKey":"salutation"}]' AFTER email_template_fields,
ADD COLUMN default_language VARCHAR(10) DEFAULT 'en' COMMENT 'Default language for campaign (en, cs, de)' AFTER respondent_fields;
