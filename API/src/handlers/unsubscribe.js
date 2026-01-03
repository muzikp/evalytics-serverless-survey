// Unsubscribe handler - email opt-out
import { query, queryOne } from '../db.js';
import { apiResponse, errorResponse, parseBody, hashValue, formatDateTime } from '../utils.js';
import crypto from 'crypto';

const UNSUBSCRIBE_SECRET = process.env.UNSUBSCRIBE_SECRET || process.env.JWT_SECRET;

export async function handleUnsubscribe(event, method, path) {
  // GET /unsubscribe - Link from email
  if (path === '/unsubscribe' && method === 'GET') {
    const token = event.queryStringParameters?.u;
    const reason = event.queryStringParameters?.reason;
    return await unsubscribe(token, reason);
  }

  // POST /unsubscribe - API endpoint
  if (path === '/unsubscribe' && method === 'POST') {
    const body = parseBody(event);
    return await unsubscribe(body.token, body.reason);
  }

  return errorResponse(404, 'NOT_FOUND', 'Unsubscribe endpoint not found');
}

async function unsubscribe(token, reason = null) {
  if (!token) {
    return errorResponse(400, 'MISSING_TOKEN', 'Unsubscribe token is required');
  }

  // Verify HMAC signature and decode
  const decoded = verifyUnsubscribeToken(token);
  if (!decoded) {
    return errorResponse(400, 'INVALID_TOKEN', 'Invalid or expired unsubscribe token');
  }

  const { email, scope, snapshot_id } = decoded;
  const emailHash = hashValue(email.toLowerCase());
  const now = formatDateTime();

  // Check if already blacklisted
  const existing = await queryOne(
    `SELECT * FROM email_black_list
     WHERE email_hash = ? AND scope = ? AND (snapshot_id = ? OR snapshot_id IS NULL)`,
    [emailHash, scope, snapshot_id || null]
  );

  if (existing) {
    return apiResponse(200, {
      unsubscribed: true,
      message: 'Already unsubscribed',
      scope: scope,
      snapshot_id: snapshot_id || null
    });
  }

  // Add to blacklist
  await query(
    `INSERT INTO email_black_list (email_hash, scope, snapshot_id, reason, created)
     VALUES (?, ?, ?, ?, ?)`,
    [emailHash, scope, snapshot_id || null, reason, now]
  );

  return apiResponse(200, {
    unsubscribed: true,
    message: scope === 'global' ? 'Unsubscribed from all emails' : 'Unsubscribed from this survey',
    scope: scope,
    snapshot_id: snapshot_id || null
  });
}

export function generateUnsubscribeToken(email, scope = 'snapshot', snapshotId = null) {
  // Create payload
  const payload = {
    email: email.toLowerCase(),
    scope: scope, // 'snapshot' or 'global'
    snapshot_id: snapshotId,
    exp: Math.floor(Date.now() / 1000) + (365 * 24 * 60 * 60) // 1 year expiry
  };

  const payloadStr = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', UNSUBSCRIBE_SECRET)
    .update(payloadStr)
    .digest('base64url');

  return `${Buffer.from(payloadStr).toString('base64url')}.${signature}`;
}

function verifyUnsubscribeToken(token) {
  try {
    const [payloadB64, signature] = token.split('.');
    if (!payloadB64 || !signature) return null;

    const payloadStr = Buffer.from(payloadB64, 'base64url').toString('utf-8');
    const expectedSignature = crypto
      .createHmac('sha256', UNSUBSCRIBE_SECRET)
      .update(payloadStr)
      .digest('base64url');

    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(payloadStr);

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return payload;
  } catch (err) {
    return null;
  }
}
