/**
 * CREATE ADMIN USER
 * 
 * Účel: Vytvoří prvního admin uživatele z .env credentials
 * Použití: node utils/sql/create-admin.js [--env dev|prod]
 * 
 * Credentials z .env:
 * - ADMIN_EMAIL - Email pro přihlášení
 * - ADMIN_PASSWORD - Heslo (bude zahashováno pomocí bcrypt)
 * - MYSQL_DEV_* nebo MYSQL_PROD_* - Databázové připojení
 * 
 * === ADMIN TABLE STRUCTURE ===
 * Tabulka: users
 * Pole:
 * - user_id: Unique ID (např. 'ADMIN001')
 * - firstname: Křestní jméno (z ADMIN_EMAIL prefix)
 * - lastname: Příjmení (z ADMIN_EMAIL prefix)
 * - email: Email pro přihlášení (z ADMIN_EMAIL)
 * - password_hash: Bcrypt hash hesla (10 rounds)
 * - roles: JSON object s rolemi {"master-admin": 1, "admin": 1}
 * - created: Timestamp vytvoření
 * - last_update: Timestamp poslední změny
 * 
 * === ROLES EXPLANATION ===
 * "master-admin": 1 - Plný přístup (správa adminů, systémové nastavení)
 * "admin": 1 - Standardní admin (správa formulářů, kampaní, respondentů)
 * "viewer": 1 - Jen čtení (prohlížení výsledků, bez editace)
 * 
 * === DEPENDENCIES ===
 * VAZBA: forms.created_by → users.user_id
 * VAZBA: campaigns.created_by → users.user_id
 * VAZBA: API authentication controller ověřuje email + password_hash
 */

import mysql from 'mysql2/promise';
import bcrypt from 'bcrypt';
import dotenv from 'dotenv';
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
      collation: 'utf8mb4_unicode_ci'
    };
  } else {
    return {
      host: process.env.MYSQL_DEV_HOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_DEV_PORT || process.env.DB_PORT || '3306'),
      user: process.env.MYSQL_DEV_USER || process.env.DB_USER,
      password: process.env.MYSQL_DEV_PASSWORD || process.env.DB_PASSWORD,
      database: process.env.MYSQL_DEV_DATABASE || process.env.DB_NAME,
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci'
    };
  }
};

// Get admin credentials from .env
const adminEmail = process.env.ADMIN_EMAIL;
const adminPassword = process.env.ADMIN_PASSWORD;

if (!adminEmail || !adminPassword) {
  console.error('❌ ERROR: ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env file');
  process.exit(1);
}

// Extract firstname/lastname from email (simple heuristic)
// Example: muzikp@gmail.com → firstname: Pavel, lastname: Muzik
const extractNameFromEmail = (email) => {
  const localPart = email.split('@')[0];
  // Try to parse common patterns: firstname.lastname, firstnamelastname, etc.
  // For now, simple default
  return {
    firstname: process.env.ADMIN_FIRSTNAME || 'Admin',
    lastname: process.env.ADMIN_LASTNAME || 'User'
  };
};

const { firstname, lastname } = extractNameFromEmail(adminEmail);

const dbConfig = getDbConfig(envArg);

console.log(`📊 Database: ${dbConfig.database} @ ${dbConfig.host}`);
console.log(`👤 Admin: ${adminEmail}`);

if (envArg === 'prod') {
  console.log('\n⚠️  WARNING: You are about to create admin on PRODUCTION database!');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  await new Promise(resolve => setTimeout(resolve, 5000));
}

// Connect to MySQL
const connection = await mysql.createConnection(dbConfig);
console.log('✓ Connected to MySQL');

// Hash password with bcrypt (10 rounds)
console.log('🔐 Hashing password...');
const passwordHash = await bcrypt.hash(adminPassword, 10);

// Check if admin already exists
const [existingUsers] = await connection.execute(
  'SELECT user_id, email FROM users WHERE email = ?',
  [adminEmail]
);

if (existingUsers.length > 0) {
  console.log(`\n⚠️  Admin user already exists: ${existingUsers[0].user_id} (${existingUsers[0].email})`);
  console.log('Do you want to update the password? (yes/no)');
  
  // In non-interactive mode, skip update
  console.log('Skipping update (non-interactive mode)');
  await connection.end();
  process.exit(0);
}

// Insert admin user
await connection.execute(
  `INSERT INTO users (user_id, firstname, lastname, email, password_hash, roles, created, last_update)
   VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [
    'ADMIN001', // Admin ID (referenced by forms, campaigns)
    firstname,
    lastname,
    adminEmail,
    passwordHash, // bcrypt hash
    JSON.stringify({ "master-admin": 1, "admin": 1 }) // Plné oprávnění
  ]
);

console.log(`\n✅ Admin user created successfully!`);
console.log(`   User ID: ADMIN001`);
console.log(`   Email: ${adminEmail}`);
console.log(`   Roles: master-admin, admin`);
console.log(`\n⚠️  IMPORTANT: Change the password after first login on production!`);

await connection.end();
