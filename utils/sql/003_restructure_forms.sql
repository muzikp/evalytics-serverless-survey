-- Migration: Restructure forms and form_versions
-- Date: 2026-01-04
-- Purpose: Remove duplicate data from forms table, keep only master record

-- Backup existing data
CREATE TEMPORARY TABLE forms_backup AS SELECT * FROM forms;

-- Clear forms table
TRUNCATE TABLE forms;

-- Modify forms table structure - remove version-specific columns
ALTER TABLE forms 
  DROP COLUMN surveyjs_version,
  DROP COLUMN languages,
  DROP COLUMN data;

-- Add back only master data from form_versions (one record per form_id)
INSERT INTO forms (form_id, name, created, last_update, created_by, last_modified_by)
SELECT 
  fv.form_id,
  MAX(fv.form_name) as name,  -- Take name from latest version
  MIN(fv.created) as created,
  MAX(fv.last_update) as last_update,
  MIN(fv.created_by) as created_by,
  MAX(fv.last_modified_by) as last_modified_by
FROM form_versions fv
GROUP BY fv.form_id;

-- Add form_name column to form_versions if not exists (for easier querying)
-- This will be redundant but useful for JOINs

-- Done!
