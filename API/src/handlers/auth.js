// Authentication handler
import { queryOne, query } from '../db.js';
import { apiResponse, errorResponse, parseBody, hashValue, generateToken, generateId, formatDateTime } from '../utils.js';
import { generateJWT, authenticate, hasRole } from '../auth.js';
import bcrypt from 'bcryptjs';

/**
 * Handle authentication endpoints
 */
export async function handleAuth(event, method, path, authToken) {
  // POST /auth - Login
  if (path === '/auth' && method === 'POST') {
    return await login(event);
  }

  // GET /auth/me - Get current user
  if (path === '/auth/me' && method === 'GET') {
    return await getCurrentUser(event, authToken);
  }

  // GET /api-tokens - List user's API tokens
  if (path === '/api-tokens' && method === 'GET') {
    return await listAPITokens(event, authToken);
  }

  // POST /api-tokens - Create API token
  if (path === '/api-tokens' && method === 'POST') {
    return await createAPIToken(event, authToken);
  }

  // DELETE /api-tokens/{token_id} - Revoke API token
  const deleteMatch = path.match(/^\/api-tokens\/([^/]+)$/);
  if (deleteMatch && method === 'DELETE') {
    return await revokeAPIToken(event, authToken, deleteMatch[1]);
  }

  return errorResponse(404, 'NOT_FOUND', 'Auth endpoint not found');
}

/**
 * POST /auth - Login
 */
async function login(event) {
  const body = parseBody(event);
  const { email, password } = body;

  if (!email || !password) {
    return errorResponse(400, 'MISSING_FIELDS', 'Email and password are required');
  }

  // Find user
  const user = await queryOne(
    'SELECT * FROM users WHERE email = ?',
    [email]
  );

  if (!user) {
    return errorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    return errorResponse(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  // Generate JWT
  const token = generateJWT(user);

  return apiResponse(200, {
    token,
    token_type: 'Bearer',
    expires_in: 3600,
    user: {
      user_id: user.user_id,
      email: user.email,
      firstname: user.firstname,
      lastname: user.lastname,
      roles: typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles
    }
  });
}

/**
 * GET /auth/me - Get current user
 */
async function getCurrentUser(event, authToken) {
  const user = await authenticate(event, authToken);

  return apiResponse(200, {
    user_id: user.user_id,
    email: user.email,
    firstname: user.firstname,
    lastname: user.lastname,
    roles: typeof user.roles === 'string' ? JSON.parse(user.roles) : user.roles
  });
}

/**
 * GET /api-tokens - List API tokens
 */
async function listAPITokens(event, authToken) {
  const user = await authenticate(event, authToken);

  const tokens = await query(
    `SELECT token_id, name, scopes, expires_at, last_used, created
     FROM user_api_tokens
     WHERE user_id = ? AND revoked_at IS NULL
     ORDER BY created DESC`,
    [user.user_id]
  );

  return apiResponse(200, {
    tokens: tokens.map(t => ({
      ...t,
      scopes: typeof t.scopes === 'string' ? JSON.parse(t.scopes) : t.scopes
    }))
  });
}

/**
 * POST /api-tokens - Create API token
 */
async function createAPIToken(event, authToken) {
  const user = await authenticate(event, authToken);
  const body = parseBody(event);
  const { name, scopes, expires_at } = body;

  if (!name) {
    return errorResponse(400, 'MISSING_FIELDS', 'Token name is required');
  }

  // Generate token
  const token = generateToken(32);
  const tokenHash = hashValue(token);
  const tokenId = generateId(32);

  const now = formatDateTime();

  await query(
    `INSERT INTO user_api_tokens (token_id, user_id, name, token_hash, scopes, expires_at, created, last_update)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tokenId,
      user.user_id,
      name,
      tokenHash,
      JSON.stringify(scopes || {}),
      expires_at || null,
      now,
      now
    ]
  );

  return apiResponse(201, {
    token_id: tokenId,
    token, // Only returned once!
    name,
    scopes,
    expires_at,
    created: now
  });
}

/**
 * DELETE /api-tokens/{token_id} - Revoke API token
 */
async function revokeAPIToken(event, authToken, tokenId) {
  const user = await authenticate(event, authToken);

  const result = await query(
    'UPDATE user_api_tokens SET revoked_at = NOW() WHERE token_id = ? AND user_id = ?',
    [tokenId, user.user_id]
  );

  if (result.affectedRows === 0) {
    return errorResponse(404, 'NOT_FOUND', 'Token not found');
  }

  return apiResponse(204, {});
}
