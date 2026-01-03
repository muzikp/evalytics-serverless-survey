// Responses handler
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody } from '../utils.js';
import { authenticate, requireRole } from '../auth.js';

export async function handleResponses(event, method, path, authToken) {
  const user = await authenticate(event, authToken);
  requireRole(user, 'admin');

  // GET /responses - List responses with filters
  if (path === '/responses' && method === 'GET') {
    return await listResponses(event, user);
  }

  // GET /responses/{id}
  const getMatch = path.match(/^\/responses\/([^/]+)$/);
  if (getMatch && method === 'GET') {
    return await getResponse(getMatch[1]);
  }

  return errorResponse(404, 'NOT_FOUND', 'Response endpoint not found');
}

async function listResponses(event, user) {
  const params = event.queryStringParameters || {};
  const limit = parseInt(params.limit || '50');
  const offset = parseInt(params.offset || '0');
  const campaignId = params.campaign_id;
  const snapshotId = params.snapshot_id;
  const status = params.status;

  let sql = `
    SELECT r.*, cr.email, c.public_id as campaign_public_id
    FROM responses r
    LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
    LEFT JOIN campaigns c ON r.campaign_id = c.campaign_id
    WHERE 1=1
  `;
  const sqlParams = [];

  if (campaignId) {
    sql += ' AND r.campaign_id = ?';
    sqlParams.push(campaignId);
  }
  if (snapshotId) {
    sql += ' AND r.snapshot_id = ?';
    sqlParams.push(snapshotId);
  }
  if (status) {
    sql += ' AND r.status = ?';
    sqlParams.push(status);
  }

  // Use direct interpolation for LIMIT/OFFSET (safe - already parsed as integers)
  sql += ` ORDER BY r.created DESC LIMIT ${limit} OFFSET ${offset}`;
  const responses = await query(sql, sqlParams);

  // Get total count
  let countSql = 'SELECT COUNT(*) as total FROM responses WHERE 1=1';
  const countParams = [];
  if (campaignId) {
    countSql += ' AND campaign_id = ?';
    countParams.push(campaignId);
  }
  if (snapshotId) {
    countSql += ' AND snapshot_id = ?';
    countParams.push(snapshotId);
  }
  if (status) {
    countSql += ' AND status = ?';
    countParams.push(status);
  }

  const countResult = await query(countSql, countParams);
  const total = countResult[0].total;

  return apiResponse(200, {
    items: responses.map(r => ({
      ...r,
      data: typeof r.data === 'string' ? JSON.parse(r.data) : r.data,
      request_data: r.request_data ? (typeof r.request_data === 'string' ? JSON.parse(r.request_data) : r.request_data) : null,
      client_meta: r.client_meta ? (typeof r.client_meta === 'string' ? JSON.parse(r.client_meta) : r.client_meta) : null
    })),
    page: { limit, offset, total }
  });
}

async function getResponse(responseId) {
  const response = await queryOne(
    `SELECT r.*, cr.email, c.public_id as campaign_public_id, s.data as snapshot_data
     FROM responses r
     LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
     LEFT JOIN campaigns c ON r.campaign_id = c.campaign_id
     LEFT JOIN snapshots s ON r.snapshot_id = s.snapshot_id
     WHERE r.response_id = ?`,
    [responseId]
  );

  if (!response) {
    return errorResponse(404, 'NOT_FOUND', 'Response not found');
  }

  return apiResponse(200, {
    ...response,
    data: typeof response.data === 'string' ? JSON.parse(response.data) : response.data,
    request_data: response.request_data ? (typeof response.request_data === 'string' ? JSON.parse(response.request_data) : response.request_data) : null,
    client_meta: response.client_meta ? (typeof response.client_meta === 'string' ? JSON.parse(response.client_meta) : response.client_meta) : null,
    snapshot_data: response.snapshot_data ? (typeof response.snapshot_data === 'string' ? JSON.parse(response.snapshot_data) : response.snapshot_data) : null
  });
}
