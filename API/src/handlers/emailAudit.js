// Email audit handler - delivery log and events
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse } from '../utils.js';
import { authenticate } from '../auth.js';

export async function handleEmailAudit(event, method, path, authToken) {
  // All email audit endpoints require admin authentication
  const user = await authenticate(authToken, event);
  if (!user) {
    return errorResponse(401, 'UNAUTHORIZED', 'Authentication required');
  }

  // GET /campaigns/{id}/email-log - List campaign email log
  const logMatch = path.match(/^\/campaigns\/([^/]+)\/email-log$/);
  if (logMatch && method === 'GET') {
    return await listEmailLog(event, logMatch[1]);
  }

  // GET /campaigns/{id}/email-log/{email_log_id}/events - List delivery events
  const eventsMatch = path.match(/^\/campaigns\/([^/]+)\/email-log\/(\d+)\/events$/);
  if (eventsMatch && method === 'GET') {
    return await listDeliveryEvents(event, eventsMatch[1], eventsMatch[2]);
  }

  return errorResponse(404, 'NOT_FOUND', 'Email audit endpoint not found');
}

async function listEmailLog(event, campaignId) {
  // Verify campaign exists
  const campaign = await queryOne(
    'SELECT campaign_id FROM campaigns WHERE campaign_id = ?',
    [campaignId]
  );

  if (!campaign) {
    return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
  }

  // Parse query parameters
  const limit = parseInt(event.queryStringParameters?.limit) || 50;
  const offset = parseInt(event.queryStringParameters?.offset) || 0;
  const emailType = event.queryStringParameters?.email_type;
  const status = event.queryStringParameters?.status;

  // Build query
  let whereClause = 'campaign_id = ?';
  const params = [campaignId];

  if (emailType) {
    whereClause += ' AND email_type = ?';
    params.push(emailType);
  }

  if (status) {
    whereClause += ' AND status = ?';
    params.push(status);
  }

  // Get total count
  const countResult = await queryOne(
    `SELECT COUNT(*) as total FROM campaign_email_log WHERE ${whereClause}`,
    params
  );

  // Get paginated results
  // Note: LIMIT and OFFSET must be directly interpolated (not as params) due to MySQL2 driver limitations
  const logs = await query(
    `SELECT cel.*, cr.email
     FROM campaign_email_log cel
     LEFT JOIN campaign_respondents cr ON cel.respondent_id = cr.respondent_id
     WHERE ${whereClause}
     ORDER BY cel.sent_at DESC
     LIMIT ${limit} OFFSET ${offset}`,
    params
  );

  return apiResponse(200, {
    items: logs.map(log => ({
      email_log_id: log.email_log_id,
      respondent_id: log.respondent_id,
      email: log.email,
      email_type: log.email_type,
      status: log.status,
      sent_at: log.sent_at,
      provider_message_id: log.provider_message_id,
      last_event_at: log.last_event_at,
      bounce_type: log.bounce_type,
      complaint_type: log.complaint_type
    })),
    page: {
      limit: limit,
      offset: offset,
      total: countResult.total,
      has_more: offset + limit < countResult.total
    }
  });
}

async function listDeliveryEvents(event, campaignId, emailLogId) {
  // Verify email log belongs to campaign
  const emailLog = await queryOne(
    `SELECT cel.*
     FROM campaign_email_log cel
     WHERE cel.email_log_id = ? AND cel.campaign_id = ?`,
    [emailLogId, campaignId]
  );

  if (!emailLog) {
    return errorResponse(404, 'NOT_FOUND', 'Email log not found');
  }

  // Parse query parameters
  const limit = parseInt(event.queryStringParameters?.limit) || 50;
  const offset = parseInt(event.queryStringParameters?.offset) || 0;

  // Get total count
  const countResult = await queryOne(
    'SELECT COUNT(*) as total FROM email_delivery_events WHERE email_log_id = ?',
    [emailLogId]
  );

  // Get paginated results
  // Note: LIMIT and OFFSET must be directly interpolated (not as params) due to MySQL2 driver limitations
  const events = await query(
    `SELECT *
     FROM email_delivery_events
     WHERE email_log_id = ?
     ORDER BY event_timestamp DESC
     LIMIT ${limit} OFFSET ${offset}`,
    [emailLogId]
  );

  return apiResponse(200, {
    items: events.map(evt => ({
      event_id: evt.event_id,
      event_type: evt.event_type,
      event_timestamp: evt.event_timestamp,
      provider_event_id: evt.provider_event_id,
      raw_payload: evt.raw_payload ? JSON.parse(evt.raw_payload) : null,
      bounce_type: evt.bounce_type,
      bounce_subtype: evt.bounce_subtype,
      complaint_type: evt.complaint_type,
      created: evt.created
    })),
    page: {
      limit: limit,
      offset: offset,
      total: countResult.total,
      has_more: offset + limit < countResult.total
    }
  });
}
