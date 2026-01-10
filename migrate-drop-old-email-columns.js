// Migration script to drop old email_template and email_title columns
// and rename email_template_json to email_template

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

    // Verify current state
    console.log('\n📋 Current column state:');
    const [campaigns] = await connection.execute(
      `SELECT 
        campaign_id,
        CASE WHEN email_template IS NOT NULL THEN 'has_data' ELSE 'null' END as email_template_status,
        CASE WHEN email_template_json IS NOT NULL THEN 'has_data' ELSE 'null' END as email_template_json_status,
        CASE WHEN email_title IS NOT NULL THEN 'has_data' ELSE 'null' END as email_title_status
      FROM campaigns
      LIMIT 3`
    );

    campaigns.forEach(c => {
      console.log(`  Campaign ${c.campaign_id}:`);
      console.log(`    email_template: ${c.email_template_status}`);
      console.log(`    email_template_json: ${c.email_template_json_status}`);
      console.log(`    email_title: ${c.email_title_status}`);
    });

    // Check if data is in new column
    const [check] = await connection.execute(
      'SELECT COUNT(*) as count FROM campaigns WHERE email_template_json IS NOT NULL'
    );
    console.log(`\n✓ ${check[0].count} campaign(s) have email_template_json`);

    // Drop old columns
    console.log('\n1. Dropping email_template column...');
    try {
      await connection.execute('ALTER TABLE campaigns DROP COLUMN email_template');
      console.log('✓ Dropped email_template');
    } catch (err) {
      if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('⚠ email_template already dropped');
      } else {
        throw err;
      }
    }

    console.log('\n2. Dropping email_title column...');
    try {
      await connection.execute('ALTER TABLE campaigns DROP COLUMN email_title');
      console.log('✓ Dropped email_title');
    } catch (err) {
      if (err.code === 'ER_CANT_DROP_FIELD_OR_KEY') {
        console.log('⚠ email_title already dropped');
      } else {
        throw err;
      }
    }

    // Rename email_template_json to email_template
    console.log('\n3. Renaming email_template_json to email_template...');
    try {
      await connection.execute(
        `ALTER TABLE campaigns 
         CHANGE COLUMN email_template_json email_template JSON NULL 
         COMMENT 'Email template with title and body as JSON'`
      );
      console.log('✓ Renamed email_template_json to email_template');
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR') {
        console.log('⚠ Column already renamed');
      } else {
        throw err;
      }
    }

    // Verify final state
    console.log('\n📋 Final state:');
    const [final] = await connection.execute(
      'SELECT campaign_id, email_template FROM campaigns LIMIT 1'
    );
    
    if (final.length > 0) {
      console.log('✓ email_template column exists and contains JSON:');
      console.log(JSON.stringify(final[0].email_template, null, 2));
    }

    console.log('\n✅ Migration completed successfully');

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
