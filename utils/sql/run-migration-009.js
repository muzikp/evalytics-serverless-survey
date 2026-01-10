const mysql = require('mysql2/promise');

async function runMigration() {
  const conn = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'vcagent',
    password: 'HUIEwhmeAk9I7k7b_Wg8T',
    database: 'evalytics_survey'
  });

  try {
    console.log('🔄 Running migration 009 - Add auto_save_interval_seconds...');
    
    await conn.execute(`
      ALTER TABLE campaigns
      ADD COLUMN auto_save_interval_seconds INT NULL DEFAULT 10
      COMMENT 'Interval průběžného ukládání v sekundách (NULL = vypnuto, default 10)'
      AFTER max_attempts
    `);
    
    console.log('✅ Migration completed successfully');
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log('⚠️  Column already exists, skipping...');
    } else {
      console.error('❌ Migration failed:', error.message);
      throw error;
    }
  } finally {
    await conn.end();
  }
}

runMigration().catch(console.error);
