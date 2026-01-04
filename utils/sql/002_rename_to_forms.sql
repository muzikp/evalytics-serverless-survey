-- Migration: Rename templates to forms, snapshots to form_versions
-- Date: 2026-01-04

-- Rename tables
ALTER TABLE templates RENAME TO forms;
ALTER TABLE snapshots RENAME TO form_versions;

-- Rename columns in form_versions
ALTER TABLE form_versions CHANGE COLUMN snapshot_id version_id VARCHAR(16);

-- Rename columns in campaigns (references)
ALTER TABLE campaigns CHANGE COLUMN snapshot_id version_id VARCHAR(16);

-- Done! Tables and columns renamed.
