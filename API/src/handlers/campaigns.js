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

  // GET /campaigns/{id}/responses/stats - Get response statistics
  const statsMatch = path.match(/^\/campaigns\/([^/]+)\/responses\/stats$/);
  if (statsMatch && method === 'GET') {
    return await getResponseStats(user, statsMatch[1]);
  }

  // GET /campaigns/{id}/responses/export - Export responses
  const exportMatch = path.match(/^\/campaigns\/([^/]+)\/responses\/export$/);
  if (exportMatch && method === 'GET') {
    return await exportResponses(event, user, exportMatch[1]);
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
  const { campaign_id, version_id, public_id, title, description, email_template, email_template_fields, respondent_fields, open_on, close_on, is_public, allow_retries, allow_multiple_responses, response_persistence, respondents } = body;

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
    `INSERT INTO campaigns (campaign_id, version_id, public_id, title, description, email_template, email_template_fields, respondent_fields, open_on, close_on, is_public, allow_retries, allow_multiple_responses, response_persistence, created, last_update, created_by, last_modified_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      campaignId,
      version_id,
      finalPublicId,
      JSON.stringify(title),
      description ? JSON.stringify(description) : null,
      email_template || null,
      email_template_fields ? JSON.stringify(email_template_fields) : null,
      respondent_fields ? JSON.stringify(respondent_fields) : null,
      open_on || null,
      close_on || null,
      is_public || 0,
      allow_retries !== undefined ? allow_retries : 1,
      allow_multiple_responses || 0,
      response_persistence || 0,
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
  let email_template = campaign.email_template;  // Now JSON column with title and body
  let email_template_fields = campaign.email_template_fields;
  let respondent_fields = campaign.respondent_fields;
  let form_data = campaign.form_data;
  
  try {
    if (typeof title === 'string') title = JSON.parse(title);
  } catch (e) {}
  
  try {
    if (description && typeof description === 'string') description = JSON.parse(description);
  } catch (e) {}
  
  // email_template is JSON column - MySQL driver already parses it
  // But if it's a string, parse it
  try {
    if (email_template && typeof email_template === 'string') {
      email_template = JSON.parse(email_template);
    }
  } catch (e) {}
  
  try {
    if (email_template_fields && typeof email_template_fields === 'string') {
      email_template_fields = JSON.parse(email_template_fields);
    }
  } catch (e) {}
  
  try {
    if (respondent_fields && typeof respondent_fields === 'string') {
      respondent_fields = JSON.parse(respondent_fields);
    }
  } catch (e) {}
  
  console.log('getCampaign returning respondent_fields:', JSON.stringify(respondent_fields));
  
  try {
    if (form_data && typeof form_data === 'string') form_data = JSON.parse(form_data);
  } catch (e) {}

  return apiResponse(200, {
    ...campaign,
    title,
    description,
    email_template,
    email_template_fields,
    respondent_fields,
    form_data
  });
}

async function updateCampaign(event, user, campaignId) {
  const body = parseBody(event);
  const { title, description, email_template, email_template_fields, respondent_fields, open_on, close_on, allow_multiple_responses, max_attempts, respondents } = body;

  console.log('=== UPDATE CAMPAIGN ===');
  console.log('Campaign ID:', campaignId);
  console.log('Respondents in payload:', respondents ? respondents.length : 'none');
  if (respondents && respondents.length > 0) {
    console.log('First respondent:', JSON.stringify(respondents[0], null, 2));
  }

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
  if (email_template_fields !== undefined) {
    updates.push('email_template_fields = ?');
    params.push(email_template_fields ? JSON.stringify(email_template_fields) : null);
  }
  if (body.respondent_fields !== undefined) {
    updates.push('respondent_fields = ?');
    const fieldsToSave = body.respondent_fields ? JSON.stringify(body.respondent_fields) : null;
    console.log('Saving respondent_fields:', fieldsToSave);
    params.push(fieldsToSave);
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

  if (updates.length === 0 && !respondents) {
    return errorResponse(400, 'NO_UPDATES', 'No fields to update');
  }

  // Update campaign metadata if there are updates
  if (updates.length > 0) {
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
  }

  // Update respondents if provided
  if (respondents && Array.isArray(respondents) && respondents.length > 0) {
    const crypto = await import('crypto');
    const now = formatDateTime();
    
    // Get existing respondents to update or delete
    const existing = await query(
      'SELECT respondent_id, email FROM campaign_respondents WHERE campaign_id = ?',
      [campaignId]
    );
    
    const existingMap = new Map(existing.map(r => [r.email, r.respondent_id]));
    const updatedEmails = new Set();
    
    // Update or insert respondents
    for (const resp of respondents) {
      updatedEmails.add(resp.email);
      const respondentId = existingMap.get(resp.email) || generateId(32);
      const token = resp.token || generateToken(64);
      const emailHash = crypto.createHash('sha256').update(resp.email).digest('hex');
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
      
      // Extract custom fields (all fields except email, token, respondent_id)
      const customData = {};
      Object.keys(resp).forEach(key => {
        if (key !== 'email' && key !== 'token' && key !== 'respondent_id') {
          customData[key] = resp[key];
        }
      });
      
      if (existingMap.has(resp.email)) {
        // Update existing respondent
        await query(
          `UPDATE campaign_respondents 
           SET data = ?, last_update = ? 
           WHERE respondent_id = ?`,
          [JSON.stringify(customData), now, respondentId]
        );
      } else {
        // Insert new respondent
        await query(
          `INSERT INTO campaign_respondents (respondent_id, campaign_id, email, email_hash, token_hash, data, created, last_update)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [respondentId, campaignId, resp.email, emailHash, tokenHash, JSON.stringify(customData), now, now]
        );
      }
    }
    
    // Delete respondents that were removed
    for (const [email, respondentId] of existingMap.entries()) {
      if (!updatedEmails.has(email)) {
        await query('DELETE FROM campaign_respondents WHERE respondent_id = ?', [respondentId]);
      }
    }
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

async function getResponseStats(user, campaignId) {
  // Verify campaign exists
  const campaign = await queryOne(
    'SELECT campaign_id, is_public FROM campaigns WHERE campaign_id = ?',
    [campaignId]
  );

  if (!campaign) {
    return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
  }

  // Get total registered respondents (for private campaigns)
  let totalRespondents = 0;
  if (!campaign.is_public) {
    const [resCount] = await query(
      'SELECT COUNT(*) as count FROM campaign_respondents WHERE campaign_id = ?',
      [campaignId]
    );
    totalRespondents = resCount.count;
  }

  // Get response statistics
  const [stats] = await query(
    `SELECT 
      COUNT(DISTINCT CASE WHEN status = 'in_progress' THEN response_id END) as in_progress_count,
      COUNT(DISTINCT CASE WHEN status = 'completed' THEN response_id END) as completed_count,
      COUNT(DISTINCT response_id) as total_responses
    FROM responses 
    WHERE campaign_id = ? AND removed = 0`,
    [campaignId]
  );

  return apiResponse(200, {
    campaign_id: campaignId,
    is_public: campaign.is_public,
    total_respondents: totalRespondents,
    in_progress: stats.in_progress_count || 0,
    completed: stats.completed_count || 0,
    total_responses: stats.total_responses || 0
  });
}

async function exportResponses(event, user, campaignId) {
  const params = event.queryStringParameters || {};
  
  // Parse parameters
  const statusFilter = params.status ? params.status.split(',') : ['in_progress', 'completed'];
  const format = params.format || 'json';
  const includeQuestionText = params.includeQuestionText === 'true';
  const includeAnswerText = params.includeAnswerText === 'true';
  const language = params.language || null; // Get language parameter from query string

  // Verify campaign exists and get form version
  const campaign = await queryOne(
    `SELECT c.campaign_id, c.version_id, c.default_language, 
            fv.data as form_data
     FROM campaigns c
     LEFT JOIN form_versions fv ON c.version_id = fv.version_id
     WHERE c.campaign_id = ?`,
    [campaignId]
  );

  if (!campaign) {
    return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
  }

  // Parse form data
  let formData = null;
  try {
    formData = typeof campaign.form_data === 'string' 
      ? JSON.parse(campaign.form_data) 
      : campaign.form_data;
  } catch (e) {
    console.error('Failed to parse form_data:', e);
  }

  // Get responses
  let sql = `
    SELECT r.response_id, r.respondent_id, r.status, r.attempt_no, 
           r.data, r.submitted_at, r.created, r.last_update,
           cr.email
    FROM responses r
    LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
    WHERE r.campaign_id = ? AND r.removed = 0
  `;
  
  const sqlParams = [campaignId];
  
  if (statusFilter.length < 2) {
    sql += ' AND r.status IN (?)';
    sqlParams.push(statusFilter);
  }
  
  sql += ' ORDER BY r.created DESC';
  
  const responses = await query(sql, sqlParams);

  // Process responses based on format
  if (format === 'json') {
    const processedResponses = responses.map(r => {
      const responseData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
      
      let processedData = responseData;
      
      // If includeQuestionText or includeAnswerText, enhance the data
      if ((includeQuestionText || includeAnswerText) && formData && formData.pages) {
        // Use provided language or fall back to campaign's default language
        const targetLanguage = language || campaign.default_language || 'en';
        processedData = enhanceResponseData(
          responseData, 
          formData, 
          targetLanguage,
          includeQuestionText,
          includeAnswerText
        );
      }

      return {
        response_id: r.response_id,
        respondent_id: r.respondent_id,
        email: r.email,
        status: r.status,
        attempt_no: r.attempt_no,
        submitted_at: r.submitted_at,
        created: r.created,
        data: processedData
      };
    });

    return apiResponse(200, {
      campaign_id: campaignId,
      export_date: new Date().toISOString(),
      filters: {
        status: statusFilter,
        includeQuestionText,
        includeAnswerText
      },
      responses: processedResponses,
      count: processedResponses.length
    });
  }

  // For Excel format (not implemented yet)
  if (format === 'excel') {
    return errorResponse(501, 'NOT_IMPLEMENTED', 'Excel export not yet implemented');
  }

  return errorResponse(400, 'INVALID_FORMAT', 'Invalid format. Supported: json, excel');
}

/**
 * Enhance response data with question/answer texts from form definition
 */
function enhanceResponseData(responseData, formData, language, includeQuestionText, includeAnswerText) {
  const enhanced = {};
  
  // Build question map from form data
  const questionMap = {};
  if (formData.pages) {
    formData.pages.forEach(page => {
      if (page.elements) {
        page.elements.forEach(element => {
          questionMap[element.name] = element;
        });
      }
    });
  }

  // Process each answer
  Object.keys(responseData).forEach(questionName => {
    const answer = responseData[questionName];
    const question = questionMap[questionName];
    
    // Get question title in specified language
    let questionText = questionName;
    if (question && includeQuestionText && question.title) {
      if (typeof question.title === 'object') {
        // Try requested language, fallback to 'default', then to first available
        questionText = question.title[language] || question.title.default || question.title[Object.keys(question.title)[0]] || questionName;
      } else if (typeof question.title === 'string') {
        questionText = question.title;
      }
    }

    // Get answer text
    let answerValue = answer;
    if (question && includeAnswerText) {
      // For choice-based questions, get text of selected choice(s)
      if (question.choices && Array.isArray(question.choices)) {
        if (Array.isArray(answer)) {
          // Multiple choices - join with comma
          answerValue = answer.map(val => 
            getChoiceText(question.choices, val, language)
          ).join(', ');
        } else {
          // Single choice
          answerValue = getChoiceText(question.choices, answer, language);
        }
      }
      // For non-choice questions, answerValue stays as answer
    }

    // Use translated question text as key when both options are enabled
    const key = (includeQuestionText && includeAnswerText) ? questionText : questionName;
    enhanced[key] = answerValue;
  });

  return enhanced;
}

/**
 * Get choice text by value
 */
function getChoiceText(choices, value, language) {
  const choice = choices.find(c => {
    if (typeof c === 'object') {
      return c.value === value;
    }
    return c === value;
  });

  if (!choice) return value;

  if (typeof choice === 'object') {
    if (choice.text) {
      if (typeof choice.text === 'object') {
        // Try requested language, fallback to 'default', then to first available
        return choice.text[language] || choice.text.default || choice.text[Object.keys(choice.text)[0]] || value;
      }
      if (typeof choice.text === 'string') {
        return choice.text;
      }
    }
    return choice.value || value;
  }

  return choice;
}
