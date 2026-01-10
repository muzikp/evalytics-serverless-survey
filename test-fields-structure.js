// Test script to verify email_template_fields structure and respondent dictionary values
const mysql = require('mysql2/promise');

async function test() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'vcagent',
    password: 'HUIEwhmeAk9I7k7b_Wg8T',
    database: 'evalytics_survey'
  });

  try {
    console.log('✓ Connected to database\n');

    // Check email_template_fields structure
    console.log('📋 Email Template Fields:');
    const [campaigns] = await connection.execute(
      'SELECT campaign_id, email_template_fields FROM campaigns WHERE email_template_fields IS NOT NULL LIMIT 1'
    );

    if (campaigns.length > 0) {
      console.log('Campaign:', campaigns[0].campaign_id);
      console.log('Fields:', JSON.stringify(campaigns[0].email_template_fields, null, 2));
      
      // Verify structure
      const fields = campaigns[0].email_template_fields;
      if (fields && fields.length > 0) {
        const firstField = fields[0];
        console.log('\n✓ Structure check:');
        console.log('  - Has id:', !!firstField.id);
        console.log('  - Has name:', !!firstField.name);
        console.log('  - Has type:', !!firstField.type);
        console.log('  - Has value:', !!firstField.value);
        console.log('  - Value is object:', typeof firstField.value === 'object');
        if (firstField.value) {
          console.log('  - Value has cs:', !!firstField.value.cs);
          console.log('  - Value has en:', !!firstField.value.en);
          console.log('  - Value has de:', !!firstField.value.de);
        }
      }
    } else {
      console.log('⚠ No campaigns with email_template_fields');
    }

    // Check respondent dictionary fields
    console.log('\n📋 Respondent Fields:');
    const [campaignsWithRespondents] = await connection.execute(
      'SELECT campaign_id, respondent_fields FROM campaigns WHERE respondent_fields IS NOT NULL LIMIT 1'
    );

    if (campaignsWithRespondents.length > 0) {
      console.log('Campaign:', campaignsWithRespondents[0].campaign_id);
      const fields = campaignsWithRespondents[0].respondent_fields;
      console.log('Respondent fields:', JSON.stringify(fields, null, 2));
      
      // Check for dictionary type
      const dictFields = fields.filter(f => f.type === 'dictionary');
      console.log(`\n✓ Found ${dictFields.length} dictionary field(s)`);
      
      // Check respondent data
      const [respondents] = await connection.execute(
        'SELECT email, data FROM campaign_respondents WHERE campaign_id = ? LIMIT 1',
        [campaignsWithRespondents[0].campaign_id]
      );
      
      if (respondents.length > 0) {
        console.log('\n📋 Sample Respondent Data:');
        console.log('Email:', respondents[0].email);
        console.log('Data:', JSON.stringify(respondents[0].data, null, 2));
        
        // Check if dictionary fields have proper values
        dictFields.forEach(field => {
          const value = respondents[0].data[field.name];
          console.log(`\n✓ Dictionary field "${field.name}":`, typeof value, value);
        });
      }
    }

    console.log('\n✅ Test completed');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

test().catch(err => {
  console.error(err);
  process.exit(1);
});
