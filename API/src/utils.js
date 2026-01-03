// Utility functions
import crypto from 'crypto';

/**
 * Generate a unique ID (simple ULID-like implementation)
 * @param {number} length
 * @returns {string}
 */
export function generateId(length = 16) {
  const chars = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  let result = '';
  const bytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Hash a password or token using SHA-256
 * @param {string} value
 * @returns {string}
 */
export function hashValue(value) {
  return crypto
    .createHash('sha256')
    .update(value)
    .digest('hex');
}

/**
 * Generate a secure random token
 * @param {number} bytes
 * @returns {string}
 */
export function generateToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Create API response
 * @param {number} statusCode
 * @param {any} body
 * @param {object} headers
 * @returns {object}
 */
export function apiResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*', // TODO: Configure properly
      'Access-Control-Allow-Headers': 'Authorization, Content-Type, X-API-Token, X-Respondent-Token',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      ...headers
    },
    body: JSON.stringify(body)
  };
}

/**
 * Create error response
 * @param {number} statusCode
 * @param {string} code
 * @param {string} message
 * @param {object} details
 * @param {string} requestId
 * @returns {object}
 */
export function errorResponse(statusCode, code, message, details = null, requestId = null) {
  const error = {
    code,
    message,
    ...(details && { details }),
    ...(requestId && { request_id: requestId })
  };
  return apiResponse(statusCode, error);
}

/**
 * Format datetime for MySQL
 * @param {Date} date
 * @returns {string}
 */
export function formatDateTime(date = new Date()) {
  return date.toISOString().slice(0, 19).replace('T', ' ');
}

/**
 * Parse request body
 * @param {object} event
 * @returns {object}
 */
export function parseBody(event) {
  if (!event.body) return {};
  try {
    return JSON.parse(event.body);
  } catch (e) {
    return {};
  }
}

/**
 * Extract authorization token from event
 * @param {object} event
 * @returns {{type: string, token: string} | null}
 */
export function extractAuthToken(event) {
  const headers = event.headers || {};
  
  // Normalize headers to lowercase for case-insensitive lookup
  const normalizedHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    normalizedHeaders[key.toLowerCase()] = value;
  }

  // Check Bearer token
  const authHeader = normalizedHeaders['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return { type: 'bearer', token: authHeader.substring(7) };
  }

  // Check X-API-Token
  const apiToken = normalizedHeaders['x-api-token'];
  if (apiToken) {
    return { type: 'api-token', token: apiToken };
  }

  // Check X-Respondent-Token
  const respondentToken = normalizedHeaders['x-respondent-token'];
  if (respondentToken) {
    return { type: 'respondent', token: respondentToken };
  }

  // Check query parameter token (deprecated)
  const queryToken = event.queryStringParameters?.token;
  if (queryToken) {
    return { type: 'respondent', token: queryToken };
  }

  return null;
}
