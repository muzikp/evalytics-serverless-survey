#!/usr/bin/env node
/**
 * Run migration: Add token column to campaign_respondents
 */
import mysql from 'mysql2/promise';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root
dotenv.config({ path: join(__dirname, '../../.env') });

async function main() {
  // Connect to MySQL
  const connection = await mysql.createConnection({
    host: process.env.MYSQL_DEV_HOST || process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.MYSQL_DEV_PORT || process.env.DB_PORT || '3306'),
    user: process.env.MYSQL_DEV_USER || process.env.DB_USER || 'vcagent',
    password: process.env.MYSQL_DEV_PASSWORD || process.env.DB_PASSWORD || '',
    database: process.env.MYSQL_DEV_DATABASE || process.env.DB_NAME || 'evalytics_survey',
    charset: 'utf8mb4'
  });

  try {
    console.log('Connected to MySQL');

    // Check if column exists
    const [rows] = await connection.execute(`
      SELECT COUNT(*) as count FROM information_schema.COLUMNS 
      WHERE TABLE_SCHEMA = ? 
      AND TABLE_NAME = 'campaign_respondents' 
      AND COLUMN_NAME = 'token'
    `, [process.env.MYSQL_DEV_DATABASE || process.env.DB_NAME || 'evalytics_survey']);

    if (rows[0].count > 0) {
      console.log('✓ Column "token" already exists');
      return;
    }

    // Read migration SQL
    const sql = fs.readFileSync(join(__dirname, '002_add_token_column.sql'), 'utf8');
    
    // Execute migration
    console.log('Running migration: 002_add_token_column.sql');
    const statements = sql.split(';').filter(s => s.trim() && !s.trim().startsWith('--'));
    
    for (const statement of statements) {
      if (statement.trim()) {
        await connection.execute(statement);
      }
    }

    console.log('✓ Migration completed successfully');

  } finally {
    await connection.end();
  }
}

main().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
