// Test API calls for responses
const API_BASE = 'http://localhost:3000';
const RESPONSE_ID = '8B37W71ZFJDSG9CNAVAKAQRK5RKFPSR1WQA6J37VCZ56SKRM2P6MK5RRZMNBV826';

// You need to get JWT token first - replace this with actual token from /auth endpoint
const JWT_TOKEN = 'YOUR_JWT_TOKEN_HERE';

async function testGetResponse() {
  console.log('\n=== Testing GET /responses/:id ===');
  
  try {
    const response = await fetch(`${API_BASE}/responses/${RESPONSE_ID}`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

async function testListResponses() {
  console.log('\n=== Testing GET /responses (list) ===');
  
  try {
    const response = await fetch(`${API_BASE}/responses?campaign_id=4KS624HEW5PBFFSM`, {
      headers: {
        'Authorization': `Bearer ${JWT_TOKEN}`
      }
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Count:', data.count);
    console.log('Items:', data.items?.length);
    if (data.items?.length > 0) {
      console.log('First response:', JSON.stringify(data.items[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  }
}

console.log('To test the API, you need to:');
console.log('1. Start SAM local API: npm run sam:local');
console.log('2. Get JWT token by calling POST /auth with admin credentials');
console.log('3. Replace JWT_TOKEN in this script');
console.log('4. Run: node test-api-calls.js');
console.log('\nResponse ID to test:', RESPONSE_ID);
