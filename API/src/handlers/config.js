// Config handler - DB initialization
import { query } from '../db.js';
import { apiResponse, errorResponse, hashValue, generateId, formatDateTime } from '../utils.js';
import { authenticate, requireRole } from '../auth.js';
import bcrypt from 'bcryptjs';

/**
 * Handle /config endpoint
 */
export async function handleConfig(event, method, authToken) {
  if (method !== 'POST') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only POST is allowed');
  }

  // Check if any users exist - if not, allow initialization without auth
  const userCount = await query('SELECT COUNT(*) as count FROM users');
  const hasUsers = userCount[0].count > 0;

  if (hasUsers) {
    // If users exist, require master-admin role
    const user = await authenticate(event, authToken);
    requireRole(user, 'master-admin');
  }

  // Initialize database with default admin user
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@evalytics.cz';
  const adminPassword = process.env.ADMIN_PASSWORD || 'changeme';

  // Check if admin already exists
  const existing = await query('SELECT user_id FROM users WHERE email = ?', [adminEmail]);
  if (existing.length > 0) {
    return errorResponse(409, 'ALREADY_INITIALIZED', 'Admin user already exists');
  }

  // Create admin user
  const userId = generateId(16);
  const passwordHash = await bcrypt.hash(adminPassword, 10);
  const now = formatDateTime();

  await query(
    `INSERT INTO users (user_id, firstname, lastname, email, password_hash, roles, created, last_update)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      'Admin',
      'User',
      adminEmail,
      passwordHash,
      JSON.stringify({ 'master-admin': 1, 'admin': 1 }),
      now,
      now
    ]
  );

  return apiResponse(201, {
    message: 'Database initialized',
    admin_user: {
      user_id: userId,
      email: adminEmail
    }
  });
}
