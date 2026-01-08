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
    `SELECT c.*, fv.version as form_version, f.name as form_name,
            u1.firstname as created_by_firstname, u1.lastname as created_by_lastname,
            (SELECT COUNT(*) FROM campaign_respondents cr WHERE cr.campaign_id = c.campaign_id) as respondent_count,
            (SELECT COUNT(*) FROM campaign_respondents cr WHERE cr.campaign_id = c.campaign_id AND cr.invitation_sent_at IS NOT NULL) as invitations_sent
     FROM campaigns c
     LEFT JOIN form_versions fv ON c.version_id = fv.version_id
     LEFT JOIN forms f ON fv.form_id = f.form_id
     LEFT JOIN users u1 ON c.created_by = u1.user_id
     ORDER BY c.created DESC LIMIT ${limit} OFFSET ${offset}`
  );

  const countResult = await query('SELECT COUNT(*) as total FROM campaigns');
  const total = countResult[0].total;

  return apiResponse(200, {
    items: campaigns.map(c => {
      // Parse JSON fields - they may already be parsed or need parsing
      let title = c.title;
      let description = c.description;
      let email_template = c.email_template;
      
      try {
        if (typeof title === 'string') {
          title = JSON.parse(title);
        }
      } catch (e) {
        // If parse fails, use as-is (might already be a plain string)
      }
      
      try {
        if (description && typeof description === 'string') {
          description = JSON.parse(description);
        }
      } catch (e) {
        // If parse fails, use as-is
      }
      
      // email_template is stored as plain HTML string, no parsing needed
      
      return {
        ...c,
        title,
        description,
        email_template
      };
    }),
    page: { limit, offset, total }
  });
}

async function createCampaign(event, user) {
  const body = parseBody(event);
  const { campaign_id, version_id, public_id, title, description, email_template, open_on, close_on, is_public, allow_retries, allow_multiple_responses, respondents } = body;

  if (!version_id || !title) {
    return errorResponse(400, 'MISSING_FIELDS', 'version_id and title are required');
  }

  // Verify form version exists
  const version = await queryOne('SELECT version_id FROM form_versions WHERE version_id = ?', [version_id]);
  if (!version) {
    return errorResponse(404, 'NOT_FOUND', 'Form version not found');
  }

  // Use provided campaign_id or generate new one
  const campaignId = campaign_id || generateId(16);
  const finalPublicId = public_id || generateToken(32);
  const now = formatDateTime();

  await query(
    `INSERT INTO campaigns (campaign_id, version_id, public_id, title, description, email_template, open_on, close_on, is_public, allow_retries, allow_multiple_responses, created, last_update, created_by, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      campaignId,
      version_id,
      finalPublicId,
      JSON.stringify(title),
      description ? JSON.stringify(description) : null,
      email_template || null,
      open_on || null,
      close_on || null,
      is_public || 0,
      allow_retries !== undefined ? allow_retries : 1,
      allow_multiple_responses || 0,
      now,
      now,
      user.user_id,
      user.user_id
    ]
  );

  // If respondents provided, insert them
  if (respondents && Array.isArray(respondents) && respondents.length > 0) {
    const crypto = await import('crypto');
    for (const resp of respondents) {
      const respondentId = generateId(32);
      const token = resp.token || generateToken(64);
      const emailHash = crypto.createHash('sha256').update(resp.email).digest('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Extract custom fields (all fields except email and token)
      const customData = {};
      Object.keys(resp).forEach(key => {
        if (key !== 'email' && key !== 'token') {
          customData[key] = resp[key];
        }
      });
      
      // Store token in data field for later retrieval
      customData.token = token;
      
      await query(
        `INSERT INTO campaign_respondents (respondent_id, campaign_id, email, email_hash, token_hash, data, created, last_update)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          respondentId,
          campaignId,
          resp.email,
          emailHash,
          tokenHash,
          JSON.stringify(customData),
          now,
          now
        ]
      );
    }
  }

  return await getCampaign(campaignId);
}

async function getCampaign(campaignId) {
  const campaign = await queryOne(
    `SELECT c.*, fv.version as form_version, fv.data as form_data, f.name as form_name,
            u1.firstname as created_by_firstname, u1.lastname as created_by_lastname
     FROM campaigns c
     LEFT JOIN form_versions fv ON c.version_id = fv.version_id
     LEFT JOIN forms f ON fv.form_id = f.form_id
     LEFT JOIN users u1 ON c.created_by = u1.user_id
     WHERE c.campaign_id = ?`,
    [campaignId]
  );

  if (!campaign) {
    return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
  }

  // Parse JSON fields safely
  let title = campaign.title;
  let description = campaign.description;
  let email_template = campaign.email_template;
  let form_data = campaign.form_data;
  
  try {
    if (typeof title === 'string') title = JSON.parse(title);
  } catch (e) {}
  
  try {
    if (description && typeof description === 'string') description = JSON.parse(description);
  } catch (e) {}
  
  // email_template is stored as plain HTML string, no parsing needed
  
  try {
    if (form_data && typeof form_data === 'string') form_data = JSON.parse(form_data);
  } catch (e) {}

  return apiResponse(200, {
    ...campaign,
    title,
    description,
    email_template,
    form_data
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
    params.push(email_template);
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
    `SELECT respondent_id, campaign_id, email, token, data, created, last_update
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

    // Store token in data field for later retrieval
    const dataWithToken = data ? { ...data, token } : { token };

    await query(
      `INSERT INTO campaign_respondents (respondent_id, campaign_id, email, email_hash, token_hash, data, created, last_update)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        respondentId,
        campaignId,
        email,
        emailHash,
        tokenHash,
        JSON.stringify(dataWithToken),
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
