SET FOREIGN_KEY_CHECKS=0;

ALTER TABLE forms DROP COLUMN surveyjs_version;
ALTER TABLE forms DROP COLUMN languages;
ALTER TABLE forms DROP COLUMN data;

DELETE FROM forms;

INSERT INTO forms (form_id, name, created, last_update, created_by, last_modified_by)
SELECT fv.form_id, 
       CONCAT('Form ', fv.form_id) as name,
       MIN(fv.created) as created, 
       MAX(fv.last_update) as last_update,
       MIN(fv.created_by) as created_by, 
       MAX(fv.last_modified_by) as last_modified_by
FROM form_versions fv 
GROUP BY fv.form_id;

SET FOREIGN_KEY_CHECKS=1;

SELECT COUNT(*) as forms_count FROM forms;
SELECT * FROM forms;
