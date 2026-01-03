// Router - handles all API requests
import { apiResponse, errorResponse, parseBody, extractAuthToken, formatDateTime } from './utils.js';
import { authenticate, requireRole } from './auth.js';

// Import handlers
import { handleAuth } from './handlers/auth.js';
import { handleConfig } from './handlers/config.js';
import { handleTemplates } from './handlers/templates.js';
import { handleSnapshots } from './handlers/snapshots.js';
import { handleCampaigns } from './handlers/campaigns.js';
import { handleResponses } from './handlers/responses.js';
import { handlePublicSurvey } from './handlers/public.js';
import { handleAttachments } from './handlers/attachments.js';
import { handleUnsubscribe } from './handlers/unsubscribe.js';
import { handleEmailAudit } from './handlers/emailAudit.js';

/**
 * Main router
 * @param {object} event
 * @returns {Promise<object>}
 */
export async function route(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.requestContext?.http?.path || event.path || '/';
  
  console.log(`${method} ${path}`);

  // Handle OPTIONS for CORS
  if (method === 'OPTIONS') {
    return apiResponse(200, {});
  }

  // Extract auth token
  const authToken = extractAuthToken(event);

  try {
    // Route to appropriate handler
    if (path === '/auth' || path.startsWith('/auth/')) {
      return await handleAuth(event, method, path, authToken);
    }

    if (path.startsWith('/api-tokens')) {
      return await handleAuth(event, method, path, authToken);
    }

    if (path === '/config') {
      return await handleConfig(event, method, authToken);
    }

    if (path.startsWith('/templates')) {
      return await handleTemplates(event, method, path, authToken);
    }

    if (path.startsWith('/snapshots')) {
      return await handleSnapshots(event, method, path, authToken);
    }

    // Email audit endpoints (before /campaigns to catch specific paths)
    if (path.match(/^\/campaigns\/[^/]+\/email-log/)) {
      return await handleEmailAudit(event, method, path, authToken);
    }

    if (path.startsWith('/campaigns')) {
      return await handleCampaigns(event, method, path, authToken);
    }

    if (path.startsWith('/responses')) {
      return await handleResponses(event, method, path, authToken);
    }

    if (path.startsWith('/survey')) {
      return await handlePublicSurvey(event, method, path, authToken);
    }

    if (path.startsWith('/attachments')) {
      return await handleAttachments(event, method, path, authToken);
    }

    if (path.startsWith('/unsubscribe')) {
      return await handleUnsubscribe(event, method, path);
    }

    // Default: not found
    return errorResponse(404, 'NOT_FOUND', 'Endpoint not found');
  } catch (error) {
    // If error is already a formatted response, return it
    if (error.statusCode) {
      return error;
    }

    // Otherwise, format as 500 error
    console.error('Unhandled error:', error);
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      error.message || 'Internal server error'
    );
  }
}
