// Public survey handler - for respondents
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody, generateId, formatDateTime, hashValue } from '../utils.js';
import { verifyRespondentToken } from '../auth.js';

// Extract token from query parameters or headers
function extractAuthToken(event) {
  // Check query parameters
  const token = event.queryStringParameters?.token;
  if (token) {
    return { type: 'respondent', token };
  }
  
  // Check Authorization header (format: "Bearer <token>")
  const authHeader = event.headers?.Authorization || event.headers?.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return { type: 'respondent', token: authHeader.substring(7) };
  }
  
  return null;
}

export async function handlePublicSurvey(event, method, path) {
  // GET /survey/{publicId} - Get survey for respondent
  const getSurveyMatch = path.match(/^\/survey\/([^/]+)$/);
  if (getSurveyMatch && method === 'GET') {
    const authToken = extractAuthToken(event);
    return await getPublicSurvey(getSurveyMatch[1], authToken);
  }

  // GET /survey/{publicId}/response/current - Get current response for respondent
  const getCurrentMatch = path.match(/^\/survey\/([^/]+)\/response\/current$/);
  if (getCurrentMatch && method === 'GET') {
    const authToken = extractAuthToken(event);
    return await getCurrentResponse(event, getCurrentMatch[1], authToken);
  }

  // POST /survey/{publicId}/response - Submit survey response
  const submitMatch = path.match(/^\/survey\/([^/]+)\/response$/);
  if (submitMatch && method === 'POST') {
    const authToken = extractAuthToken(event);
    return await submitResponse(event, submitMatch[1], authToken);
  }

  return errorResponse(404, 'NOT_FOUND', 'Survey endpoint not found');
}

async function listPublicSurveys() {
  // List currently open campaigns
  const campaigns = await query(
    `SELECT c.public_id, c.title, c.description, c.open_on, c.close_on, fv.version, f.name as form_name
     FROM campaigns c
     LEFT JOIN form_versions fv ON c.version_id = fv.version_id
     LEFT JOIN forms f ON fv.form_id = f.form_id
     WHERE (c.open_on IS NULL OR c.open_on <= NOW())
       AND (c.close_on IS NULL OR c.close_on >= NOW())
     ORDER BY c.created DESC`
  );

  return apiResponse(200, {
    surveys: campaigns.map(c => ({
      public_id: c.public_id,
      title: typeof c.title === 'string' ? JSON.parse(c.title) : c.title,
      description: c.description ? (typeof c.description === 'string' ? JSON.parse(c.description) : c.description) : null,
      form_name: c.form_name,
      form_version: c.version
    }))
  });
}

async function getPublicSurvey(publicId, authToken) {
  // Get campaign info
  const campaign = await queryOne(
    `SELECT c.*, fv.data as form_data, fv.surveyjs_version, fv.languages
     FROM campaigns c
     LEFT JOIN form_versions fv ON c.version_id = fv.version_id
     WHERE c.public_id = ?`,
    [publicId]
  );

  if (!campaign) {
    return errorResponse(404, 'NOT_FOUND', 'Survey not found');
  }

  // Check if campaign is open
  const now = new Date();
  if (campaign.open_on && new Date(campaign.open_on) > now) {
    return errorResponse(403, 'NOT_OPEN', 'Survey is not yet open');
  }
  if (campaign.close_on && new Date(campaign.close_on) < now) {
    return errorResponse(403, 'CLOSED', 'Survey is closed');
  }

  // If token provided, verify it and get respondent info
  let respondent = null;
  if (authToken && authToken.type === 'respondent') {
    respondent = await verifyRespondentToken(authToken.token, publicId);
  }

  return apiResponse(200, {
    public_id: campaign.public_id,
    title: campaign.title,  // MySQL JSON column already parsed
    description: campaign.description,  // MySQL JSON column already parsed
    surveyjs_version: campaign.surveyjs_version,
    languages: campaign.languages,  // MySQL JSON column already parsed
    survey_data: campaign.form_data,  // MySQL JSON column already parsed
    allow_multiple_responses: campaign.allow_multiple_responses,
    max_attempts: campaign.max_attempts,
    can_edit_after_submit: Boolean(campaign.can_edit_after_submit),
    can_reopen_after_submit: Boolean(campaign.can_reopen_after_submit ?? true), // Default true if null
    respondent: respondent ? {
      respondent_id: respondent.respondent_id,
      email: respondent.email
    } : null
  });
}

async function getCurrentResponse(event, publicId, authToken) {
  if (!authToken || authToken.type !== 'respondent') {
    return errorResponse(401, 'UNAUTHORIZED', 'Respondent token required');
  }

  const respondent = await verifyRespondentToken(authToken.token, publicId);
  if (!respondent) {
    return errorResponse(401, 'INVALID_TOKEN', 'Invalid respondent token');
  }

  // Get latest in-progress response or last completed response
  const response = await queryOne(
    `SELECT * FROM responses
     WHERE respondent_id = ?
     ORDER BY attempt_no DESC, last_update DESC
     LIMIT 1`,
    [respondent.respondent_id]
  );

  if (!response) {
    return errorResponse(404, 'NOT_FOUND', 'No response found');
  }

  return apiResponse(200, {
    response_id: response.response_id,
    attempt_no: response.attempt_no,
    status: response.status,
    data: typeof response.data === 'string' ? JSON.parse(response.data) : response.data,
    submitted_at: response.submitted_at,
    created: response.created,
    last_update: response.last_update
  });
}

async function submitResponse(event, publicId, authToken) {
  if (!authToken || authToken.type !== 'respondent') {
    return errorResponse(401, 'UNAUTHORIZED', 'Respondent token required');
  }

  const respondent = await verifyRespondentToken(authToken.token, publicId);
  if (!respondent) {
    return errorResponse(401, 'INVALID_TOKEN', 'Invalid respondent token');
  }

  const body = parseBody(event);
  const { data, status = 'in_progress', client_meta } = body;

  if (!data) {
    return errorResponse(400, 'MISSING_FIELDS', 'data is required');
  }

  // Get current attempt or create new one
  let response = await queryOne(
    `SELECT * FROM responses
     WHERE respondent_id = ?
     ORDER BY attempt_no DESC
     LIMIT 1`,
    [respondent.respondent_id]
  );

  const now = formatDateTime();

  if (!response) {
    // Create first response
    const responseId = generateId(64);
    // Get version_id from campaign
    const campaign = await queryOne('SELECT version_id FROM campaigns WHERE campaign_id = ?', [respondent.campaign_id]);
    await query(
      `INSERT INTO responses (response_id, respondent_id, campaign_id, version_id, attempt_no, status, data, client_meta, submitted_at, created, last_update)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        responseId,
        respondent.respondent_id,
        respondent.campaign_id,
        campaign.version_id,
        1,
        status,
        JSON.stringify(data),
        client_meta ? JSON.stringify(client_meta) : null,
        status === 'completed' ? now : null,
        now,
        now
      ]
    );

    response = await queryOne('SELECT * FROM responses WHERE response_id = ?', [responseId]);
  } else {
    // Update existing response
    await query(
      `UPDATE responses
       SET data = ?, status = ?, client_meta = ?, submitted_at = ?, last_update = ?
       WHERE response_id = ?`,
      [
        JSON.stringify(data),
        status,
        client_meta ? JSON.stringify(client_meta) : null,
        status === 'completed' ? now : response.submitted_at,
        now,
        response.response_id
      ]
    );

    response = await queryOne('SELECT * FROM responses WHERE response_id = ?', [response.response_id]);
  }

  return apiResponse(200, {
    response_id: response.response_id,
    attempt_no: response.attempt_no,
    status: response.status,
    submitted_at: response.submitted_at
  });
}

async function createNewAttempt(event, publicId, authToken) {
  if (!authToken || authToken.type !== 'respondent') {
    return errorResponse(401, 'UNAUTHORIZED', 'Respondent token required');
  }

  const respondent = await verifyRespondentToken(authToken.token, publicId);
  if (!respondent) {
    return errorResponse(401, 'INVALID_TOKEN', 'Invalid respondent token');
  }

  // Get campaign to check if multiple responses allowed
  const campaign = await queryOne(
    'SELECT allow_multiple_responses, max_attempts FROM campaigns WHERE campaign_id = ?',
    [respondent.campaign_id]
  );

  if (!campaign.allow_multiple_responses) {
    return errorResponse(403, 'FORBIDDEN', 'Multiple responses not allowed for this survey');
  }

  // Check current attempt count
  const attemptCount = await queryOne(
    'SELECT COUNT(*) as count, MAX(attempt_no) as max_attempt FROM responses WHERE respondent_id = ?',
    [respondent.respondent_id]
  );

  if (campaign.max_attempts && attemptCount.count >= campaign.max_attempts) {
    return errorResponse(403, 'MAX_ATTEMPTS_REACHED', 'Maximum number of attempts reached');
  }

  const nextAttemptNo = (attemptCount.max_attempt || 0) + 1;
  const responseId = generateId(64);
  const now = formatDateTime();

  // Get version_id from campaign
  const campaignInfo = await queryOne('SELECT version_id FROM campaigns WHERE campaign_id = ?', [respondent.campaign_id]);

  await query(
    `INSERT INTO responses (response_id, respondent_id, campaign_id, version_id, attempt_no, status, data, created, last_update)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      responseId,
      respondent.respondent_id,
      respondent.campaign_id,
      campaignInfo.version_id,
      nextAttemptNo,
      'in_progress',
      JSON.stringify({}),
      now,
      now
    ]
  );

  return apiResponse(201, {
    response_id: responseId,
    attempt_no: nextAttemptNo,
    status: 'in_progress'
  });
}
