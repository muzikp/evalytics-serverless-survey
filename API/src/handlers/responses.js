// Responses handler
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody, generateId, formatDateTime } from '../utils.js';
import { authenticate, requireRole, verifyRespondentToken, hasRole } from '../auth.js';

export async function handleResponses(event, method, path, authToken) {
  // Try to authenticate as admin first, then as respondent
  let user = null;
  let respondent = null;
  let isAdmin = false;

  try {
    user = await authenticate(event, authToken);
    isAdmin = hasRole(user, 'admin');
  } catch (adminAuthError) {
    // If admin auth fails, try respondent token
    if (authToken && authToken.type === 'respondent') {
      respondent = await verifyRespondentToken(authToken.token);
      if (!respondent) {
        throw errorResponse(401, 'UNAUTHORIZED', 'Invalid respondent token');
      }
    } else {
      throw adminAuthError; // Re-throw original error
    }
  }

  // GET /responses - List responses with filters
  if (path === '/responses' && method === 'GET') {
    return await listResponses(event, user, respondent, isAdmin);
  }

  // POST /responses - Create new response
  if (path === '/responses' && method === 'POST') {
    // Only admins can create via this endpoint
    if (!isAdmin) {
      throw errorResponse(403, 'FORBIDDEN', 'Admin access required');
    }
    return await createResponse(event, user);
  }

  // POST /responses/bulk - Bulk create responses
  if (path === '/responses/bulk' && method === 'POST') {
    // Only admins can bulk create
    if (!isAdmin) {
      throw errorResponse(403, 'FORBIDDEN', 'Admin access required');
    }
    return await createResponsesBulk(event, user);
  }

  // GET /responses/{id}
  const getMatch = path.match(/^\/responses\/([^/]+)$/);
  if (getMatch && method === 'GET') {
    return await getResponse(event, getMatch[1], respondent, isAdmin);
  }

  // PUT /responses/{id} - Update existing response
  const putMatch = path.match(/^\/responses\/([^/]+)$/);
  if (putMatch && method === 'PUT') {
    return await updateResponse(event, user, putMatch[1], respondent, isAdmin);
  }

  // DELETE /responses/{id} - Soft delete response
  const deleteMatch = path.match(/^\/responses\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    return await deleteResponse(user, deleteMatch[1], respondent, isAdmin);
  }

  return errorResponse(404, 'NOT_FOUND', 'Response endpoint not found');
}

async function listResponses(event, user, respondent, isAdmin) {
  const params = event.queryStringParameters || {};
  
  // Pagination
  const limit = parseInt(params.limit || '50');
  const offset = parseInt(params.offset || '0');
  
  // Filters
  const campaignId = params.campaign_id;
  const formId = params.form_id;
  const responseStatuses = params.response_status ? 
    (Array.isArray(params.response_status) ? params.response_status : [params.response_status]) : 
    null;
  const finishedBefore = params.finished_before; // ISO date string
  const finishedAfter = params.finished_after; // ISO date string
  const createdBefore = params.created_before;
  const createdAfter = params.created_after;
  const format = params.format || 'json'; // json, xlsx
  const includeQuestionText = params.includeQuestionText === 'true';
  const includeAnswerText = params.includeAnswerText === 'true';
  const includeFormData = params.includeFormData === 'true';

  // For respondents: filter by their email
  let respondentEmailFilter = null;
  if (!isAdmin && respondent) {
    respondentEmailFilter = respondent.email;
  }

  // Build SQL query with all JOINs
  let sql = `
    SELECT 
      r.response_id,
      r.respondent_id,
      r.campaign_id,
      r.version_id,
      r.attempt_no,
      r.status,
      r.request_data,
      r.client_meta,
      r.data,
      r.submitted_at,
      r.created,
      r.last_update,
      cr.email,
      c.public_id as campaign_public_id,
      c.title as campaign_title,
      fv.form_id,
      fv.form_name,
      fv.version as form_version
      ${includeFormData ? ', fv.data as form_data' : ''}
    FROM responses r
    LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
    LEFT JOIN campaigns c ON r.campaign_id = c.campaign_id
    LEFT JOIN form_versions fv ON r.version_id = fv.version_id
    WHERE r.removed = 0
  `;
  const sqlParams = [];

  // Apply filters
  if (respondentEmailFilter) {
    sql += ' AND cr.email = ?';
    sqlParams.push(respondentEmailFilter);
  }
  
  if (campaignId) {
    sql += ' AND r.campaign_id = ?';
    sqlParams.push(campaignId);
  }
  
  if (formId) {
    sql += ' AND fv.form_id = ?';
    sqlParams.push(formId);
  }
  
  if (responseStatuses && responseStatuses.length > 0) {
    const placeholders = responseStatuses.map(() => '?').join(',');
    sql += ` AND r.status IN (${placeholders})`;
    sqlParams.push(...responseStatuses);
  }
  
  if (finishedBefore) {
    sql += ' AND r.submitted_at < ?';
    sqlParams.push(finishedBefore);
  }
  
  if (finishedAfter) {
    sql += ' AND r.submitted_at >= ?';
    sqlParams.push(finishedAfter);
  }
  
  if (createdBefore) {
    sql += ' AND r.created < ?';
    sqlParams.push(createdBefore);
  }
  
  if (createdAfter) {
    sql += ' AND r.created >= ?';
    sqlParams.push(createdAfter);
  }

  // Get total count (before pagination)
  let countSql = `
    SELECT COUNT(DISTINCT r.response_id) as total 
    FROM responses r
    LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
    LEFT JOIN form_versions fv ON r.version_id = fv.version_id
    WHERE r.removed = 0
  `;
  const countParams = [];
  
  if (respondentEmailFilter) {
    countSql += ' AND cr.email = ?';
    countParams.push(respondentEmailFilter);
  }
  if (campaignId) {
    countSql += ' AND r.campaign_id = ?';
    countParams.push(campaignId);
  }
  if (formId) {
    countSql += ' AND fv.form_id = ?';
    countParams.push(formId);
  }
  if (responseStatuses && responseStatuses.length > 0) {
    const placeholders = responseStatuses.map(() => '?').join(',');
    countSql += ` AND r.status IN (${placeholders})`;
    countParams.push(...responseStatuses);
  }
  if (finishedBefore) {
    countSql += ' AND r.submitted_at < ?';
    countParams.push(finishedBefore);
  }
  if (finishedAfter) {
    countSql += ' AND r.submitted_at >= ?';
    countParams.push(finishedAfter);
  }
  if (createdBefore) {
    countSql += ' AND r.created < ?';
    countParams.push(createdBefore);
  }
  if (createdAfter) {
    countSql += ' AND r.created >= ?';
    countParams.push(createdAfter);
  }

  const countResult = await query(countSql, countParams);
  const total = countResult[0].total;

  // Add pagination
  sql += ` ORDER BY r.created DESC LIMIT ${limit} OFFSET ${offset}`;
  
  const responses = await query(sql, sqlParams);

  // Process responses
  const processedResponses = responses.map(r => {
    const responseData = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
    let processedData = responseData;
    
    // Apply text enhancement if requested
    if ((includeQuestionText || includeAnswerText) && r.form_data) {
      const formData = typeof r.form_data === 'string' ? JSON.parse(r.form_data) : r.form_data;
      const campaignTitle = typeof r.campaign_title === 'string' ? JSON.parse(r.campaign_title) : r.campaign_title;
      const defaultLanguage = campaignTitle && typeof campaignTitle === 'object' ? 
        Object.keys(campaignTitle)[0] : 'en';
      
      processedData = enhanceResponseData(
        responseData, 
        formData, 
        defaultLanguage, 
        includeQuestionText, 
        includeAnswerText
      );
    }
    
    return {
      response_id: r.response_id,
      respondent_id: r.respondent_id,
      email: r.email,
      campaign_id: r.campaign_id,
      campaign_public_id: r.campaign_public_id,
      form_id: r.form_id,
      form_name: r.form_name,
      form_version: r.form_version,
      version_id: r.version_id,
      attempt_no: r.attempt_no,
      status: r.status,
      submitted_at: r.submitted_at,
      created: r.created,
      last_update: r.last_update,
      data: processedData,
      request_data: r.request_data ? (typeof r.request_data === 'string' ? JSON.parse(r.request_data) : r.request_data) : null,
      client_meta: r.client_meta ? (typeof r.client_meta === 'string' ? JSON.parse(r.client_meta) : r.client_meta) : null
    };
  });

  // Handle different formats
  if (format === 'xlsx') {
    return errorResponse(501, 'NOT_IMPLEMENTED', 'Excel export not yet implemented');
  }

  // Default: JSON format
  return apiResponse(200, {
    export_date: new Date().toISOString(),
    filters: {
      campaign_id: campaignId || null,
      form_id: formId || null,
      response_status: responseStatuses || null,
      finished_before: finishedBefore || null,
      finished_after: finishedAfter || null,
      created_before: createdBefore || null,
      created_after: createdAfter || null,
      includeQuestionText,
      includeAnswerText
    },
    items: processedResponses,
    page: { limit, offset, total },
    count: processedResponses.length
  });
}

// Helper function to enhance response data with question and answer text
function enhanceResponseData(responseData, formData, language, includeQuestionText, includeAnswerText) {
  const enhanced = {};
  const questionMap = {};
  
  // Build question map from form pages
  if (formData && formData.pages) {
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
    const enhancedEntry = { value: answer };
    
    if (question && includeQuestionText) {
      let questionText = questionName;
      if (question.title) {
        if (typeof question.title === 'object' && question.title[language]) {
          questionText = question.title[language];
        } else if (typeof question.title === 'string') {
          questionText = question.title;
        }
      }
      enhancedEntry.questionText = questionText;
      enhancedEntry.questionType = question.type;
    }
    
    if (question && includeAnswerText) {
      if (question.choices && Array.isArray(question.choices)) {
        if (Array.isArray(answer)) {
          enhancedEntry.answerText = answer.map(val => getChoiceText(question.choices, val, language));
        } else {
          enhancedEntry.answerText = getChoiceText(question.choices, answer, language);
        }
      } else {
        enhancedEntry.answerText = answer;
      }
    }
    
    enhanced[questionName] = enhancedEntry;
  });
  
  return enhanced;
}

// Helper function to get choice text from choices array
function getChoiceText(choices, value, language) {
  const choice = choices.find(c => {
    if (typeof c === 'object') return c.value === value;
    return c === value;
  });
  
  if (!choice) return value;
  
  if (typeof choice === 'object') {
    if (choice.text) {
      if (typeof choice.text === 'object' && choice.text[language]) {
        return choice.text[language];
      }
      if (typeof choice.text === 'string') {
        return choice.text;
      }
    }
    return choice.value || value;
  }
  
  return choice;
}

async function getResponse(event, responseId, respondent, isAdmin) {
  const params = event.queryStringParameters || {};
  const format = params.format || 'json';

  // Get response with full context including form data
  const response = await queryOne(
    `SELECT 
      r.response_id,
      r.respondent_id,
      r.campaign_id,
      r.version_id,
      r.attempt_no,
      r.status,
      r.request_data,
      r.client_meta,
      r.data,
      r.submitted_at,
      r.created,
      r.last_update,
      cr.email,
      c.public_id as campaign_public_id,
      c.title as campaign_title,
      c.default_language,
      fv.form_id,
      fv.form_name,
      fv.version as form_version,
      fv.data as form_data
     FROM responses r
     LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
     LEFT JOIN campaigns c ON r.campaign_id = c.campaign_id
     LEFT JOIN form_versions fv ON r.version_id = fv.version_id
     WHERE r.response_id = ? AND r.removed = 0`,
    [responseId]
  );

  if (!response) {
    return errorResponse(404, 'NOT_FOUND', 'Response not found');
  }

  // Authorization check: respondents can only see their own responses
  if (!isAdmin && respondent) {
    if (response.email !== respondent.email) {
      return errorResponse(403, 'FORBIDDEN', 'You can only access your own responses');
    }
  }

  // Parse JSON fields
  const responseData = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
  const formData = response.form_data ? (typeof response.form_data === 'string' ? JSON.parse(response.form_data) : response.form_data) : null;
  const campaignTitle = response.campaign_title ? (typeof response.campaign_title === 'string' ? JSON.parse(response.campaign_title) : response.campaign_title) : null;
  
  // Determine default language
  const defaultLanguage = response.default_language || 
    (campaignTitle && typeof campaignTitle === 'object' ? Object.keys(campaignTitle)[0] : 'en');

  // Handle different formats
  if (format === 'html' || format === 'xlsx') {
    return errorResponse(501, 'NOT_IMPLEMENTED', `${format.toUpperCase()} format not yet implemented`);
  }

  // Default: JSON format
  return apiResponse(200, {
    response_id: response.response_id,
    respondent_id: response.respondent_id,
    email: response.email,
    campaign_id: response.campaign_id,
    campaign_public_id: response.campaign_public_id,
    form_id: response.form_id,
    form_name: response.form_name,
    form_version: response.form_version,
    version_id: response.version_id,
    attempt_no: response.attempt_no,
    status: response.status,
    submitted_at: response.submitted_at,
    created: response.created,
    last_update: response.last_update,
    data: responseData,
    request_data: response.request_data ? (typeof response.request_data === 'string' ? JSON.parse(response.request_data) : response.request_data) : null,
    client_meta: response.client_meta ? (typeof response.client_meta === 'string' ? JSON.parse(response.client_meta) : response.client_meta) : null,
    form_data: formData
  });
}

// Create new response
async function createResponse(event, user) {
  const body = parseBody(event);
  
  // Validate required fields
  if (!body.respondent_id || !body.campaign_id || !body.data) {
    return errorResponse(400, 'BAD_REQUEST', 'Missing required fields: respondent_id, campaign_id, data');
  }

  // Verify campaign exists and get version_id
  const campaign = await queryOne(
    'SELECT campaign_id, version_id, allow_multiple_responses FROM campaigns WHERE campaign_id = ? AND removed = 0',
    [body.campaign_id]
  );
  
  if (!campaign) {
    return errorResponse(404, 'NOT_FOUND', 'Campaign not found');
  }

  // Verify respondent exists
  const respondent = await queryOne(
    'SELECT respondent_id FROM campaign_respondents WHERE respondent_id = ? AND campaign_id = ?',
    [body.respondent_id, body.campaign_id]
  );
  
  if (!respondent) {
    return errorResponse(404, 'NOT_FOUND', 'Respondent not found in campaign');
  }

  // Determine attempt number
  const existingResponses = await query(
    'SELECT attempt_no FROM responses WHERE respondent_id = ? AND removed = 0 ORDER BY attempt_no DESC LIMIT 1',
    [body.respondent_id]
  );
  
  const attemptNo = existingResponses.length > 0 ? existingResponses[0].attempt_no + 1 : 1;
  
  // Check if multiple responses allowed
  if (attemptNo > 1 && !campaign.allow_multiple_responses) {
    return errorResponse(409, 'CONFLICT', 'Multiple responses not allowed for this campaign');
  }

  // Generate response ID
  const responseId = generateId(64);
  const now = formatDateTime(new Date());
  const status = body.status || (body.is_complete ? 'completed' : 'in_progress');
  const submittedAt = status === 'completed' ? now : null;

  // Insert response
  await query(
    `INSERT INTO responses 
    (response_id, respondent_id, campaign_id, version_id, attempt_no, status, data, request_data, client_meta, submitted_at, removed, created, last_update)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
    [
      responseId,
      body.respondent_id,
      body.campaign_id,
      campaign.version_id,
      attemptNo,
      status,
      JSON.stringify(body.data),
      body.request_data ? JSON.stringify(body.request_data) : null,
      body.client_meta ? JSON.stringify(body.client_meta) : null,
      submittedAt,
      now,
      now
    ]
  );

  // Return created response (admin only, so respondent=null, isAdmin=true)
  return await getResponse(event, responseId, null, true);
}

// Update existing response
async function updateResponse(event, user, responseId, respondent, isAdmin) {
  const body = parseBody(event);

  // Verify response exists and get respondent info
  const existing = await queryOne(
    `SELECT r.response_id, r.status, cr.email 
     FROM responses r
     LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
     WHERE r.response_id = ? AND r.removed = 0`,
    [responseId]
  );
  
  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', 'Response not found');
  }

  // Authorization check: respondents can only update their own responses
  if (!isAdmin && respondent) {
    if (existing.email !== respondent.email) {
      return errorResponse(403, 'FORBIDDEN', 'You can only update your own responses');
    }
  }

  // Build update query dynamically
  const updates = [];
  const params = [];
  
  if (body.data !== undefined) {
    updates.push('data = ?');
    params.push(JSON.stringify(body.data));
  }
  
  if (body.status !== undefined) {
    updates.push('status = ?');
    params.push(body.status);
    
    // Update submitted_at if status changes to completed
    if (body.status === 'completed' && existing.status !== 'completed') {
      updates.push('submitted_at = ?');
      params.push(formatDateTime(new Date()));
    }
  }
  
  if (body.request_data !== undefined) {
    updates.push('request_data = ?');
    params.push(body.request_data ? JSON.stringify(body.request_data) : null);
  }
  
  if (body.client_meta !== undefined) {
    updates.push('client_meta = ?');
    params.push(body.client_meta ? JSON.stringify(body.client_meta) : null);
  }

  if (updates.length === 0) {
    return errorResponse(400, 'BAD_REQUEST', 'No fields to update');
  }

  // Add last_update
  updates.push('last_update = ?');
  params.push(formatDateTime(new Date()));
  
  // Add response_id for WHERE clause
  params.push(responseId);

  // Execute update
  await query(
    `UPDATE responses SET ${updates.join(', ')} WHERE response_id = ?`,
    params
  );

  // Return updated response
  return await getResponse(event, responseId, respondent, isAdmin);
}

// Bulk create responses
async function createResponsesBulk(event, user) {
  const body = parseBody(event);
  
  if (!Array.isArray(body.responses) || body.responses.length === 0) {
    return errorResponse(400, 'BAD_REQUEST', 'Expected array of responses in body.responses');
  }

  const results = {
    created: [],
    failed: []
  };

  // Process each response
  for (const responseData of body.responses) {
    try {
      // Validate required fields
      if (!responseData.respondent_id || !responseData.campaign_id || !responseData.data) {
        results.failed.push({
          data: responseData,
          error: 'Missing required fields: respondent_id, campaign_id, data'
        });
        continue;
      }

      // Verify campaign exists
      const campaign = await queryOne(
        'SELECT campaign_id, version_id, allow_multiple_responses FROM campaigns WHERE campaign_id = ? AND removed = 0',
        [responseData.campaign_id]
      );
      
      if (!campaign) {
        results.failed.push({
          data: responseData,
          error: 'Campaign not found'
        });
        continue;
      }

      // Verify respondent exists
      const respondent = await queryOne(
        'SELECT respondent_id FROM campaign_respondents WHERE respondent_id = ? AND campaign_id = ?',
        [responseData.respondent_id, responseData.campaign_id]
      );
      
      if (!respondent) {
        results.failed.push({
          data: responseData,
          error: 'Respondent not found in campaign'
        });
        continue;
      }

      // Determine attempt number
      const existingResponses = await query(
        'SELECT attempt_no FROM responses WHERE respondent_id = ? AND removed = 0 ORDER BY attempt_no DESC LIMIT 1',
        [responseData.respondent_id]
      );
      
      const attemptNo = existingResponses.length > 0 ? existingResponses[0].attempt_no + 1 : 1;
      
      // Check if multiple responses allowed
      if (attemptNo > 1 && !campaign.allow_multiple_responses) {
        results.failed.push({
          data: responseData,
          error: 'Multiple responses not allowed for this campaign'
        });
        continue;
      }

      // Generate response ID
      const responseId = generateId(64);
      const now = formatDateTime(new Date());
      const status = responseData.status || (responseData.is_complete ? 'completed' : 'in_progress');
      const submittedAt = status === 'completed' ? now : null;

      // Insert response
      await query(
        `INSERT INTO responses 
        (response_id, respondent_id, campaign_id, version_id, attempt_no, status, data, request_data, client_meta, submitted_at, removed, created, last_update)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          responseId,
          responseData.respondent_id,
          responseData.campaign_id,
          campaign.version_id,
          attemptNo,
          status,
          JSON.stringify(responseData.data),
          responseData.request_data ? JSON.stringify(responseData.request_data) : null,
          responseData.client_meta ? JSON.stringify(responseData.client_meta) : null,
          submittedAt,
          now,
          now
        ]
      );

      results.created.push({
        response_id: responseId,
        respondent_id: responseData.respondent_id,
        campaign_id: responseData.campaign_id,
        status: status
      });

    } catch (error) {
      results.failed.push({
        data: responseData,
        error: error.message
      });
    }
  }

  return apiResponse(200, {
    created_count: results.created.length,
    failed_count: results.failed.length,
    created: results.created,
    failed: results.failed
  });
}

// Soft delete response
async function deleteResponse(user, responseId, respondent, isAdmin) {
  // Verify response exists and get respondent info
  const existing = await queryOne(
    `SELECT r.response_id, cr.email 
     FROM responses r
     LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
     WHERE r.response_id = ? AND r.removed = 0`,
    [responseId]
  );
  
  if (!existing) {
    return errorResponse(404, 'NOT_FOUND', 'Response not found');
  }

  // Authorization check: respondents can only delete their own responses
  if (!isAdmin && respondent) {
    if (existing.email !== respondent.email) {
      return errorResponse(403, 'FORBIDDEN', 'You can only delete your own responses');
    }
  }

  // Soft delete
  const now = formatDateTime(new Date());
  await query(
    'UPDATE responses SET removed = 1, last_update = ? WHERE response_id = ?',
    [now, responseId]
  );

  return apiResponse(200, {
    response_id: responseId,
    message: 'Response deleted successfully'
  });
}
