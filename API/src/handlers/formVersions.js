// Form Versions handler - manages individual versions of forms
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody, generateId, formatDateTime, extractLanguagesFromSurveyJson } from '../utils.js';
import { authenticate, requireRole } from '../auth.js';

/**
 * Handle /form-versions endpoints
 */
export async function handleFormVersions(event, method, path, authToken) {
  const user = await authenticate(event, authToken);
  requireRole(user, 'admin');

  // GET /form-versions - List all form versions (with optional filtering)
  if (path === '/form-versions' && method === 'GET') {
    return await listFormVersions(event, user);
  }

  // POST /form-versions - Create new version (rare - usually done via PUT /forms/{id})
  if (path === '/form-versions' && method === 'POST') {
    return await createFormVersion(event, user);
  }

  // GET /form-versions/{id} - Get specific version
  const getMatch = path.match(/^\/form-versions\/([^/]+)$/);
  if (getMatch && method === 'GET') {
    return await getFormVersion(getMatch[1]);
  }

  // PUT /form-versions/{id} - Update version (restricted if campaigns active)
  if (getMatch && method === 'PUT') {
    return await updateFormVersion(event, user, getMatch[1]);
  }

  // DELETE /form-versions/{id} - Delete version (check campaigns first)
  if (getMatch && method === 'DELETE') {
    return await deleteFormVersion(user, getMatch[1]);
  }

  return errorResponse(404, 'NOT_FOUND', 'Form version endpoint not found');
}

async function listFormVersions(event, user) {
  const params = event.queryStringParameters || {};
  const limit = parseInt(params.limit || '50');
  const offset = parseInt(params.offset || '0');
  
  const {
    id,                    // version_id exact match
    form_id,               // form_id to get all versions of specific form
    version,               // version number exact match
    surveyjs_version,      // exact match
    languages,             // JSON array contains check
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
    whereClauses.push('fv.version_id = ?');
    queryParams.push(id);
  }

  if (form_id) {
    whereClauses.push('fv.form_id = ?');
    queryParams.push(form_id);
  }

  if (version) {
    whereClauses.push('fv.version = ?');
    queryParams.push(parseInt(version));
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
    whereClauses.push('fv.created_by = ?');
    queryParams.push(created_by);
  }

  if (last_modified_by) {
    whereClauses.push('fv.last_modified_by = ?');
    queryParams.push(last_modified_by);
  }

  if (created_from) {
    whereClauses.push('fv.created >= ?');
    queryParams.push(created_from);
  }

  if (created_to) {
    whereClauses.push('fv.created <= ?');
    queryParams.push(created_to);
  }

  if (updated_from) {
    whereClauses.push('fv.last_update >= ?');
    queryParams.push(updated_from);
  }

  if (updated_to) {
    whereClauses.push('fv.last_update <= ?');
    queryParams.push(updated_to);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

  let sql = `
    SELECT fv.version_id, fv.form_id, fv.form_name, fv.version, fv.version_description,
           fv.surveyjs_version, fv.languages, fv.created, fv.last_update, fv.created_by, fv.last_modified_by,
           (SELECT COUNT(*) FROM campaigns WHERE version_id = fv.version_id) as campaign_count
    FROM form_versions fv
    ${whereClause}
  `;

  // Note: LIMIT and OFFSET must be directly interpolated (not as params) due to MySQL2 driver limitations
  sql += ` ORDER BY fv.created DESC LIMIT ${limit} OFFSET ${offset}`;

  const versions = await query(sql, queryParams);

  // Get total count with same filters
  let countSql = `SELECT COUNT(*) as total FROM form_versions fv ${whereClause}`;
  const countResult = await query(countSql, queryParams);
  const total = countResult[0].total;

  return apiResponse(200, {
    items: versions.map(v => ({
      ...v,
      languages: typeof v.languages === 'string' ? JSON.parse(v.languages) : v.languages
    })),
    page: {
      limit,
      offset,
      total
    }
  });
}

async function createFormVersion(event, user) {
  const body = parseBody(event);
  const { form_id, surveyjs_version, data, version_description } = body;

  if (!form_id || !data) {
    return errorResponse(400, 'MISSING_FIELDS', 'form_id and data are required');
  }

  // Get form master record
  const form = await queryOne(
    'SELECT * FROM forms WHERE form_id = ?',
    [form_id]
  );

  if (!form) {
    return errorResponse(404, 'NOT_FOUND', 'Form not found');
  }

  // Get latest version to determine next version number
  const lastVersion = await queryOne(
    'SELECT MAX(version) as max_version, surveyjs_version FROM form_versions WHERE form_id = ? GROUP BY surveyjs_version LIMIT 1',
    [form_id]
  );
  
  const newVersionNumber = (lastVersion?.max_version || 0) + 1;

  // Auto-extract languages from survey JSON
  const detectedLanguages = extractLanguagesFromSurveyJson(data);

  const versionId = generateId(16);
  const now = formatDateTime();

  await query(
    `INSERT INTO form_versions (version_id, form_id, form_name, version, version_description, surveyjs_version, languages, data, created, last_update, created_by, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      versionId,
      form_id,
      form.name,
      newVersionNumber,
      version_description || `Version ${newVersionNumber}`,
      surveyjs_version || lastVersion?.surveyjs_version || '1.9',
      JSON.stringify(detectedLanguages),
      JSON.stringify(data),
      now,
      now,
      user.user_id,
      user.user_id
    ]
  );

  return await getFormVersion(versionId);
}

async function getFormVersion(versionId) {
  const version = await queryOne(
    `SELECT fv.version_id, fv.form_id, fv.form_name, fv.version, fv.version_description,
            fv.surveyjs_version, fv.languages, fv.data, fv.created, fv.last_update, fv.created_by, fv.last_modified_by,
            (SELECT COUNT(*) FROM campaigns WHERE version_id = fv.version_id) as campaign_count
     FROM form_versions fv
     WHERE fv.version_id = ?`,
    [versionId]
  );

  if (!version) {
    return errorResponse(404, 'NOT_FOUND', 'Form version not found');
  }

  return apiResponse(200, {
    ...version,
    languages: typeof version.languages === 'string' ? JSON.parse(version.languages) : version.languages,
    data: typeof version.data === 'string' ? JSON.parse(version.data) : version.data
  });
}

async function updateFormVersion(event, user, versionId) {
  const body = parseBody(event);
  const { surveyjs_version, languages, data, version_description } = body;

  // Check if version has active campaigns
  const activeCampaigns = await query(
    `SELECT campaign_id FROM campaigns 
     WHERE version_id = ? 
     AND (open_on IS NULL OR open_on <= NOW()) 
     AND (close_on IS NULL OR close_on >= NOW())`,
    [versionId]
  );

  if (activeCampaigns.length > 0) {
    return errorResponse(400, 'HAS_ACTIVE_CAMPAIGNS', 'Cannot update version with active campaigns');
  }

  const updates = [];
  const params = [];

  if (surveyjs_version !== undefined) {
    updates.push('surveyjs_version = ?');
    params.push(surveyjs_version);
  }
  if (languages !== undefined) {
    updates.push('languages = ?');
    params.push(JSON.stringify(languages));
  }
  if (data !== undefined) {
    updates.push('data = ?');
    params.push(JSON.stringify(data));
  }
  if (version_description !== undefined) {
    updates.push('version_description = ?');
    params.push(version_description);
  }

  if (updates.length === 0) {
    return errorResponse(400, 'NO_UPDATES', 'No fields to update');
  }

  updates.push('last_update = NOW()');
  updates.push('last_modified_by = ?');
  params.push(user.user_id);
  params.push(versionId);

  const result = await query(
    `UPDATE form_versions SET ${updates.join(', ')} WHERE version_id = ?`,
    params
  );

  if (result.affectedRows === 0) {
    return errorResponse(404, 'NOT_FOUND', 'Form version not found');
  }

  return await getFormVersion(versionId);
}

async function deleteFormVersion(user, versionId) {
  // Check if version is used in any campaigns
  const campaigns = await query(
    'SELECT campaign_id FROM campaigns WHERE version_id = ?',
    [versionId]
  );

  if (campaigns.length > 0) {
    return errorResponse(400, 'HAS_CAMPAIGNS', 'Cannot delete version used in campaigns');
  }

  const result = await query('DELETE FROM form_versions WHERE version_id = ?', [versionId]);

  if (result.affectedRows === 0) {
    return errorResponse(404, 'NOT_FOUND', 'FormVersion not found');
  }

return apiResponse(200, { message: 'Form version deleted successfully' });
}



