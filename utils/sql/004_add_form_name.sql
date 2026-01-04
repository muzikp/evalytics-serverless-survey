ALTER TABLE form_versions ADD COLUMN form_name VARCHAR(256) AFTER form_id;

UPDATE form_versions fv 
JOIN forms f ON fv.form_id = f.form_id 
SET fv.form_name = f.name;

SELECT form_id, form_name, version FROM form_versions ORDER BY form_id, version LIMIT 10;
