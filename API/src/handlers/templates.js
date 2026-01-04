// Templates handler
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody, generateId, formatDateTime } from '../utils.js';
import { authenticate, requireRole } from '../auth.js';

/**
 * Handle /templates endpoints
 */
export async function handleTemplates(event, method, path, authToken) {
  const user = await authenticate(event, authToken);
  requireRole(user, 'admin');

  // GET /templates - List templates
  if (path === '/templates' && method === 'GET') {
    return await listTemplates(event, user);
  }

  // POST /templates - Create template
  if (path === '/templates' && method === 'POST') {
    return await createTemplate(event, user);
  }

  // GET /templates/{id}
  const getMatch = path.match(/^\/templates\/([^/]+)$/);
  if (getMatch && method === 'GET') {
    return await getTemplate(getMatch[1]);
  }

  // PUT /templates/{id}
  if (getMatch && method === 'PUT') {
    return await updateTemplate(event, user, getMatch[1]);
  }

  // DELETE /templates/{id}
  if (getMatch && method === 'DELETE') {
    return await deleteTemplate(user, getMatch[1]);
  }

  return errorResponse(404, 'NOT_FOUND', 'Template endpoint not found');
}

async function listTemplates(event, user) {
  const params = event.queryStringParameters || {};
  const { 
    id,                    // template_id exact match
    q,                     // name fulltext search
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
    whereClauses.push('template_id = ?');
    queryParams.push(id);
  }

  if (q) {
    whereClauses.push('name LIKE ?');
    queryParams.push(`%${q}%`);
  }

  if (surveyjs_version) {
    whereClauses.push('surveyjs_version = ?');
    queryParams.push(surveyjs_version);
  }

  if (languages) {
    // Support searching for templates that contain a specific language
    // Expects languages param to be a single language code (e.g., "en", "cs")
    whereClauses.push('JSON_CONTAINS(languages, JSON_QUOTE(?), "$")');
    queryParams.push(languages);
  }

  if (created_by) {
    whereClauses.push('created_by = ?');
    queryParams.push(created_by);
  }

  if (last_modified_by) {
    whereClauses.push('last_modified_by = ?');
    queryParams.push(last_modified_by);
  }

  if (created_from) {
    whereClauses.push('created >= ?');
    queryParams.push(created_from);
  }

  if (created_to) {
    whereClauses.push('created <= ?');
    queryParams.push(created_to);
  }

  if (updated_from) {
    whereClauses.push('last_update >= ?');
    queryParams.push(updated_from);
  }

  if (updated_to) {
    whereClauses.push('last_update <= ?');
    queryParams.push(updated_to);
  }

  const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const sql = `SELECT template_id, name, surveyjs_version, languages, created, last_update, created_by, last_modified_by
               FROM templates
               ${whereClause}
               ORDER BY last_update DESC`;

  const templates = await query(sql, queryParams);

  return apiResponse(200, {
    templates: templates.map(t => ({
      ...t,
      languages: typeof t.languages === 'string' ? JSON.parse(t.languages) : t.languages
    }))
  });
}

async function createTemplate(event, user) {
  const body = parseBody(event);
  const { name, surveyjs_version, languages, data } = body;

  if (!name || !surveyjs_version || !data) {
    return errorResponse(400, 'MISSING_FIELDS', 'name, surveyjs_version, and data are required');
  }

  const templateId = generateId(16);
  const snapshotId = generateId(16);
  const now = formatDateTime();

  // Create template
  await query(
    `INSERT INTO templates (template_id, name, surveyjs_version, languages, data, created, last_update, created_by, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      templateId,
      name,
      surveyjs_version,
      JSON.stringify(languages || ['en']),
      JSON.stringify(data),
      now,
      now,
      user.user_id,
      user.user_id
    ]
  );

  // Automatically create first snapshot (version 1)
  await query(
    `INSERT INTO snapshots (snapshot_id, template_id, version, surveyjs_version, languages, data, created, last_update, created_by, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshotId,
      templateId,
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

  const template = await getTemplate(templateId);
  return apiResponse(201, template.body ? JSON.parse(template.body) : {});
}

async function getTemplate(templateId) {
  const template = await queryOne(
    `SELECT template_id, name, surveyjs_version, languages, data, created, last_update, created_by, last_modified_by
     FROM templates
     WHERE template_id = ?`,
    [templateId]
  );

  if (!template) {
    return errorResponse(404, 'NOT_FOUND', 'Template not found');
  }

  return apiResponse(200, {
    ...template,
    languages: typeof template.languages === 'string' ? JSON.parse(template.languages) : template.languages,
    data: typeof template.data === 'string' ? JSON.parse(template.data) : template.data
  });
}

async function updateTemplate(event, user, templateId) {
  const body = parseBody(event);
  const { name, surveyjs_version, languages, data } = body;

  if (!name && !surveyjs_version && !languages && !data) {
    return errorResponse(400, 'NO_UPDATES', 'No fields to update');
  }

  // Get current template
  const template = await queryOne(
    'SELECT * FROM templates WHERE template_id = ?',
    [templateId]
  );

  if (!template) {
    return errorResponse(404, 'NOT_FOUND', 'Template not found');
  }

  // Get latest snapshot
  const latestSnapshot = await queryOne(
    'SELECT * FROM snapshots WHERE template_id = ? ORDER BY version DESC LIMIT 1',
    [templateId]
  );

  if (!latestSnapshot) {
    return errorResponse(500, 'INTERNAL_ERROR', 'Template has no snapshots');
  }

  // Check if latest snapshot has active campaigns
  const activeCampaigns = await query(
    `SELECT campaign_id FROM campaigns 
     WHERE snapshot_id = ? 
     AND (open_on IS NULL OR open_on <= NOW()) 
     AND (close_on IS NULL OR close_on >= NOW())`,
    [latestSnapshot.snapshot_id]
  );

  const now = formatDateTime();
  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }
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

  updates.push('last_update = NOW()');
  updates.push('last_modified_by = ?');
  params.push(user.user_id);
  params.push(templateId);

  // Update template
  await query(
    `UPDATE templates SET ${updates.join(', ')} WHERE template_id = ?`,
    params
  );

  if (activeCampaigns.length > 0) {
    // Has active campaigns → create new snapshot (version++)
    const newSnapshotId = generateId(16);
    const newVersion = latestSnapshot.version + 1;

    await query(
      `INSERT INTO snapshots (snapshot_id, template_id, version, surveyjs_version, languages, data, created, last_update, created_by, last_modified_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newSnapshotId,
        templateId,
        newVersion,
        surveyjs_version !== undefined ? surveyjs_version : template.surveyjs_version,
        languages !== undefined ? JSON.stringify(languages) : template.languages,
        data !== undefined ? JSON.stringify(data) : template.data,
        now,
        now,
        user.user_id,
        user.user_id
      ]
    );
  } else {
    // No active campaigns → update existing snapshot (same version)
    const snapshotUpdates = [];
    const snapshotParams = [];

    if (surveyjs_version !== undefined) {
      snapshotUpdates.push('surveyjs_version = ?');
      snapshotParams.push(surveyjs_version);
    }
    if (languages !== undefined) {
      snapshotUpdates.push('languages = ?');
      snapshotParams.push(JSON.stringify(languages));
    }
    if (data !== undefined) {
      snapshotUpdates.push('data = ?');
      snapshotParams.push(JSON.stringify(data));
    }

    if (snapshotUpdates.length > 0) {
      snapshotUpdates.push('last_update = NOW()');
      snapshotUpdates.push('last_modified_by = ?');
      snapshotParams.push(user.user_id);
      snapshotParams.push(latestSnapshot.snapshot_id);

      await query(
        `UPDATE snapshots SET ${snapshotUpdates.join(', ')} WHERE snapshot_id = ?`,
        snapshotParams
      );
    }
  }

  return await getTemplate(templateId);
}

async function deleteTemplate(user, templateId) {
  const result = await query('DELETE FROM templates WHERE template_id = ?', [templateId]);

  if (result.affectedRows === 0) {
    return errorResponse(404, 'NOT_FOUND', 'Template not found');
  }

  return apiResponse(204, {});
}
