// Migration script to convert respondent fields from name-based to id-based structure
// Old: {name: "salutation", label: "Salutation", type: "dictionary"}
// New: {id: "field_ra_123", label: "Salutation", type: "dictionary"}
// Data keys stay the same for backward compatibility

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

    const [campaigns] = await connection.execute(
      'SELECT campaign_id, respondent_fields FROM campaigns WHERE respondent_fields IS NOT NULL'
    );

    console.log(`\n📋 Found ${campaigns.length} campaigns with respondent_fields`);

    let migrated = 0;
    for (const campaign of campaigns) {
      try {
        const fields = campaign.respondent_fields;
        
        // Check if already has new format (has 'id' instead of 'name')
        if (fields && fields.length > 0 && fields[0].id && !fields[0].name) {
          console.log(`⏭️  Campaign ${campaign.campaign_id}: Already in new format`);
          continue;
        }

        // Check if has old format with 'name'
        if (!fields || fields.length === 0 || !fields[0].name) {
          console.log(`⏭️  Campaign ${campaign.campaign_id}: No name field found`);
          continue;
        }

        // Convert name to id, keep same value for data compatibility
        const newFields = fields.map(field => {
          const { name, ...rest } = field;
          
          // For default fields (email, token), use name as id
          if (name === 'email' || name === 'token') {
            return {
              id: name,
              ...rest
            };
          }
          
          // For custom fields, generate field_ra_ id but store original name in a new property
          return {
            id: `field_ra_${Date.now()}_${Math.random().toString(36).substring(7)}`,
            dataKey: name,  // Keep original name for data access
            ...rest
          };
        });

        await connection.execute(
          'UPDATE campaigns SET respondent_fields = ? WHERE campaign_id = ?',
          [JSON.stringify(newFields), campaign.campaign_id]
        );

        console.log(`✓ Migrated campaign ${campaign.campaign_id}:`);
        fields.forEach((field, i) => {
          if (field.name && field.name !== 'email' && field.name !== 'token') {
            console.log(`  ${field.name} → ${newFields[i].id} (dataKey: ${newFields[i].dataKey})`);
          }
        });
        migrated++;
      } catch (err) {
        console.error(`❌ Failed to migrate campaign ${campaign.campaign_id}:`, err.message);
      }
    }

    console.log(`\n✅ Migration completed: ${migrated} campaign(s) updated`);

    // Verify
    if (campaigns.length > 0) {
      const [verify] = await connection.execute(
        'SELECT campaign_id, respondent_fields FROM campaigns WHERE respondent_fields IS NOT NULL LIMIT 1'
      );
      
      if (verify.length > 0) {
        console.log('\n📋 Sample migrated fields:');
        console.log(JSON.stringify(verify[0].respondent_fields, null, 2));
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
