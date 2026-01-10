// Migration script to add email_title and respondent_fields columns
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

    // Check if columns exist
    const [columns] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = 'evalytics_survey' 
        AND TABLE_NAME = 'campaigns' 
        AND COLUMN_NAME IN ('email_title', 'respondent_fields')
    `);

    const existingColumns = columns.map(c => c.COLUMN_NAME);
    console.log('Existing columns:', existingColumns);

    // Add email_title if it doesn't exist
    if (!existingColumns.includes('email_title')) {
      console.log('Adding email_title column...');
      await connection.execute(`
        ALTER TABLE campaigns 
        ADD COLUMN email_title TEXT NULL COMMENT 'Email subject line with placeholders' 
        AFTER email_template_fields
      `);
      console.log('✓ Added email_title column');
    } else {
      console.log('✓ email_title column already exists');
    }

    // Add respondent_fields if it doesn't exist
    if (!existingColumns.includes('respondent_fields')) {
      console.log('Adding respondent_fields column...');
      await connection.execute(`
        ALTER TABLE campaigns 
        ADD COLUMN respondent_fields JSON NULL COMMENT 'Configuration of respondent table fields' 
        AFTER email_title
      `);
      console.log('✓ Added respondent_fields column');
    } else {
      console.log('✓ respondent_fields column already exists');
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
