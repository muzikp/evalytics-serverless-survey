// Public survey handler - for respondents
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody, generateId, formatDateTime, extractAuthToken } from '../utils.js';
import { verifyRespondentToken } from '../auth.js';

export async function handlePublicSurvey(event, method, path, authToken) {
  // GET /survey - List public surveys (no auth required)
  if (path === '/survey' && method === 'GET') {
    return await listPublicSurveys();
  }

  // GET /survey/{public_id} - Get survey by public ID
  const getSurveyMatch = path.match(/^\/survey\/([^/]+)$/);
  if (getSurveyMatch && method === 'GET') {
    return await getPublicSurvey(getSurveyMatch[1], authToken);
  }

  // POST /survey/{public_id}/response - Submit or update response
  const responseMatch = path.match(/^\/survey\/([^/]+)\/response$/);
  if (responseMatch && method === 'POST') {
    return await submitResponse(event, responseMatch[1], authToken);
  }

  // GET /survey/{public_id}/response - Get current response
  if (responseMatch && method === 'GET') {
    return await getCurrentResponse(event, responseMatch[1], authToken);
  }

  // POST /survey/{public_id}/attempts - Create new attempt
  const attemptsMatch = path.match(/^\/survey\/([^/]+)\/attempts$/);
  if (attemptsMatch && method === 'POST') {
    return await createNewAttempt(event, attemptsMatch[1], authToken);
  }

  return errorResponse(404, 'NOT_FOUND', 'Public survey endpoint not found');
}

async function listPublicSurveys() {
  // List currently open campaigns
  const campaigns = await query(
    `SELECT c.public_id, c.title, c.description, c.open_on, c.close_on, s.version, t.name as template_name
     FROM campaigns c
     LEFT JOIN snapshots s ON c.snapshot_id = s.snapshot_id
     LEFT JOIN templates t ON s.template_id = t.template_id
     WHERE (c.open_on IS NULL OR c.open_on <= NOW())
       AND (c.close_on IS NULL OR c.close_on >= NOW())
     ORDER BY c.created DESC`
  );

  return apiResponse(200, {
    surveys: campaigns.map(c => ({
      public_id: c.public_id,
      title: typeof c.title === 'string' ? JSON.parse(c.title) : c.title,
      description: c.description ? (typeof c.description === 'string' ? JSON.parse(c.description) : c.description) : null,
      template_name: c.template_name,
      snapshot_version: c.version
    }))
  });
}

async function getPublicSurvey(publicId, authToken) {
  // Get campaign info
  const campaign = await queryOne(
    `SELECT c.*, s.data as snapshot_data, s.surveyjs_version, s.languages
     FROM campaigns c
     LEFT JOIN snapshots s ON c.snapshot_id = s.snapshot_id
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
    title: typeof campaign.title === 'string' ? JSON.parse(campaign.title) : campaign.title,
    description: campaign.description ? (typeof campaign.description === 'string' ? JSON.parse(campaign.description) : campaign.description) : null,
    surveyjs_version: campaign.surveyjs_version,
    languages: typeof campaign.languages === 'string' ? JSON.parse(campaign.languages) : campaign.languages,
    survey_data: typeof campaign.snapshot_data === 'string' ? JSON.parse(campaign.snapshot_data) : campaign.snapshot_data,
    allow_multiple_responses: campaign.allow_multiple_responses,
    max_attempts: campaign.max_attempts,
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
    await query(
      `INSERT INTO responses (response_id, respondent_id, campaign_id, snapshot_id, attempt_no, status, data, client_meta, submitted_at, created, last_update)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        responseId,
        respondent.respondent_id,
        respondent.campaign_id,
        respondent.snapshot_id,
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

  await query(
    `INSERT INTO responses (response_id, respondent_id, campaign_id, snapshot_id, attempt_no, status, data, created, last_update)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      responseId,
      respondent.respondent_id,
      respondent.campaign_id,
      respondent.snapshot_id,
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
