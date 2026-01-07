/**
 * INITIALIZE DATABASE SCHEMA
 * 
 * Účel: Vytvoří kompletní databázové schéma z 001_init.sql
 * Použití: node utils/sql/init-schema.js [--env dev|prod]
 * 
 * Načítá z .env:
 * - MYSQL_DEV_* nebo MYSQL_PROD_* - Databázové připojení
 * - DB_NAME / MYSQL_DEV_DATABASE - Název databáze
 * 
 * Spustí 001_init.sql s dynamickým názvem databáze
 */

import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { readFile } from 'fs/promises';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load .env from project root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');
dotenv.config({ path: join(projectRoot, '.env') });

// Parse command line argument for environment
const args = process.argv.slice(2);
const envArg = args.find(arg => arg.startsWith('--env='))?.split('=')[1] || 
               args.find(arg => ['dev', 'prod'].includes(arg)) || 
               'dev';

console.log(`\n🔧 Environment: ${envArg}`);

// Get database credentials from .env based on environment
const getDbConfig = (env) => {
  if (env === 'prod') {
    return {
      host: process.env.MYSQL_PROD_HOST,
      port: parseInt(process.env.MYSQL_PROD_PORT || '3306'),
      user: process.env.MYSQL_PROD_USER,
      password: process.env.MYSQL_PROD_PASSWORD,
      database: process.env.MYSQL_PROD_DATABASE,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      multipleStatements: true // Allow multiple SQL statements
    };
  } else {
    return {
      host: process.env.MYSQL_DEV_HOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_DEV_PORT || process.env.DB_PORT || '3306'),
      user: process.env.MYSQL_DEV_USER || process.env.DB_USER,
      password: process.env.MYSQL_DEV_PASSWORD || process.env.DB_PASSWORD,
      database: process.env.MYSQL_DEV_DATABASE || process.env.DB_NAME,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      multipleStatements: true // Allow multiple SQL statements
    };
  }
};

const dbConfig = getDbConfig(envArg);

console.log(`📊 Database: ${dbConfig.database} @ ${dbConfig.host}`);

if (envArg === 'prod') {
  console.log('\n⚠️  WARNING: You are about to initialize PRODUCTION database schema!');
  console.log('This will create tables. Existing data will NOT be deleted.');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  await new Promise(resolve => setTimeout(resolve, 5000));
}

// Read SQL file
const sqlFilePath = join(__dirname, '001_init.sql');
console.log(`📄 Reading SQL file: 001_init.sql`);
const sqlContent = await readFile(sqlFilePath, 'utf8');

// Remove comments and split by semicolons
const statements = sqlContent
  .split('\n')
  .filter(line => !line.trim().startsWith('--') && !line.trim().startsWith('/*') && !line.trim().startsWith('*'))
  .join('\n')
  .split(';')
  .map(stmt => stmt.trim())
  .filter(stmt => stmt.length > 0 && !stmt.startsWith('/**'));

console.log(`📝 Found ${statements.length} SQL statements to execute`);

// Connect to MySQL
const connection = await mysql.createConnection(dbConfig);
console.log('✓ Connected to MySQL');

// Execute statements one by one
let successCount = 0;
let skipCount = 0;

for (let i = 0; i < statements.length; i++) {
  const stmt = statements[i];
  
  // Extract table name from CREATE TABLE statement for better logging
  const tableMatch = stmt.match(/CREATE TABLE IF NOT EXISTS (\w+)/i);
  const tableName = tableMatch ? tableMatch[1] : `statement ${i + 1}`;
  
  try {
    await connection.execute(stmt);
    console.log(`  ✓ ${tableName}`);
    successCount++;
  } catch (error) {
    if (error.code === 'ER_TABLE_EXISTS_CLAUSE') {
      console.log(`  ⊙ ${tableName} (already exists)`);
      skipCount++;
    } else {
      console.error(`  ✗ ${tableName}: ${error.message}`);
      // Continue anyway (IF NOT EXISTS should handle most cases)
    }
  }
}

console.log(`\n✅ Schema initialization complete!`);
console.log(`   Created: ${successCount} tables`);
console.log(`   Skipped: ${skipCount} tables (already existed)`);
console.log(`   Database: ${dbConfig.database}`);

await connection.end();
