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
  const templates = await query(
    `SELECT template_id, name, surveyjs_version, languages, created, last_update, created_by, last_modified_by
     FROM templates
     ORDER BY last_update DESC`
  );

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
  const now = formatDateTime();

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

  if (updates.length === 0) {
    return errorResponse(400, 'NO_UPDATES', 'No fields to update');
  }

  updates.push('last_update = NOW()');
  updates.push('last_modified_by = ?');
  params.push(user.user_id);
  params.push(templateId);

  const result = await query(
    `UPDATE templates SET ${updates.join(', ')} WHERE template_id = ?`,
    params
  );

  if (result.affectedRows === 0) {
    return errorResponse(404, 'NOT_FOUND', 'Template not found');
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
