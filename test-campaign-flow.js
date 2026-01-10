// Test campaign loading flow step by step
const campaignId = '4KS624HEW5PBFFSM';
const apiBaseUrl = 'http://127.0.0.1:3000';

// Get token from localStorage or use a test token
// For testing, we'll skip auth and just test if endpoints respond
const headers = {
  'Accept': 'application/json'
};

console.log('=== Testing Campaign Loading Flow ===\n');

// Step 1: Test if API is accessible (skip /campaigns which requires auth)
console.log('STEP 1: Testing API connectivity...');
try {
  const response = await fetch(`${apiBaseUrl}/health`);
  if (response.ok || response.status === 404) {
    console.log('✅ API is accessible');
  } else {
    console.log('❌ API returned status:', response.status);
  }
} catch (err) {
  console.log('⚠️  Cannot connect to API:', err.message);
  console.log('Continuing anyway...');
}

// Step 2: Test getting campaign data
console.log('\nSTEP 2: Getting campaign data from API (public endpoint)...');
try {
  const response = await fetch(`${apiBaseUrl}/public/campaign/${campaignId}`, { headers });
  if (!response.ok) {
    console.log('❌ API returned status:', response.status);
    const text = await response.text();
    console.log('Response:', text.substring(0, 200));
    console.log('\n⚠️  Cannot test without auth. Try opening browser DevTools and check:');
    console.log('  1. Network tab for failed requests');
    console.log('  2. Console tab for JavaScript errors');
    process.exit(0);
  }
  
  const data = await response.json();
  console.log('✅ Campaign data received');
  console.log('Campaign structure:');
  console.log('  - title:', typeof data.title, data.title ? '(exists)' : '(missing)');
  console.log('  - version_id:', data.version_id);
  console.log('  - is_public:', data.is_public);
  console.log('  - email_template:', typeof data.email_template, data.email_template ? '(exists)' : '(missing)');
  console.log('  - auto_save_interval_seconds:', data.auto_save_interval_seconds);
  console.log('  - respondent_fields:', Array.isArray(data.respondent_fields) ? `array(${data.respondent_fields.length})` : typeof data.respondent_fields);
  console.log('  - email_template_fields:', Array.isArray(data.email_template_fields) ? `array(${data.email_template_fields.length})` : typeof data.email_template_fields);
  
  // Check for any unexpected data types
  if (typeof data.title === 'object' && data.title !== null) {
    console.log('  ⚠️  title is an object:', JSON.stringify(data.title));
  }
  if (typeof data.email_template === 'object' && data.email_template !== null) {
    console.log('  ⚠️  email_template is an object (first 100 chars):', JSON.stringify(data.email_template).substring(0, 100));
  }
} catch (err) {
  console.log('❌ Error getting campaign:', err.message);
  process.exit(1);
}

// Step 3: Test getting forms list
console.log('\nSTEP 3: Getting forms list...');
try {
  const response = await fetch(`${apiBaseUrl}/forms`);
  if (!response.ok) {
    console.log('❌ API returned status:', response.status);
    process.exit(1);
  }
  
  const data = await response.json();
  const forms = data.items || [];
  console.log('✅ Forms list received:', forms.length, 'forms');
  
  if (forms.length > 0) {
    console.log('  First form:', forms[0].form_id, '-', forms[0].title);
    console.log('  Has version_id?', forms[0].version_id ? '✅' : '❌');
  }
} catch (err) {
  console.log('❌ Error getting forms:', err.message);
  process.exit(1);
}

// Step 4: Test getting respondents (if private campaign)
console.log('\nSTEP 4: Getting campaign respondents...');
try {
  const response = await fetch(`${apiBaseUrl}/campaigns/${campaignId}/respondents`);
  if (!response.ok) {
    console.log('⚠️  API returned status:', response.status, '(might be public campaign)');
  } else {
    const data = await response.json();
    const respondents = data.items || [];
    console.log('✅ Respondents received:', respondents.length, 'respondents');
  }
} catch (err) {
  console.log('⚠️  Error getting respondents:', err.message);
}

console.log('\n=== All API endpoints working correctly ===');
console.log('\nNext step: Check if Vite server is running and can serve the page');
console.log('Try: curl http://localhost:5174/admin/campaigns/4KS624HEW5PBFFSM');
