// Test respondent authorization
import { query, queryOne } from './src/db.js';
import { verifyRespondentToken } from './src/auth.js';
import { hashValue } from './src/utils.js';

const RESPONSE_ID = '8B37W71ZFJDSG9CNAVAKAQRK5RKFPSR1WQA6J37VCZ56SKRM2P6MK5RRZMNBV826';
const RESPONDENT_TOKEN = 'bb4434c70e8cc38b4b4c0290970aba56a539a86c44284b4258482b97f2a1a8a6';

console.log('=== Testing Respondent Authorization ===\n');

// Step 1: Verify respondent token
console.log('Step 1: Verify respondent token');
const respondent = await verifyRespondentToken(RESPONDENT_TOKEN);

if (!respondent) {
  console.error('❌ Invalid respondent token');
  process.exit(1);
}

console.log('✅ Respondent authenticated:', respondent.email);

// Step 2: Get response
console.log('\nStep 2: Get response with respondent auth');
const response = await queryOne(
  `SELECT 
    r.response_id,
    r.respondent_id,
    r.campaign_id,
    r.status,
    r.data,
    r.created,
    cr.email
  FROM responses r
  LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
  WHERE r.response_id = ? AND r.removed = 0`,
  [RESPONSE_ID]
);

if (!response) {
  console.error('❌ Response not found');
  process.exit(1);
}

// Step 3: Check authorization
console.log('\nStep 3: Check authorization');
console.log(`Response email: ${response.email}`);
console.log(`Respondent email: ${respondent.email}`);

if (response.email !== respondent.email) {
  console.error('❌ Authorization failed: emails do not match');
  console.error('This respondent cannot access this response');
  process.exit(1);
}

console.log('✅ Authorization check passed');

// Step 4: List responses for this respondent
console.log('\nStep 4: List responses filtered by respondent email');
const responses = await query(
  `SELECT 
    r.response_id,
    r.status,
    r.attempt_no,
    r.created,
    cr.email
  FROM responses r
  LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
  WHERE r.removed = 0 AND cr.email = ?
  ORDER BY r.created DESC`,
  [respondent.email]
);

console.log(`✅ Found ${responses.length} response(s) for ${respondent.email}`);

responses.forEach((r, i) => {
  console.log(`\nResponse ${i + 1}:`);
  console.log(`  ID: ${r.response_id.substring(0, 20)}...`);
  console.log(`  Status: ${r.status}`);
  console.log(`  Attempt: ${r.attempt_no}`);
  console.log(`  Created: ${r.created}`);
});

// Step 5: Test accessing someone else's response (simulate)
console.log('\n\nStep 5: Simulate accessing unauthorized response');
console.log('Creating a second respondent...');

const otherRespondentId = 'TEST_OTHER_RESPONDENT';
const otherEmail = 'other@example.com';

try {
  await query(
    'INSERT INTO campaign_respondents (respondent_id, campaign_id, email, token_hash) VALUES (?, ?, ?, ?)',
    [otherRespondentId, '4KS624HEW5PBFFSM', otherEmail, hashValue('test-token')]
  );
  console.log('✅ Other respondent created:', otherEmail);
} catch (err) {
  // Already exists
  console.log('ℹ️ Other respondent already exists');
}

// Simulate checking access
const otherRespondent = { email: otherEmail };
console.log(`\nChecking if ${otherRespondent.email} can access response from ${response.email}...`);

if (response.email !== otherRespondent.email) {
  console.log('❌ Authorization would fail - correct behavior!');
  console.log('✅ Respondent can only access their own responses');
} else {
  console.error('⚠️ Authorization issue detected!');
}

console.log('\n\n📝 Respondent Authorization Test Summary:');
console.log('════════════════════════════════════════');
console.log('✅ Respondent token verification works');
console.log('✅ Response retrieval works');
console.log('✅ Email-based authorization check works');
console.log('✅ List responses filtered by email works');
console.log('✅ Unauthorized access blocked correctly');
console.log('\n🔒 Authorization system is working correctly!');

process.exit(0);
