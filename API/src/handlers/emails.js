/**
 * Email Sending Handlers
 * 
 * Endpoints:
 * - POST /campaigns/{id}/send-emails - Queue emails for sending
 * - GET /unsubscribe/{token} - Unsubscribe from emails
 */

import { query, queryOne } from '../db.js';
import { apiResponse } from '../utils.js';
import { renderEmail, generateUnsubscribeToken } from '../utils/emailRenderer.js';
import { SQSClient, SendMessageBatchCommand } from '@aws-sdk/client-sqs';
import crypto from 'crypto';

const sqs = new SQSClient({ region: process.env.AWS_REGION || 'eu-central-1' });
const QUEUE_URL = process.env.EMAIL_QUEUE_URL;
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || 'https://survey.evalytics.cz';
const API_BASE_URL = process.env.API_BASE_URL || 'https://api.evalytics.cz/v1/survey';

/**
 * POST /campaigns/{id}/send-emails
 * Queue emails for batch sending
 */
export async function sendCampaignEmails(event, user, campaignId) {
  const body = JSON.parse(event.body || '{}');
  const { type, respondent_ids, test_mode = false } = body;
  
  // Validate input
  if (!type || !['invite', 'reminder'].includes(type)) {
    return apiResponse(400, { error: 'Invalid type. Must be "invite" or "reminder"' });
  }
  
  // Load campaign with email templates
  const campaign = await queryOne(
    `SELECT campaign_id, public_id, title, email_template, reminder_template, 
            email_template_fields, default_language, version_id
     FROM campaigns 
     WHERE campaign_id = ? AND removed = 0`,
    [campaignId]
  );
  
  if (!campaign) {
    return apiResponse(404, { error: 'Campaign not found' });
  }
  
  // Select appropriate template
  const template = type === 'invite' ? campaign.email_template : campaign.reminder_template;
  if (!template) {
    return apiResponse(400, { 
      error: `No ${type} template configured for this campaign` 
    });
  }
  
  // Parse JSON fields
  const emailTemplate = typeof template === 'string' ? JSON.parse(template) : template;
  const customFields = campaign.email_template_fields 
    ? (typeof campaign.email_template_fields === 'string' 
        ? JSON.parse(campaign.email_template_fields) 
        : campaign.email_template_fields)
    : [];
  
  // Build respondent query based on type
  let sql = `
    SELECT cr.respondent_id, cr.email, cr.token, cr.unsubscribe_token, cr.data,
           COALESCE(cr.language, c.default_language, 'en') as language
    FROM campaign_respondents cr
    JOIN campaigns c ON cr.campaign_id = c.campaign_id
    WHERE cr.campaign_id = ? AND cr.removed = 0
  `;
  
  const params = [campaignId];
  
  // Filter by invitation status
  if (type === 'invite') {
    sql += ' AND cr.invitation_sent_at IS NULL';
  } else {
    sql += ' AND cr.invitation_sent_at IS NOT NULL';
  }
  
  // Filter by specific respondent IDs if provided
  if (respondent_ids && Array.isArray(respondent_ids) && respondent_ids.length > 0) {
    sql += ' AND cr.respondent_id IN (?)';
    params.push(respondent_ids);
  }
  
  // Exclude blacklisted emails
  sql += `
    AND cr.email NOT IN (
      SELECT email FROM email_blacklist 
      WHERE unsubscribe_all = 1
        OR (scope = 'campaign' AND campaign_id = ?)
    )
  `;
  params.push(campaignId);
  
  const respondents = await query(sql, params);
  
  if (respondents.length === 0) {
    return apiResponse(200, { 
      queued: 0, 
      message: 'No eligible respondents found' 
    });
  }
  
  // Generate unsubscribe tokens for respondents that don't have one
  const respondentsNeedingTokens = respondents.filter(r => !r.unsubscribe_token);
  if (respondentsNeedingTokens.length > 0) {
    for (const respondent of respondentsNeedingTokens) {
      const unsubToken = generateUnsubscribeToken();
      await query(
        'UPDATE campaign_respondents SET unsubscribe_token = ? WHERE respondent_id = ?',
        [unsubToken, respondent.respondent_id]
      );
      respondent.unsubscribe_token = unsubToken;
    }
  }
  
  // Prepare email messages
  const messages = [];
  const stats = {
    queued: 0,
    skipped_blacklist: 0,
    skipped_already_sent: 0,
    skipped_not_invited: 0,
    errors: []
  };
  
  for (const respondent of respondents) {
    try {
      // Parse respondent data
      respondent.data = respondent.data && typeof respondent.data === 'string' 
        ? JSON.parse(respondent.data) 
        : respondent.data || {};
      
      // Render email
      const { subject, html } = renderEmail({
        template: emailTemplate,
        language: respondent.language,
        respondent,
        campaign,
        customFields,
        publicBaseUrl: PUBLIC_BASE_URL,
        apiBaseUrl: API_BASE_URL
      });
      
      messages.push({
        Id: respondent.respondent_id,
        MessageBody: JSON.stringify({
          campaign_id: campaignId,
          respondent_id: respondent.respondent_id,
          recipient_email: respondent.email,
          email_type: type,
          subject,
          html_body: html,
          from_email: process.env.SES_FROM || 'info@evalytics.cz'
        })
      });
      
      stats.queued++;
    } catch (error) {
      console.error(`Error preparing email for ${respondent.email}:`, error);
      stats.errors.push({
        respondent_id: respondent.respondent_id,
        error: error.message
      });
    }
  }
  
  // Test mode: return preview without sending
  if (test_mode) {
    return apiResponse(200, {
      test_mode: true,
      would_send: messages.length,
      preview: messages.slice(0, 3).map(m => ({
        respondent_id: m.Id,
        ...JSON.parse(m.MessageBody)
      })),
      stats
    });
  }
  
  // Send to SQS in batches of 10 (SQS limit)
  const batchSize = 10;
  for (let i = 0; i < messages.length; i += batchSize) {
    const batch = messages.slice(i, i + batchSize);
    
    try {
      await sqs.send(new SendMessageBatchCommand({
        QueueUrl: QUEUE_URL,
        Entries: batch
      }));
    } catch (error) {
      console.error('SQS batch send error:', error);
      return apiResponse(500, { 
        error: 'Failed to queue emails', 
        details: error.message 
      });
    }
  }
  
  return apiResponse(200, { 
    ...stats,
    message: `Queued ${stats.queued} ${type} emails for sending` 
  });
}

/**
 * GET /unsubscribe/{token}?scope=campaign|global
 * Unsubscribe respondent from emails
 */
export async function unsubscribeEmail(event) {
  const token = event.pathParameters?.token;
  const scope = event.queryStringParameters?.scope || 'campaign';
  
  if (!token) {
    return htmlResponse(400, '<h1>Invalid unsubscribe link</h1><p>Token is missing.</p>');
  }
  
  if (!['campaign', 'global'].includes(scope)) {
    return htmlResponse(400, '<h1>Invalid scope</h1><p>Scope must be "campaign" or "global".</p>');
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
    return htmlResponse(404, '<h1>Invalid Link</h1><p>This unsubscribe link is not valid or has expired.</p>');
  }
  
  // Hash email for blacklist
  const emailHash = crypto.createHash('sha256').update(respondent.email.toLowerCase()).digest('hex');
  
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
    return htmlResponse(200, getUnsubscribeHtml(message, respondent, scope));
  }
  
  // Add to blacklist
  const now = new Date().toISOString().slice(0, 19).replace('T', ' ');
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
  
  const message = scope === 'global' 
    ? 'You have been successfully unsubscribed from all emails from Evalytics Survey Service.'
    : `You have been successfully unsubscribed from the survey: "${getCampaignTitle(respondent.title)}".`;
  
  return htmlResponse(200, getUnsubscribeHtml(message, respondent, scope));
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
function getUnsubscribeHtml(message, respondent, scope) {
  const title = scope === 'global' ? 'Unsubscribed from All Emails' : 'Unsubscribed from Survey';
  
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
    <div class="info">
      <strong>Email:</strong> ${respondent.email}<br>
      ${scope === 'campaign' ? `<strong>Survey:</strong> ${getCampaignTitle(respondent.title)}` : ''}
    </div>
  </div>
</body>
</html>
  `;
}
