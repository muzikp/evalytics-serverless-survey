-- Add version_description column to form_versions table
-- This allows users to add notes/comments about what changed in each version

ALTER TABLE form_versions 
ADD COLUMN version_description TEXT NULL 
AFTER version;

-- Update existing versions with default description
UPDATE form_versions 
SET version_description = CONCAT('Version ', version)
WHERE version_description IS NULL;
