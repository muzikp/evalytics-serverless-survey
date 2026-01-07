#!/usr/bin/env node
/**
 * Initialize production database with schema and admin user
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcrypt');

async function initDatabase() {
  const dbName = process.env.MYSQL_PROD_DATABASE;
  
  // First connect without database to create it
  const configNoDB = {
    host: process.env.MYSQL_PROD_HOST,
    port: parseInt(process.env.MYSQL_PROD_PORT || '3306'),
    user: process.env.MYSQL_PROD_USER,
    password: process.env.MYSQL_PROD_PASSWORD,
    multipleStatements: true
  };

  console.log('Connecting to MySQL:', {
    host: configNoDB.host,
    user: configNoDB.user
  });

  let connection = await mysql.createConnection(configNoDB);
  
  // Create database if not exists
  console.log(`Creating database ${dbName}...`);
  await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  console.log('✓ Database created/exists');
  
  await connection.end();
  
  // Now connect to the database
  const config = {
    ...configNoDB,
    database: dbName
  };
  
  connection = await mysql.createConnection(config);
  
  try {
    // Load and execute init SQL
    const initSQL = fs.readFileSync(
      path.join(__dirname, '../sql/001_init.sql'),
      'utf8'
    );
    
    console.log('Executing init SQL...');
    await connection.query(initSQL);
    console.log('✓ Tables created');

    // Create admin user
    const passwordHash = await bcrypt.hash('Profesor764', 10);
    
    const insertUserSQL = `
      INSERT INTO users (
        user_id, 
        firstname, 
        lastname, 
        email, 
        password_hash, 
        roles, 
        created, 
        last_update
      ) VALUES (
        'ADMIN001',
        'Pavel',
        'Muzik',
        'muzikp@gmail.com',
        ?,
        '{"master-admin": 1}',
        NOW(),
        NOW()
      )
      ON DUPLICATE KEY UPDATE
        password_hash = VALUES(password_hash),
        last_update = NOW()
    `;
    
    await connection.query(insertUserSQL, [passwordHash]);
    console.log('✓ Admin user created/updated: muzikp@gmail.com');
    
    console.log('\n✅ Database initialization complete!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

initDatabase().catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
