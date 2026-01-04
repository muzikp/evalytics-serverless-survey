// Main Lambda handler
import { route } from './router.js';
import { errorResponse } from './utils.js';
import { logError, logInfo, isDev } from './logger.js';

export async function handler(event) {
  const method = event.requestContext?.http?.method || event.httpMethod || 'GET';
  const path = event.requestContext?.http?.path || event.path || '/';

  try {
    if (isDev()) {
      logInfo(`Lambda handler invoked: ${method} ${path}`);
      // Log event summary in development
      console.log('Event details:', JSON.stringify({
        method,
        path,
        query: event.queryStringParameters,
        hasBody: !!event.body,
        headers: Object.keys(event.headers || {})
      }, null, 2));
    }
    return await route(event);
  } catch (error) {
    logError('Unhandled error in Lambda handler', error, { 
      method, 
      path 
    });
    return errorResponse(500, 'INTERNAL_ERROR', error.message || 'Internal server error');
  }
}
