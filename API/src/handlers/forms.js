// Forms handler - manages survey forms and their versions
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody, generateId, formatDateTime } from '../utils.js';
import { authenticate, requireRole } from '../auth.js';

/**
 * Handle /forms endpoints
 */
export async function handleForms(event, method, path, authToken) {
  const user = await authenticate(event, authToken);
  requireRole(user, 'admin');

  // GET /forms - List forms (with latest version info)
  if (path === '/forms' && method === 'GET') {
    return await listForms(event, user);
  }

  // POST /forms - Create new form with first version
  if (path === '/forms' && method === 'POST') {
    return await createForm(event, user);
  }

  // GET /forms/{id} - Get form with all versions
  const getMatch = path.match(/^\/forms\/([^/]+)$/);
  if (getMatch && method === 'GET') {
    return await getForm(getMatch[1]);
  }

  // PUT /forms/{id} - Update form (creates new version if needed)
  if (getMatch && method === 'PUT') {
    return await updateForm(event, user, getMatch[1]);
  }

  // DELETE /forms/{id} - Delete form and all versions
  if (getMatch && method === 'DELETE') {
    return await deleteForm(user, getMatch[1]);
  }

  return errorResponse(404, 'NOT_FOUND', 'Form endpoint not found');
}

async function listForms(event, user) {
  const params = event.queryStringParameters || {};
  const { 
    id,                    // form_id exact match
    q,                     // name fulltext search
    surveyjs_version,      // exact match on latest version
    languages,             // JSON array contains check on latest version
    created_by,            // exact match
    last_modified_by,      // exact match
    created_from,          // created >= this timestamp
    created_to,            // created <= this timestamp
    updated_from,          // last_update >= this timestamp
    updated_to             // last_update <= this timestamp
  } = params;

  let whereClauses = [];
  let queryParams = [];

  if (id) {
    whereClauses.push('f.form_id = ?');
    queryParams.push(id);
  }

  if (q) {
    whereClauses.push('f.name LIKE ?');
    queryParams.push(`%${q}%`);
  }

  if (surveyjs_version) {
    whereClauses.push('fv.surveyjs_version = ?');
    queryParams.push(surveyjs_version);
  }

  if (languages) {
    whereClauses.push('JSON_CONTAINS(fv.languages, JSON_QUOTE(?), "$")');
    queryParams.push(languages);
  }

  if (created_by) {
    whereClauses.push('f.created_by = ?');
    queryParams.push(created_by);
  }

  if (last_modified_by) {
    whereClauses.push('f.last_modified_by = ?');
    queryParams.push(last_modified_by);
  }

  if (created_from) {
    whereClauses.push('f.created >= ?');
    queryParams.push(created_from);
  }

  if (created_to) {
    whereClauses.push('f.created <= ?');
    queryParams.push(created_to);
  }

  if (updated_from) {
    whereClauses.push('f.last_update >= ?');
    queryParams.push(updated_from);
  }

  if (updated_to) {
    whereClauses.push('f.last_update <= ?');
    queryParams.push(updated_to);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  // Join with form_versions to get latest version info
  const sql = `SELECT 
                 f.form_id, 
                 f.name,
                 fv.version_id,
                 fv.version,
                 fv.surveyjs_version, 
                 fv.languages,
                 f.created, 
                 f.last_update, 
                 f.created_by, 
                 f.last_modified_by,
                 (SELECT COUNT(*) FROM form_versions WHERE form_id = f.form_id) as version_count
               FROM forms f
               INNER JOIN form_versions fv ON f.form_id = fv.form_id
               INNER JOIN (
                 SELECT form_id, MAX(version) as max_version
                 FROM form_versions
                 GROUP BY form_id
               ) latest ON fv.form_id = latest.form_id AND fv.version = latest.max_version
               ${whereClause}
               ORDER BY f.last_update DESC`;

  const forms = await query(sql, queryParams);

  return apiResponse(200, {
    forms: forms.map(t => ({
      ...t,
      languages: typeof t.languages === 'string' ? JSON.parse(t.languages) : t.languages
    }))
  });
}

async function createForm(event, user) {
  const body = parseBody(event);
  const { name, surveyjs_version, languages, data } = body;

  if (!name || !surveyjs_version || !data) {
    return errorResponse(400, 'MISSING_FIELDS', 'name, surveyjs_version, and data are required');
  }

  const formId = generateId(16);
  const versionId = generateId(16);
  const now = formatDateTime();

  // Create form master record
  await query(
    `INSERT INTO forms (form_id, name, created, last_update, created_by, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [formId, name, now, now, user.user_id, user.user_id]
  );

  // Create first version (v1)
  await query(
    `INSERT INTO form_versions (version_id, form_id, form_name, version, surveyjs_version, languages, data, created, last_update, created_by, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      versionId,
      formId,
      name,
      1,
      surveyjs_version,
      JSON.stringify(languages || ['en']),
      JSON.stringify(data),
      now,
      now,
      user.user_id,
      user.user_id
    ]
  );

  const form = await getForm(formId);
  return apiResponse(201, form.body ? JSON.parse(form.body) : {});
}

async function getForm(formId) {
  // Get form master record
  const form = await queryOne(
    `SELECT form_id, name, created, last_update, created_by, last_modified_by
     FROM forms
     WHERE form_id = ?`,
    [formId]
  );

  if (!form) {
    return errorResponse(404, 'NOT_FOUND', 'Form not found');
  }

  // Get all versions of this form
  const versions = await query(
    `SELECT version_id, form_id, version, surveyjs_version, languages, data, created, last_update, created_by, last_modified_by
     FROM form_versions
     WHERE form_id = ?
     ORDER BY version DESC`,
    [formId]
  );

  return apiResponse(200, {
    ...form,
    versions: versions.map(v => ({
      ...v,
      languages: typeof v.languages === 'string' ? JSON.parse(v.languages) : v.languages,
      data: typeof v.data === 'string' ? JSON.parse(v.data) : v.data
    }))
  });
}
    [FormId]
  );

  if (!Form) {
    return errorResponse(404, 'NOT_FOUND', 'Form not found');
  }

  return apiResponse(200, {
    ...Form,
    languages: typeof Form.languages === 'string' ? JSON.parse(Form.languages) : Form.languages,
    data: typeof Form.data === 'string' ? JSON.parse(Form.data) : Form.data
  });
}

async function updateForm(event, user, formId) {
  const body = parseBody(event);
  const { name, surveyjs_version, languages, data } = body;

  // At minimum need data to create new version
  if (!data) {
    return errorResponse(400, 'MISSING_DATA', 'data is required to update form');
  }

  // Get current form
  const form = await queryOne(
    'SELECT * FROM forms WHERE form_id = ?',
    [formId]
  );

  if (!form) {
    return errorResponse(404, 'NOT_FOUND', 'Form not found');
  }

  // Get latest version
  const latestVersion = await queryOne(
    'SELECT * FROM form_versions WHERE form_id = ? ORDER BY version DESC LIMIT 1',
    [formId]
  );

  if (!latestVersion) {
    return errorResponse(500, 'INTERNAL_ERROR', 'Form has no versions');
  }

  // Check if latest version has active campaigns
  const activeCampaigns = await query(
    `SELECT campaign_id FROM campaigns 
     WHERE version_id = ? 
     AND (open_on IS NULL OR open_on <= NOW()) 
     AND (close_on IS NULL OR close_on >= NOW())`,
    [latestVersion.version_id]
  );

  const now = formatDateTime();
  const useName = name || form.name;
  const useSurveyJsVersion = surveyjs_version || latestVersion.surveyjs_version;
  const useLanguages = languages || (typeof latestVersion.languages === 'string' ? JSON.parse(latestVersion.languages) : latestVersion.languages);

  if (activeCampaigns.length > 0) {
    // Active campaigns exist - create new version
    const newVersionId = generateId(16);
    const newVersionNumber = latestVersion.version + 1;

    await query(
      `INSERT INTO form_versions (version_id, form_id, form_name, version, surveyjs_version, languages, data, created, last_update, created_by, last_modified_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newVersionId,
        formId,
        useName,
        newVersionNumber,
        useSurveyJsVersion,
        JSON.stringify(useLanguages),
        JSON.stringify(data),
        now,
        now,
        user.user_id,
        user.user_id
      ]
    );

    // Update form master record
    await query(
      'UPDATE forms SET name = ?, last_update = ?, last_modified_by = ? WHERE form_id = ?',
      [useName, now, user.user_id, formId]
    );

    const updatedForm = await getForm(formId);
    return apiResponse(200, updatedForm.body ? JSON.parse(updatedForm.body) : {});
  } else {
    // No active campaigns - update existing version
    await query(
      `UPDATE form_versions 
       SET surveyjs_version = ?, languages = ?, data = ?, last_update = ?, last_modified_by = ?
       WHERE version_id = ?`,
      [
        useSurveyJsVersion,
        JSON.stringify(useLanguages),
        JSON.stringify(data),
        now,
        user.user_id,
        latestVersion.version_id
      ]
    );

    // Update form master record
    await query(
      'UPDATE forms SET name = ?, last_update = ?, last_modified_by = ? WHERE form_id = ?',
      [useName, now, user.user_id, formId]
    );

    const updatedForm = await getForm(formId);
    return apiResponse(200, updatedForm.body ? JSON.parse(updatedForm.body) : {});
  }
}

async function deleteForm(user, formId) {
  const form = await queryOne(
    'SELECT form_id FROM forms WHERE form_id = ?',
    [formId]
  );

  if (!form) {
    return errorResponse(404, 'NOT_FOUND', 'Form not found');
  }

  // Check if any version has campaigns
  const campaigns = await query(
    `SELECT c.campaign_id 
     FROM campaigns c
     INNER JOIN form_versions fv ON c.version_id = fv.version_id
     WHERE fv.form_id = ?`,
    [formId]
  );

  if (campaigns.length > 0) {
    return errorResponse(400, 'HAS_CAMPAIGNS', 'Cannot delete form with associated campaigns');
  }

  // Delete all versions first
  await query('DELETE FROM form_versions WHERE form_id = ?', [formId]);
  
  // Delete form master record
  await query('DELETE FROM forms WHERE form_id = ?', [formId]);

  return apiResponse(200, { message: 'Form deleted successfully' });
}


