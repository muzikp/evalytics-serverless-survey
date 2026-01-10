import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..', '..');
dotenv.config({ path: join(projectRoot, '.env') });

const connection = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  charset: 'utf8mb4'
});

console.log('Connected to database\n');

// Get campaign data
const [rows] = await connection.execute(
  'SELECT campaign_id, email_template, respondent_fields FROM campaigns WHERE campaign_id = ?',
  ['4KS624HEW5PBFFSM']
);

if (rows.length > 0) {
  const campaign = rows[0];
  
  console.log('=== EMAIL TEMPLATE ===');
  const emailTemplate = typeof campaign.email_template === 'string' 
    ? JSON.parse(campaign.email_template) 
    : campaign.email_template;
  console.log('Body snippet:', emailTemplate.body.substring(0, 200));
  
  // Extract field IDs from email template
  const templateFieldIds = emailTemplate.body.match(/__field_ra_[^_]+_[^_]+__/g) || [];
  console.log('\nField IDs in email template:', templateFieldIds);
  
  console.log('\n=== RESPONDENT FIELDS ===');
  const respondentFields = typeof campaign.respondent_fields === 'string'
    ? JSON.parse(campaign.respondent_fields)
    : campaign.respondent_fields;
  
  console.log('Respondent fields:');
  respondentFields.forEach(field => {
    console.log(`  ${field.id} (label: ${field.label}, dataKey: ${field.dataKey})`);
  });
  
  console.log('\n=== MISMATCH CHECK ===');
  const fieldIds = respondentFields.map(f => `__${f.id}__`);
  templateFieldIds.forEach(tplId => {
    if (!fieldIds.includes(tplId)) {
      console.log(`❌ ${tplId} is in template but not in respondent_fields`);
    } else {
      console.log(`✅ ${tplId} matches`);
    }
  });
}

await connection.end();
