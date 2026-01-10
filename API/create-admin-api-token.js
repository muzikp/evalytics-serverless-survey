/**
 * Create API token for admin user
 * 
 * Usage: node create-admin-api-token.js
 */

import mysql from 'mysql2/promise';
import crypto from 'crypto';

const DB_CONFIG = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'vcagent',
  password: process.env.DB_PASSWORD || 'HUIEwhmeAk9I7k7b_Wg8T',
  database: process.env.DB_NAME || 'evalytics_survey'
};

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex');
}

async function createAdminAPIToken() {
  console.log('\n🔑 Creating Admin API Token...\n');

  const conn = await mysql.createConnection(DB_CONFIG);

  try {
    // Find admin user (first user in DB)
    const [users] = await conn.execute(
      "SELECT user_id, email FROM users ORDER BY created LIMIT 1"
    );

    if (users.length === 0) {
      console.error('❌ Admin user not found!');
      process.exit(1);
    }

    const admin = users[0];
    console.log(`✓ Found admin user: ${admin.email}`);

    // Generate token
    const tokenId = generateToken(16);
    const token = generateToken();
    const tokenHash = hashValue(token);

    // Insert token
    await conn.execute(
      `INSERT INTO user_api_tokens (token_id, user_id, token_hash, name, scopes, created, last_used, last_update)
       VALUES (?, ?, ?, 'Development Token', '["*"]', NOW(), NULL, NOW())`,
      [tokenId, admin.user_id, tokenHash]
    );

    console.log('\n✅ API Token created successfully!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🔐 Your API Token:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log(`   ${token}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📝 Usage in Postman:\n');
    console.log('   Header: X-API-Token');
    console.log(`   Value:  ${token}\n`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📋 Example Request:\n');
    console.log('   GET http://127.0.0.1:3000/campaigns/4KS624HEW5PBFFSM/responses/export');
    console.log('       ?status=completed&format=json');
    console.log('       &includeQuestionText=true&includeAnswerText=true&language=cs\n');
    console.log('   Headers:');
    console.log(`     X-API-Token: ${token}\n`);
    console.log('⚠️  Save this token - it won\'t be shown again!\n');

  } catch (error) {
    console.error('❌ Error creating API token:', error.message);
    process.exit(1);
  } finally {
    await conn.end();
  }
}

createAdminAPIToken().catch(console.error);
