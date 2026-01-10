// Test script to verify dictionary field saving
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
    console.log('✓ Connected to database');

    // 1. Get existing campaign
    const [campaigns] = await connection.execute(
      'SELECT campaign_id, title, respondent_fields FROM campaigns LIMIT 1'
    );

    if (campaigns.length === 0) {
      console.log('❌ No campaigns found');
      return;
    }

    const campaign = campaigns[0];
    console.log('\n📋 Current campaign:');
    console.log('  ID:', campaign.campaign_id);
    console.log('  Title:', campaign.title);
    console.log('  Respondent fields:', campaign.respondent_fields);

    // 2. Parse and modify respondent_fields
    let fields = [];
    if (campaign.respondent_fields) {
      try {
        // MySQL returns JSON as object, not string
        fields = typeof campaign.respondent_fields === 'string' 
          ? JSON.parse(campaign.respondent_fields)
          : campaign.respondent_fields;
        console.log('\n✓ Parsed fields:', JSON.stringify(fields, null, 2));
      } catch (e) {
        console.log('❌ Failed to parse respondent_fields:', e.message);
      }
    }

    // 3. Add or update salutation field to dictionary type
    const salutationIndex = fields.findIndex(f => f.name === 'salutation');
    const newField = {
      name: 'salutation',
      label: 'Salutation',
      type: 'dictionary',
      required: false,
      readonly: false
    };

    if (salutationIndex >= 0) {
      fields[salutationIndex] = newField;
      console.log('\n✓ Updated salutation field to dictionary');
    } else {
      fields.push(newField);
      console.log('\n✓ Added salutation field as dictionary');
    }

    // 4. Save back to database
    const fieldsJson = JSON.stringify(fields);
    await connection.execute(
      'UPDATE campaigns SET respondent_fields = ?, last_update = NOW() WHERE campaign_id = ?',
      [fieldsJson, campaign.campaign_id]
    );
    console.log('✓ Saved to database');

    // 5. Verify it was saved
    const [updated] = await connection.execute(
      'SELECT respondent_fields FROM campaigns WHERE campaign_id = ?',
      [campaign.campaign_id]
    );
    
    console.log('\n📋 Updated respondent_fields from DB:');
    const parsed = typeof updated[0].respondent_fields === 'string'
      ? JSON.parse(updated[0].respondent_fields)
      : updated[0].respondent_fields;
    console.log(JSON.stringify(parsed, null, 2));

    const verifyFields = parsed;
    const salutation = verifyFields.find(f => f.name === 'salutation');
    
    if (salutation && salutation.type === 'dictionary') {
      console.log('\n✅ SUCCESS: Salutation field is dictionary type');
      console.log('Field config:', JSON.stringify(salutation, null, 2));
    } else {
      console.log('\n❌ FAILED: Salutation field not saved correctly');
    }

    // 6. Test with respondent data
    const [respondents] = await connection.execute(
      'SELECT respondent_id, email, data FROM campaign_respondents WHERE campaign_id = ? LIMIT 1',
      [campaign.campaign_id]
    );

    if (respondents.length > 0) {
      const respondent = respondents[0];
      console.log('\n📋 Sample respondent:');
      console.log('  Email:', respondent.email);
      console.log('  Data:', respondent.data);

      // Parse and add salutation
      let data = typeof respondent.data === 'string' 
        ? JSON.parse(respondent.data || '{}')
        : respondent.data || {};
      data.salutation = {
        cs: 'Pavle',
        en: 'Pavel',
        de: 'Pavel'
      };

      await connection.execute(
        'UPDATE campaign_respondents SET data = ?, last_update = NOW() WHERE respondent_id = ?',
        [JSON.stringify(data), respondent.respondent_id]
      );
      console.log('✓ Added dictionary salutation to respondent');

      // Verify
      const [verifyResp] = await connection.execute(
        'SELECT data FROM campaign_respondents WHERE respondent_id = ?',
        [respondent.respondent_id]
      );
      const respData = typeof verifyResp[0].data === 'string'
        ? JSON.parse(verifyResp[0].data)
        : verifyResp[0].data;
      console.log('\n📋 Updated respondent data:');
      console.log(JSON.stringify(respData, null, 2));
      
      if (respData.salutation && respData.salutation.cs === 'Pavle') {
        console.log('\n✅ SUCCESS: Dictionary salutation saved correctly!');
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await connection.end();
  }
}

test();
