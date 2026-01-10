// Migration script to update field IDs with proper prefixes
// Old: field_1234567890
// New: field_em_1234567890 (email template fields)

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
      'SELECT campaign_id, email_template_fields, email_template FROM campaigns WHERE email_template_fields IS NOT NULL'
    );

    console.log(`\n📋 Found ${campaigns.length} campaigns with email_template_fields`);

    let migrated = 0;
    for (const campaign of campaigns) {
      try {
        const fields = campaign.email_template_fields;
        const template = campaign.email_template;
        
        // Check if already has new format (field_em_)
        if (fields && fields.length > 0 && fields[0].id && fields[0].id.startsWith('field_em_')) {
          console.log(`⏭️  Campaign ${campaign.campaign_id}: Already in new format`);
          continue;
        }

        // Map old IDs to new IDs
        const idMapping = {};
        const newFields = fields.map(field => {
          if (field.id && !field.id.startsWith('field_em_')) {
            // Extract timestamp from old ID
            const timestamp = field.id.replace('field_', '');
            const newId = `field_em_${timestamp}`;
            idMapping[field.id] = newId;
            
            return {
              ...field,
              id: newId
            };
          }
          return field;
        });

        // Update placeholders in email template body
        let updatedTemplate = template;
        if (template && template.body) {
          let updatedBody = template.body;
          Object.entries(idMapping).forEach(([oldId, newId]) => {
            const oldPlaceholder = `__${oldId}__`;
            const newPlaceholder = `__${newId}__`;
            updatedBody = updatedBody.replace(new RegExp(oldPlaceholder, 'g'), newPlaceholder);
          });
          updatedTemplate = { ...template, body: updatedBody };
        }

        // Update title if needed
        if (template && template.title) {
          let updatedTitle = template.title;
          Object.entries(idMapping).forEach(([oldId, newId]) => {
            const oldPlaceholder = `__${oldId}__`;
            const newPlaceholder = `__${newId}__`;
            updatedTitle = updatedTitle.replace(new RegExp(oldPlaceholder, 'g'), newPlaceholder);
          });
          updatedTemplate = { ...updatedTemplate, title: updatedTitle };
        }

        // Update campaign
        await connection.execute(
          'UPDATE campaigns SET email_template_fields = ?, email_template = ? WHERE campaign_id = ?',
          [JSON.stringify(newFields), JSON.stringify(updatedTemplate), campaign.campaign_id]
        );

        console.log(`✓ Migrated campaign ${campaign.campaign_id}:`);
        Object.entries(idMapping).forEach(([oldId, newId]) => {
          console.log(`  ${oldId} → ${newId}`);
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
        'SELECT campaign_id, email_template_fields, email_template FROM campaigns WHERE email_template_fields IS NOT NULL LIMIT 1'
      );
      
      if (verify.length > 0) {
        console.log('\n📋 Sample migrated data:');
        console.log('Field:', JSON.stringify(verify[0].email_template_fields[0], null, 2));
        console.log('\nTemplate body preview:', verify[0].email_template.body.substring(0, 150) + '...');
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
