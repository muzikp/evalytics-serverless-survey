// Migration script to change email_template to JSON structure
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

    // Check current structure
    const [campaigns] = await connection.execute(
      'SELECT campaign_id, email_title, email_template FROM campaigns LIMIT 1'
    );

    if (campaigns.length > 0) {
      console.log('\n📋 Current structure:');
      console.log('  email_title:', campaigns[0].email_title ? 'exists' : 'null');
      console.log('  email_template:', campaigns[0].email_template ? typeof campaigns[0].email_template : 'null');
    }

    // Add new JSON column
    console.log('\n1. Adding email_template_json column...');
    try {
      await connection.execute(`
        ALTER TABLE campaigns 
        ADD COLUMN email_template_json JSON NULL COMMENT 'Email template with title and body' 
        AFTER email_template
      `);
      console.log('✓ Added email_template_json column');
    } catch (err) {
      if (err.code === 'ER_DUP_FIELDNAME') {
        console.log('✓ email_template_json column already exists');
      } else {
        throw err;
      }
    }

    // Migrate existing data
    console.log('\n2. Migrating existing data...');
    await connection.execute(`
      UPDATE campaigns 
      SET email_template_json = JSON_OBJECT(
        'title', COALESCE(email_title, ''),
        'body', COALESCE(email_template, '')
      )
      WHERE (email_template IS NOT NULL OR email_title IS NOT NULL)
        AND email_template_json IS NULL
    `);
    console.log('✓ Migrated existing data to JSON format');

    // Verify
    const [verify] = await connection.execute(
      'SELECT campaign_id, email_template_json FROM campaigns WHERE email_template_json IS NOT NULL LIMIT 1'
    );

    if (verify.length > 0) {
      console.log('\n📋 Migrated email_template_json:');
      console.log(JSON.stringify(verify[0].email_template_json, null, 2));
    }

    // Create sample data
    console.log('\n3. Creating sample email template...');
    const [firstCampaign] = await connection.execute('SELECT campaign_id FROM campaigns LIMIT 1');
    if (firstCampaign.length > 0) {
      await connection.execute(`
        UPDATE campaigns 
        SET email_template_json = JSON_OBJECT(
          'title', 'Survey Invitation - __campaign_name__',
          'body', '<div style="font-family: Arial, sans-serif; padding: 20px;">
  <p>Ahoj __salutation__,</p>
  <p>Rádi bychom Vás pozvali k účasti na průzkumu <strong>__campaign_name__</strong>.</p>
  <p>Vaše zpětná vazba je pro nás důležitá. Klikněte prosím na odkaz níže:</p>
  <p style="margin: 20px 0;"><a href="__link__" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 4px;">Zahájit průzkum</a></p>
  <p>Děkujeme za Váš čas!</p>
</div>'
        )
        WHERE campaign_id = ?
      `, [firstCampaign[0].campaign_id]);
      console.log('✓ Created sample email template with placeholders');
    } else {
      console.log('⚠ No campaigns found, skipping sample data');
    }

    console.log('\n✅ Migration completed successfully');
    console.log('\nNext steps:');
    console.log('1. Update API to use email_template_json');
    console.log('2. Update UI to parse/save JSON format');
    console.log('3. After verification, drop old columns: email_template, email_title');

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
