// Router - handles all API requests
import { apiResponse, errorResponse, parseBody, extractAuthToken, formatDateTime } from './utils.js';
import { authenticate, requireRole } from './auth.js';
import { logRequest, logError, logInfo, isDev } from './logger.js';

// Import handlers
import { handleAuth } from './handlers/auth.js';
import { handleConfig } from './handlers/config.js';
import { handleForms } from './handlers/forms.js';
import { handleFormVersions } from './handlers/formVersions.js';
import { handleCampaigns } from './handlers/campaigns.js';
import { handleResponses } from './handlers/responses.js';
import { handlePublicSurvey } from './handlers/public.js';
import { handleAttachments } from './handlers/attachments.js';
import { handleUnsubscribe } from './handlers/unsubscribe.js';
import { handleEmailAudit } from './handlers/emailAudit.js';
import { handleDocumentation } from './handlers/documentation.js';

/**
 * Main router
 * @param {object} event
 * @returns {Promise<object>}
 */
export async function route(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.requestContext?.http?.path || event.path || '/';
  
  // Log request in development
  const reqId = logRequest(method, path, {
    query: event.queryStringParameters,
    hasAuth: !!event.headers?.authorization || !!event.headers?.['x-api-token']
  });

  // Handle OPTIONS for CORS
  if (method === 'OPTIONS') {
    return apiResponse(200, {});
  }

  // Extract auth token
  const authToken = extractAuthToken(event);

  try {
    // Documentation endpoint - serves OpenAPI spec
    if (path === '/' && method === 'GET') {
      return await handleDocumentation(event, method, path);
    }

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

    if (path.startsWith('/forms')) {
      return await handleForms(event, method, path, authToken);
    }

    if (path.startsWith('/form-versions')) {
      return await handleFormVersions(event, method, path, authToken);
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
    logError('Unhandled error in router', error, {
      requestId: reqId,
      method,
      path,
      query: event.queryStringParameters,
      body: parseBody(event)
    });

    // Show internal error details only in development
    const details = isDev() ? {
      stack: error.stack,
      name: error.name,
      message: error.message
    } : undefined;
    return errorResponse(
      500,
      'INTERNAL_ERROR',
      error.message || 'Internal server error',
      details,
      reqId
    );
  }
}
