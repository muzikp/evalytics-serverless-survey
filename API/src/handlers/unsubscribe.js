// Unsubscribe handler - email opt-out
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, formatDateTime } from '../utils.js';
import crypto from 'crypto';

/**
 * Handle unsubscribe requests
 * GET /unsubscribe/{token}?scope=campaign|global
 */
export async function handleUnsubscribe(event, method, path) {
  // GET /unsubscribe/{token}
  const match = path.match(/^\/unsubscribe\/([^/]+)/);
  
  if (match && method === 'GET') {
    const token = match[1];
    const scope = event.queryStringParameters?.scope || 'campaign';
    return await unsubscribeEmail(token, scope);
  }

  return errorResponse(404, 'NOT_FOUND', 'Unsubscribe endpoint not found');
}

/**
 * Unsubscribe email from campaigns
 */
async function unsubscribeEmail(token, scope) {
  if (!token) {
    return htmlResponse(400, '<h1>Invalid Link</h1><p>Unsubscribe token is missing.</p>');
  }
  
  if (!['campaign', 'global'].includes(scope)) {
    return htmlResponse(400, '<h1>Invalid Scope</h1><p>Scope must be "campaign" or "global".</p>');
  }
  
  // Find respondent by unsubscribe token
  const respondent = await queryOne(
    `SELECT cr.respondent_id, cr.email, cr.campaign_id, c.title, c.public_id
     FROM campaign_respondents cr
     JOIN campaigns c ON cr.campaign_id = c.campaign_id
     WHERE cr.unsubscribe_token = ?`,
    [token]
  );
  
  if (!respondent) {
    return htmlResponse(404, getUnsubscribeHtml(
      'Invalid Link', 
      'This unsubscribe link is not valid or has expired.',
      null,
      null
    ));
  }
  
  // Check if already blacklisted
  const existingBlacklist = await queryOne(
    `SELECT * FROM email_blacklist 
     WHERE email = ? AND (
       (scope = 'global' AND unsubscribe_all = 1) 
       OR (scope = 'campaign' AND campaign_id = ? AND unsubscribe_all = 0)
     )`,
    [respondent.email, respondent.campaign_id]
  );
  
  if (existingBlacklist) {
    const message = scope === 'global' 
      ? 'You are already unsubscribed from all emails.'
      : 'You are already unsubscribed from this survey.';
    return htmlResponse(200, getUnsubscribeHtml(
      'Already Unsubscribed',
      message,
      respondent,
      scope
    ));
  }
  
  // Add to blacklist
  const now = formatDateTime();
  await query(
    `INSERT INTO email_blacklist 
     (email, scope, campaign_id, unsubscribe_all, reason, blacklisted_at, blacklisted_by)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      respondent.email,
      scope,
      scope === 'campaign' ? respondent.campaign_id : null,
      scope === 'global' ? 1 : 0,
      `User unsubscribed via link (scope: ${scope})`,
      now,
      'self'
    ]
  );
  
  const title = scope === 'global' ? 'Unsubscribed from All Emails' : 'Unsubscribed from Survey';
  const message = scope === 'global' 
    ? 'You have been successfully unsubscribed from all emails from Evalytics Survey Service.'
    : `You have been successfully unsubscribed from the survey: "${getCampaignTitle(respondent.title)}".`;
  
  return htmlResponse(200, getUnsubscribeHtml(title, message, respondent, scope));
}

/**
 * Get campaign title in default language
 */
function getCampaignTitle(titleJson) {
  try {
    const title = typeof titleJson === 'string' ? JSON.parse(titleJson) : titleJson;
    return title.en || title.cs || title.de || 'Survey';
  } catch {
    return 'Survey';
  }
}

/**
 * Generate HTML response
 */
function htmlResponse(statusCode, html) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'text/html; charset=utf-8'
    },
    body: html
  };
}

/**
 * Generate unsubscribe confirmation HTML
 */
function getUnsubscribeHtml(title, message, respondent, scope) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0;
      padding: 20px;
    }
    .container {
      background: white;
      border-radius: 12px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
      padding: 40px;
      max-width: 500px;
      text-align: center;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 20px;
    }
    h1 {
      color: #2d3748;
      font-size: 28px;
      margin-bottom: 16px;
    }
    p {
      color: #4a5568;
      font-size: 16px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .info {
      background: #f7fafc;
      border-left: 4px solid #667eea;
      padding: 16px;
      margin-top: 24px;
      text-align: left;
      border-radius: 4px;
    }
    .info strong {
      color: #2d3748;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">✓</div>
    <h1>${title}</h1>
    <p>${message}</p>
    ${respondent ? `
    <div class="info">
      <strong>Email:</strong> ${respondent.email}<br>
      ${scope === 'campaign' ? `<strong>Survey:</strong> ${getCampaignTitle(respondent.title)}` : ''}
    </div>
    ` : ''}
  </div>
</body>
</html>
  `;
}
