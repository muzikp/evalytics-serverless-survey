// Run migration 010: Email sending features
import mysql from 'mysql2/promise';
import fs from 'fs/promises';

const config = {
  host: 'localhost',
  port: 3306,
  user: 'vcagent',
  password: 'HUIEwhmeAk9I7k7b_Wg8T',
  database: 'evalytics_survey',
  multipleStatements: true
};

async function runMigration() {
  console.log('📊 Running migration 010: Email sending features...\n');
  
  const connection = await mysql.createConnection(config);
  
  try {
    // Read migration file
    const sql = await fs.readFile('utils/sql/010_email_sending.sql', 'utf8');
    
    // Execute migration
    const [results] = await connection.query(sql);
    
    console.log('✅ Migration completed successfully\n');
    
    // Display verification results (last result set)
    const verificationResults = Array.isArray(results) ? results[results.length - 1] : results;
    
    if (Array.isArray(verificationResults) && verificationResults.length > 0) {
      console.log('📋 Verification:');
      console.table(verificationResults);
    }
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

runMigration();
