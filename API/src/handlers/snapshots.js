// Snapshots handler
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody, generateId, formatDateTime } from '../utils.js';
import { authenticate, requireRole } from '../auth.js';

export async function handleSnapshots(event, method, path, authToken) {
  const user = await authenticate(event, authToken);
  requireRole(user, 'admin');

  // GET /snapshots - List snapshots
  if (path === '/snapshots' && method === 'GET') {
    return await listSnapshots(event, user);
  }

  // POST /snapshots - Create snapshot
  if (path === '/snapshots' && method === 'POST') {
    return await createSnapshot(event, user);
  }

  // GET /snapshots/{id}
  const getMatch = path.match(/^\/snapshots\/([^/]+)$/);
  if (getMatch && method === 'GET') {
    return await getSnapshot(getMatch[1]);
  }

  // POST /snapshots/{id} - Update snapshot
  if (getMatch && method === 'POST') {
    return await updateSnapshot(event, user, getMatch[1]);
  }

  // DELETE /snapshots/{id}
  if (getMatch && method === 'DELETE') {
    return await deleteSnapshot(user, getMatch[1]);
  }

  return errorResponse(404, 'NOT_FOUND', 'Snapshot endpoint not found');
}

async function listSnapshots(event, user) {
  const params = event.queryStringParameters || {};
  const limit = parseInt(params.limit || '50');
  const offset = parseInt(params.offset || '0');
  const templateId = params.template_id;

  let sql = `
    SELECT s.*, t.name as template_name,
           u1.firstname as created_by_firstname, u1.lastname as created_by_lastname,
           u2.firstname as modified_by_firstname, u2.lastname as modified_by_lastname
    FROM snapshots s
    LEFT JOIN templates t ON s.template_id = t.template_id
    LEFT JOIN users u1 ON s.created_by = u1.user_id
    LEFT JOIN users u2 ON s.last_modified_by = u2.user_id
  `;
  const sqlParams = [];

  if (templateId) {
    sql += ' WHERE s.template_id = ?';
    sqlParams.push(templateId);
  }

  // Note: LIMIT and OFFSET must be directly interpolated (not as params) due to MySQL2 driver limitations
  sql += ` ORDER BY s.created DESC LIMIT ${limit} OFFSET ${offset}`;

  const snapshots = await query(sql, sqlParams);

  // Get total count
  let countSql = 'SELECT COUNT(*) as total FROM snapshots';
  const countParams = [];
  if (templateId) {
    countSql += ' WHERE template_id = ?';
    countParams.push(templateId);
  }
  const countResult = await query(countSql, countParams);
  const total = countResult[0].total;

  return apiResponse(200, {
    items: snapshots.map(s => ({
      ...s,
      languages: typeof s.languages === 'string' ? JSON.parse(s.languages) : s.languages,
      data: typeof s.data === 'string' ? JSON.parse(s.data) : s.data
    })),
    page: {
      limit,
      offset,
      total
    }
  });
}

async function createSnapshot(event, user) {
  const body = parseBody(event);
  const { template_id, version, note } = body;

  if (!template_id) {
    return errorResponse(400, 'MISSING_FIELDS', 'template_id is required');
  }

  // Get template
  const template = await queryOne(
    'SELECT * FROM templates WHERE template_id = ?',
    [template_id]
  );

  if (!template) {
    return errorResponse(404, 'NOT_FOUND', 'Template not found');
  }

  // Determine version number
  let snapshotVersion = version;
  if (!snapshotVersion) {
    const lastVersion = await queryOne(
      'SELECT MAX(version) as max_version FROM snapshots WHERE template_id = ?',
      [template_id]
    );
    snapshotVersion = (lastVersion?.max_version || 0) + 1;
  }

  // Check if version already exists
  const existing = await queryOne(
    'SELECT snapshot_id FROM snapshots WHERE template_id = ? AND version = ?',
    [template_id, snapshotVersion]
  );

  if (existing) {
    return errorResponse(409, 'CONFLICT', 'Snapshot version already exists');
  }

  const snapshotId = generateId(16);
  const now = formatDateTime();

  await query(
    `INSERT INTO snapshots (snapshot_id, template_id, version, surveyjs_version, languages, data, created, last_update, created_by, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      snapshotId,
      template_id,
      snapshotVersion,
      template.surveyjs_version,
      template.languages,
      template.data,
      now,
      now,
      user.user_id,
      user.user_id
    ]
  );

  return await getSnapshot(snapshotId);
}

async function getSnapshot(snapshotId) {
  const snapshot = await queryOne(
    `SELECT s.*, t.name as template_name,
            u1.firstname as created_by_firstname, u1.lastname as created_by_lastname,
            u2.firstname as modified_by_firstname, u2.lastname as modified_by_lastname
     FROM snapshots s
     LEFT JOIN templates t ON s.template_id = t.template_id
     LEFT JOIN users u1 ON s.created_by = u1.user_id
     LEFT JOIN users u2 ON s.last_modified_by = u2.user_id
     WHERE s.snapshot_id = ?`,
    [snapshotId]
  );

  if (!snapshot) {
    return errorResponse(404, 'NOT_FOUND', 'Snapshot not found');
  }

  return apiResponse(200, {
    ...snapshot,
    languages: typeof snapshot.languages === 'string' ? JSON.parse(snapshot.languages) : snapshot.languages,
    data: typeof snapshot.data === 'string' ? JSON.parse(snapshot.data) : snapshot.data
  });
}

async function updateSnapshot(event, user, snapshotId) {
  const body = parseBody(event);
  const { surveyjs_version, languages, data } = body;

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

  if (updates.length === 0) {
    return errorResponse(400, 'NO_UPDATES', 'No fields to update');
  }

  updates.push('last_update = NOW()');
  updates.push('last_modified_by = ?');
  params.push(user.user_id);
  params.push(snapshotId);

  const result = await query(
    `UPDATE snapshots SET ${updates.join(', ')} WHERE snapshot_id = ?`,
    params
  );

  if (result.affectedRows === 0) {
    return errorResponse(404, 'NOT_FOUND', 'Snapshot not found');
  }

  return await getSnapshot(snapshotId);
}

async function deleteSnapshot(user, snapshotId) {
  // Check if snapshot is used in campaigns
  const campaigns = await query(
    'SELECT campaign_id FROM campaigns WHERE snapshot_id = ?',
    [snapshotId]
  );

  if (campaigns.length > 0) {
    return errorResponse(409, 'CONFLICT', 'Snapshot is used in campaigns and cannot be deleted');
  }

  const result = await query('DELETE FROM snapshots WHERE snapshot_id = ?', [snapshotId]);

  if (result.affectedRows === 0) {
    return errorResponse(404, 'NOT_FOUND', 'Snapshot not found');
  }

  return apiResponse(200, { ok: true });
}
