// Campaigns handler
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody, generateId, generateToken, hashValue, formatDateTime } from '../utils.js';
import { authenticate, requireRole } from '../auth.js';

export async function handleCampaigns(event, method, path, authToken) {
  const user = await authenticate(event, authToken);
  requireRole(user, 'admin');

  // GET /campaigns - List campaigns
  if (path === '/campaigns' && method === 'GET') {
    return await listCampaigns(event, user);
  }

  // POST /campaigns - Create campaign
  if (path === '/campaigns' && method === 'POST') {
    return await createCampaign(event, user);
  }

  // GET /campaigns/{id}
  const getMatch = path.match(/^\/campaigns\/([^/]+)$/);
  if (getMatch && method === 'GET') {
    return await getCampaign(getMatch[1]);
  }

  // PUT /campaigns/{id}
  if (getMatch && method === 'PUT') {
    return await updateCampaign(event, user, getMatch[1]);
  }

  // DELETE /campaigns/{id}
  if (getMatch && method === 'DELETE') {
    return await deleteCampaign(user, getMatch[1]);
  }

  // POST /campaigns/{id}/send - Send emails
  const sendMatch = path.match(/^\/campaigns\/([^/]+)\/send$/);
  if (sendMatch && method === 'POST') {
    return await sendCampaignEmails(event, user, sendMatch[1]);
  }

  // GET/POST /campaigns/{id}/respondents - Manage respondents
  const respondentsMatch = path.match(/^\/campaigns\/([^/]+)\/respondents$/);
  if (respondentsMatch) {
    if (method === 'GET') {
      return await listRespondents(event, user, respondentsMatch[1]);
    }
    if (method === 'POST') {
      return await addRespondents(event, user, respondentsMatch[1]);
    }
  }

  return errorResponse(404, 'NOT_FOUND', 'Campaign endpoint not found');
}

async function listCampaigns(event, user) {
  const params = event.queryStringParameters || {};
  const limit = parseInt(params.limit || '50');
  const offset = parseInt(params.offset || '0');

  // Note: LIMIT and OFFSET must be directly interpolated (not as params) due to MySQL2 driver limitations
  const campaigns = await query(
    `SELECT c.*, s.version as snapshot_version, t.name as template_name,
            u1.firstname as created_by_firstname, u1.lastname as created_by_lastname
     FROM campaigns c
     LEFT JOIN snapshots s ON c.snapshot_id = s.snapshot_id
     LEFT JOIN templates t ON s.template_id = t.template_id
     LEFT JOIN users u1 ON c.created_by = u1.user_id
     ORDER BY c.created DESC LIMIT ${limit} OFFSET ${offset}`
  );

  const countResult = await query('SELECT COUNT(*) as total FROM campaigns');
  const total = countResult[0].total;

  return apiResponse(200, {
    items: campaigns.map(c => ({
      ...c,
      title: typeof c.title === 'string' ? JSON.parse(c.title) : c.title,
      description: c.description ? (typeof c.description === 'string' ? JSON.parse(c.description) : c.description) : null,
      email_template: typeof c.email_template === 'string' ? JSON.parse(c.email_template) : c.email_template
    })),
    page: { limit, offset, total }
  });
}

async function createCampaign(event, user) {
  const body = parseBody(event);
  const { snapshot_id, title, description, email_template, open_on, close_on, allow_multiple_responses, max_attempts } = body;

  if (!snapshot_id || !title || !email_template) {
    return errorResponse(400, 'MISSING_FIELDS', 'snapshot_id, title, and email_template are required');
  }

  // Verify snapshot exists
  const snapshot = await queryOne('SELECT snapshot_id FROM snapshots WHERE snapshot_id = ?', [snapshot_id]);
  if (!snapshot) {
    return errorResponse(404, 'NOT_FOUND', 'Snapshot not found');
  }

  const campaignId = generateId(16);
  const publicId = generateToken(32);
  const now = formatDateTime();

  await query(
    `INSERT INTO campaigns (campaign_id, snapshot_id, public_id, title, description, email_template, open_on, close_on, allow_multiple_responses, max_attempts, created, last_update, created_by, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      campaignId,
      snapshot_id,
      publicId,
      JSON.stringify(title),
      description ? JSON.stringify(description) : null,
      JSON.stringify(email_template),
      open_on || null,
      close_on || null,
      allow_multiple_responses || false,
      max_attempts || null,
      now,
      now,
      user.user_id,
      user.user_id
    ]
  );

  return await getCampaign(campaignId);
}

async function getCampaign(campaignId) {
  const campaign = await queryOne(
    `SELECT c.*, s.version as snapshot_version, s.data as snapshot_data, t.name as template_name,
            u1.firstname as created_by_firstname, u1.lastname as created_by_lastname
     FROM campaigns c
     LEFT JOIN snapshots s ON c.snapshot_id = s.snapshot_id
     LEFT JOIN templates t ON s.template_id = t.template_id
     LEFT JOIN users u1 ON c.created_by = u1.user_id
     WHERE c.campaign_id = ?`,
    [campaignId]
  );

  if (!campaign) {
    return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
  }

  return apiResponse(200, {
    ...campaign,
    title: typeof campaign.title === 'string' ? JSON.parse(campaign.title) : campaign.title,
    description: campaign.description ? (typeof campaign.description === 'string' ? JSON.parse(campaign.description) : campaign.description) : null,
    email_template: typeof campaign.email_template === 'string' ? JSON.parse(campaign.email_template) : campaign.email_template,
    snapshot_data: campaign.snapshot_data ? (typeof campaign.snapshot_data === 'string' ? JSON.parse(campaign.snapshot_data) : campaign.snapshot_data) : null
  });
}

async function updateCampaign(event, user, campaignId) {
  const body = parseBody(event);
  const { title, description, email_template, open_on, close_on, allow_multiple_responses, max_attempts } = body;

  const updates = [];
  const params = [];

  if (title !== undefined) {
    updates.push('title = ?');
    params.push(JSON.stringify(title));
  }
  if (description !== undefined) {
    updates.push('description = ?');
    params.push(description ? JSON.stringify(description) : null);
  }
  if (email_template !== undefined) {
    updates.push('email_template = ?');
    params.push(JSON.stringify(email_template));
  }
  if (open_on !== undefined) {
    updates.push('open_on = ?');
    params.push(open_on);
  }
  if (close_on !== undefined) {
    updates.push('close_on = ?');
    params.push(close_on);
  }
  if (allow_multiple_responses !== undefined) {
    updates.push('allow_multiple_responses = ?');
    params.push(allow_multiple_responses);
  }
  if (max_attempts !== undefined) {
    updates.push('max_attempts = ?');
    params.push(max_attempts);
  }

  if (updates.length === 0) {
    return errorResponse(400, 'NO_UPDATES', 'No fields to update');
  }

  updates.push('last_update = NOW()');
  updates.push('last_modified_by = ?');
  params.push(user.user_id);
  params.push(campaignId);

  const result = await query(
    `UPDATE campaigns SET ${updates.join(', ')} WHERE campaign_id = ?`,
    params
  );

  if (result.affectedRows === 0) {
    return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
  }

  return await getCampaign(campaignId);
}

async function deleteCampaign(user, campaignId) {
  const result = await query('DELETE FROM campaigns WHERE campaign_id = ?', [campaignId]);

  if (result.affectedRows === 0) {
    return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
  }

  return apiResponse(204, {});
}

async function sendCampaignEmails(event, user, campaignId) {
  const body = parseBody(event);
  const { email_type = 'invite', test_email } = body;

  // TODO: Implement email sending via SQS
  // For now, just return a placeholder response

  return apiResponse(202, {
    message: 'Email sending queued',
    campaign_id: campaignId,
    email_type,
    note: 'Email sending not yet implemented - requires SQS integration'
  });
}

async function listRespondents(event, user, campaignId) {
  const params = event.queryStringParameters || {};
  const limit = parseInt(params.limit || '50');
  const offset = parseInt(params.offset || '0');

  // Note: LIMIT and OFFSET must be directly interpolated (not as params) due to MySQL2 driver limitations
  const respondents = await query(
    `SELECT respondent_id, campaign_id, email, data, created, last_update
     FROM campaign_respondents
     WHERE campaign_id = ?
     ORDER BY created DESC LIMIT ${limit} OFFSET ${offset}`,
    [campaignId]
  );

  const countResult = await query(
    'SELECT COUNT(*) as total FROM campaign_respondents WHERE campaign_id = ?',
    [campaignId]
  );
  const total = countResult[0].total;

  return apiResponse(200, {
    items: respondents.map(r => ({
      ...r,
      data: r.data ? (typeof r.data === 'string' ? JSON.parse(r.data) : r.data) : null
    })),
    page: { limit, offset, total }
  });
}

async function addRespondents(event, user, campaignId) {
  const body = parseBody(event);
  const { respondents } = body;

  if (!respondents || !Array.isArray(respondents) || respondents.length === 0) {
    return errorResponse(400, 'MISSING_FIELDS', 'respondents array is required');
  }

  // Verify campaign exists
  const campaign = await queryOne('SELECT campaign_id FROM campaigns WHERE campaign_id = ?', [campaignId]);
  if (!campaign) {
    return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
  }

  const added = [];
  const now = formatDateTime();

  for (const resp of respondents) {
    const { email, data } = resp;
    
    if (!email) continue;

    // Check if respondent already exists
    const existing = await queryOne(
      'SELECT respondent_id FROM campaign_respondents WHERE campaign_id = ? AND email = ?',
      [campaignId, email]
    );

    if (existing) {
      continue; // Skip duplicates
    }

    const respondentId = generateId(32);
    const token = generateToken(48);
    const tokenHash = hashValue(token);
    const emailHash = hashValue(email);

    await query(
      `INSERT INTO campaign_respondents (respondent_id, campaign_id, email, email_hash, token_hash, data, created, last_update)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        respondentId,
        campaignId,
        email,
        emailHash,
        tokenHash,
        data ? JSON.stringify(data) : null,
        now,
        now
      ]
    );

    added.push({
      respondent_id: respondentId,
      email,
      token // Return token only once!
    });
  }

  return apiResponse(201, {
    added: added.length,
    respondents: added
  });
}
