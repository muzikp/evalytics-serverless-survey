/**
 * Reset admin user password
 * Usage: node reset-admin-password.js [email] [new-password]
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcryptjs';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'vcagent',
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'evalytics_survey'
};

async function resetPassword() {
  const email = process.argv[2] || 'muzikp@gmail.com';
  const newPassword = process.argv[3] || 'admin123';

  console.log(`\n🔐 Resetting password for: ${email}`);
  console.log(`🔑 New password: ${newPassword}\n`);

  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    // Check if user exists
    const [users] = await conn.execute(
      'SELECT user_id, email, firstname, lastname FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      console.error(`❌ User not found: ${email}`);
      process.exit(1);
    }

    const user = users[0];
    console.log(`✅ Found user: ${user.firstname} ${user.lastname} (${user.user_id})`);

    // Hash password
    const passwordHash = await bcrypt.hash(newPassword, 10);
    console.log(`🔒 Password hashed`);

    // Update password
    await conn.execute(
      'UPDATE users SET password_hash = ?, last_update = ? WHERE email = ?',
      [passwordHash, new Date(), email]
    );

    console.log(`✅ Password updated successfully!\n`);
    console.log(`📝 Login credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}\n`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await conn.end();
  }
}

resetPassword().catch(console.error);
