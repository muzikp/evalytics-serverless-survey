/**
 * Logger utility for development and production
 * In development (APP_ENV=local), logs detailed information including stack traces
 */

const isDevelopment = process.env.APP_ENV === 'local' || process.env.NODE_ENV === 'development';

/**
 * Generate a simple request ID for tracking
 * @param {string} method
 * @param {string} path
 * @returns {string}
 */
function generateRequestId(method, path) {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${method}-${path.replace(/\//g, '-').substring(1, 20)}-${timestamp}-${random}`;
}

/**
 * Format error for logging
 * @param {Error} error
 * @returns {object}
 */
function formatError(error) {
  if (!(error instanceof Error)) {
    return { message: String(error) };
  }

  return {
    name: error.name,
    message: error.message,
    stack: isDevelopment ? error.stack : undefined,
    ...(error.code && { code: error.code }),
    ...(error.sql && { sql: error.sql }),
    ...(error.sqlMessage && { sqlMessage: error.sqlMessage })
  };
}

/**
 * Log info message
 */
export function logInfo(message, data = {}) {
  const timestamp = new Date().toISOString();
  console.log(`[INFO] [${timestamp}] ${message}`, Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
}

/**
 * Log warning message
 */
export function logWarn(message, data = {}) {
  const timestamp = new Date().toISOString();
  console.warn(`[WARN] [${timestamp}] ${message}`, Object.keys(data).length > 0 ? JSON.stringify(data, null, 2) : '');
}

/**
 * Log error with details
 * @param {string} message
 * @param {Error|object} error
 * @param {object} context - Additional context (requestId, method, path, etc.)
 */
export function logError(message, error = null, context = {}) {
  const timestamp = new Date().toISOString();
  const requestId = context.requestId || 'unknown';
  const method = context.method || '';
  const path = context.path || '';
  
  const logData = {
    message,
    requestId,
    ...(method && path && { endpoint: `${method} ${path}` }),
    ...(error && { error: formatError(error) }),
    ...(isDevelopment && context.body && { body: context.body }),
    ...(isDevelopment && context.query && { query: context.query }),
    ...(isDevelopment && context.params && { params: context.params })
  };

  console.error(`[ERROR] [${timestamp}] [${requestId}] ${message}`);
  if (isDevelopment) {
    console.error('Error details:', JSON.stringify(logData, null, 2));
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } else {
    // In production, log minimal info
    console.error('Error:', JSON.stringify({
      message,
      requestId,
      error: error instanceof Error ? { name: error.name, message: error.message } : error
    }));
  }
}

/**
 * Log request (for debugging in development)
 * @param {string} method
 * @param {string} path
 * @param {object} context
 */
export function logRequest(method, path, context = {}) {
  const requestId = generateRequestId(method, path);
  
  if (!isDevelopment) {
    return requestId; // Return ID even in production, just don't log
  }

  const timestamp = new Date().toISOString();
  
  const logData = {
    requestId,
    method,
    path,
    timestamp,
    ...(context.query && { query: context.query }),
    ...(context.hasAuth && { hasAuth: context.hasAuth }),
    ...(context.userId && { userId: context.userId })
  };

  console.log(`[REQUEST] [${timestamp}] [${requestId}] ${method} ${path}`);
  if (Object.keys(logData).length > 4) {
    console.log('Request details:', JSON.stringify(logData, null, 2));
  }

  return requestId;
}

/**
 * Log database query (development only)
 * @param {string} sql
 * @param {array} params
 */
export function logQuery(sql, params = []) {
  if (!isDevelopment) return;
  console.log(`[DB] ${sql}`, params.length > 0 ? `[params: ${JSON.stringify(params)}]` : '');
}

/**
 * Check if we're in development mode
 */
export function isDev() {
  return isDevelopment;
}

