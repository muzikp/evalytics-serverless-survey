// Authentication and authorization middleware
import jwt from 'jsonwebtoken';
import { query, queryOne } from './db.js';
import { hashValue, errorResponse } from './utils.js';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';
const JWT_EXPIRES_IN = '1h';

/**
 * Generate JWT token for user
 * @param {object} user
 * @returns {string}
 */
export function generateJWT(user) {
  return jwt.sign(
    {
      user_id: user.user_id,
      email: user.email,
      roles: user.roles
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );
}

/**
 * Verify JWT token
 * @param {string} token
 * @returns {object | null}
 */
export function verifyJWT(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

/**
 * Verify API token
 * @param {string} token
 * @returns {Promise<object | null>}
 */
export async function verifyAPIToken(token) {
  const tokenHash = hashValue(token);
  const userToken = await queryOne(
    `SELECT ut.*, u.user_id, u.email, u.roles, u.firstname, u.lastname
     FROM user_api_tokens ut
     JOIN users u ON ut.user_id = u.user_id
     WHERE ut.token_hash = ?
       AND (ut.expires_at IS NULL OR ut.expires_at > NOW())
       AND ut.revoked_at IS NULL`,
    [tokenHash]
  );

  if (!userToken) return null;

  // Update last_used
  await query(
    'UPDATE user_api_tokens SET last_used = NOW() WHERE token_id = ?',
    [userToken.token_id]
  );

  return {
    user_id: userToken.user_id,
    email: userToken.email,
    roles: userToken.roles,
    firstname: userToken.firstname,
    lastname: userToken.lastname,
    scopes: userToken.scopes || {}
  };
}

/**
 * Verify respondent token
 * @param {string} token
 * @param {string} publicId
 * @returns {Promise<object | null>}
 */
export async function verifyRespondentToken(token, publicId = null) {
  const tokenHash = hashValue(token);
  
  console.log('[verifyRespondentToken] Input token:', token);
  console.log('[verifyRespondentToken] Token hash:', tokenHash);
  console.log('[verifyRespondentToken] Public ID:', publicId);
  
  let sql = `
    SELECT cr.*, c.campaign_id, c.public_id, c.version_id, c.open_on, c.close_on
    FROM campaign_respondents cr
    JOIN campaigns c ON cr.campaign_id = c.campaign_id
    WHERE cr.token_hash = ?
  `;
  const params = [tokenHash];

  if (publicId) {
    sql += ' AND c.public_id = ?';
    params.push(publicId);
  }

  const respondent = await queryOne(sql, params);
  
  console.log('[verifyRespondentToken] Found respondent:', respondent ? 'YES' : 'NO');
  
  if (!respondent) return null;

  // Check if campaign is open
  const now = new Date();
  if (respondent.open_on && new Date(respondent.open_on) > now) {
    return null; // Not yet open
  }
  if (respondent.close_on && new Date(respondent.close_on) < now) {
    return null; // Already closed
  }

  return respondent;
}

/**
 * Authenticate request
 * Returns user object or throws error
 * @param {object} event
 * @param {object} authToken - from extractAuthToken
 * @returns {Promise<object>}
 */
export async function authenticate(event, authToken) {
  if (!authToken) {
    throw errorResponse(401, 'UNAUTHORIZED', 'Missing authentication token');
  }

  if (authToken.type === 'bearer') {
    const decoded = verifyJWT(authToken.token);
    if (!decoded) {
      throw errorResponse(401, 'INVALID_TOKEN', 'Invalid or expired JWT token');
    }
    return { ...decoded, auth_type: 'jwt' };
  }

  if (authToken.type === 'api-token') {
    const user = await verifyAPIToken(authToken.token);
    if (!user) {
      throw errorResponse(401, 'INVALID_TOKEN', 'Invalid or expired API token');
    }
    return { ...user, auth_type: 'api-token' };
  }

  throw errorResponse(401, 'INVALID_AUTH', 'Invalid authentication method');
}

/**
 * Check if user has required role
 * @param {object} user
 * @param {string} role
 * @returns {boolean}
 */
export function hasRole(user, role) {
  if (!user || !user.roles) return false;
  const roles = typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles;
  return roles[role] === 1 || roles[role] === true;
}

/**
 * Require role middleware
 * @param {object} user
 * @param {string} role
 * @throws {Error}
 */
export function requireRole(user, role) {
  if (!hasRole(user, role)) {
    throw errorResponse(403, 'FORBIDDEN', `Required role: ${role}`);
  }
}
