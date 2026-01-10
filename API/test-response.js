import { query, queryOne } from './src/db.js';
import { generateId, formatDateTime } from './src/utils.js';

console.log('=== Creating test response ===');

const campaignId = '4KS624HEW5PBFFSM';
const respondentId = 'RKOMHS2IAU3J';
const versionId = 'MBZQTG7YEBNR552F';

// Generate sample response data
const responseData = {
  nps_score: 9,
  promoter_features: ['feature1', 'feature2'],
  passive_experience: 'Great experience overall!'
};

const responseId = generateId(64);
const now = formatDateTime(new Date());

await query(
  `INSERT INTO responses 
  (response_id, respondent_id, campaign_id, version_id, attempt_no, status, data, submitted_at, removed, created, last_update)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
  [
    responseId,
    respondentId,
    campaignId,
    versionId,
    1,
    'completed',
    JSON.stringify(responseData),
    now,
    now,
    now
  ]
);

console.log('✅ Response created with ID:', responseId);

// Read it back
const response = await queryOne(
  `SELECT r.*, cr.email, c.public_id 
   FROM responses r
   LEFT JOIN campaign_respondents cr ON r.respondent_id = cr.respondent_id
   LEFT JOIN campaigns c ON r.campaign_id = c.campaign_id
   WHERE r.response_id = ?`,
  [responseId]
);

console.log('\n✅ Response retrieved from DB:');
console.log(JSON.stringify({
  response_id: response.response_id,
  email: response.email,
  campaign_public_id: response.public_id,
  status: response.status,
  attempt_no: response.attempt_no,
  submitted_at: response.submitted_at,
  data: typeof response.data === 'string' ? JSON.parse(response.data) : response.data
}, null, 2));

process.exit(0);
