// Migration script to update email_template_fields structure
// Old: [{id, name, cs, en, de}]
// New: [{id, name, type: "dictionary", value: {cs, en, de}}]

const mysql = require('mysql2/promise');

async function migrate() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'vcagent',
    password: 'HUIEwhmeAk9I7k7b_Wg8T',
    database: 'evalytics_survey'
  });

  try {
    console.log('✓ Connected to database');

    // Get all campaigns with email_template_fields
    const [campaigns] = await connection.execute(
      'SELECT campaign_id, email_template_fields FROM campaigns WHERE email_template_fields IS NOT NULL'
    );

    console.log(`\n📋 Found ${campaigns.length} campaigns with email_template_fields`);

    let migrated = 0;
    for (const campaign of campaigns) {
      try {
        const fields = campaign.email_template_fields;
        
        // Check if already new format (has 'value' property)
        if (fields && fields.length > 0 && fields[0].value) {
          console.log(`⏭️  Campaign ${campaign.campaign_id}: Already in new format`);
          continue;
        }

        // Transform old format to new format
        const newFields = fields.map(field => ({
          id: field.id,
          name: field.name,
          type: 'dictionary',
          value: {
            cs: field.cs || '',
            en: field.en || '',
            de: field.de || ''
          }
        }));

        // Update campaign
        await connection.execute(
          'UPDATE campaigns SET email_template_fields = ? WHERE campaign_id = ?',
          [JSON.stringify(newFields), campaign.campaign_id]
        );

        console.log(`✓ Migrated campaign ${campaign.campaign_id}: ${fields.length} field(s)`);
        migrated++;
      } catch (err) {
        console.error(`❌ Failed to migrate campaign ${campaign.campaign_id}:`, err.message);
      }
    }

    console.log(`\n✅ Migration completed: ${migrated} campaign(s) updated`);

    // Verify one campaign
    if (campaigns.length > 0) {
      const [verify] = await connection.execute(
        'SELECT campaign_id, email_template_fields FROM campaigns WHERE email_template_fields IS NOT NULL LIMIT 1'
      );
      
      if (verify.length > 0) {
        console.log('\n📋 Sample migrated field:');
        console.log(JSON.stringify(verify[0].email_template_fields[0], null, 2));
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

migrate().catch(err => {
  console.error(err);
  process.exit(1);
});
