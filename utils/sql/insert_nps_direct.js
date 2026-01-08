/**
 * EVALYTICS - DATABASE INITIALIZATION SCRIPT
 * 
 * Účel: Inicializuje databázi s výchozím NPS dotazníkem a ukázkovými daty
 * Použití: node utils/sql/insert_nps_direct.js [--env dev|prod]
 * 
 * DŮLEŽITÉ: Tento skript používá JSON.stringify() pro správné UTF-8 kódování.
 * NIKDY nepoužívej SQL escape sekvence (\u003c) - MySQL je uloží doslově a zničí češtinu!
 * 
 * Načítá z .env:
 * - MYSQL_DEV_* nebo MYSQL_PROD_* - Databázové připojení
 * - ADMIN_EMAIL - Email pro sample respondent a created_by
 * 
 * === STRUCTURE OVERVIEW ===
 * 1. NPS Survey JSON (SurveyJS format) - multilanguage EN/CS/DE
 * 2. MySQL Connection with UTF-8 charset/collation (z .env)
 * 3. Data Cleanup (DELETE old data)
 * 4. Form Insert (form_id: 549HHXFZ38V6ZX8D)
 * 5. Form Version Insert (version_id: MBZQTG7YEBNR552F, data: JSON.stringify(npsJson))
 * 6. Campaign Insert (campaign_id: 4KS624HEW5PBFFSM, public_id: nps-survey-2026)
 * 7. Sample Respondent (email_hash + token_hash + custom attributes)
 * 
 * === DATABASE DEPENDENCIES ===
 * Tabulky (musí existovat - viz 001_init.sql):
 * - forms (form_id, name, created_by, last_modified_by, created, last_update)
 * - form_versions (version_id, form_id, version, version_description, surveyjs_version, languages, data, ...)
 * - campaigns (campaign_id, public_id, title, description, version_id, open_on, close_on, is_public, ...)
 * - campaign_respondents (respondent_id, campaign_id, email, email_hash, token_hash, data, created, last_update)
 * 
 * === KEY VARIABLES ===
 * form_id: '549HHXFZ38V6ZX8D' - Random 16-char ID (crypto.randomBytes)
 * version_id: 'MBZQTG7YEBNR552F' - Random 16-char ID (crypto.randomBytes)
 * campaign_id: '4KS624HEW5PBFFSM' - Random 16-char ID (crypto.randomBytes)
 * public_id: 'nps-survey-2026' - Human-readable URL slug
 * 
 * === SECURITY & HASHING ===
 * email_hash: SHA256(email.toLowerCase()) - Pro deduplication, privacy
 * token_hash: SHA256(random_token) - Pro secure survey URLs
 * Token není uložen (jen hash) - bude regenerován při pozvání
 * 
 * === CUSTOM ATTRIBUTES ===
 * campaign_respondents.data JSON může obsahovat:
 * - age: number (věk respondenta)
 * - gender: string ('male', 'female', 'other')
 * - salutation: string ('Mr.', 'Ms.', 'Dr.', ...)
 * - department: string (oddělení firmy)
 * - location: string (pobočka/město)
 * - ...libovolné další atributy pro personalizaci průzkumu
 */

// Direct insert using mysql2 - same as API uses
import mysql from 'mysql2/promise';
import crypto from 'crypto';
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

// === NPS SURVEY JSON (SurveyJS format) ===
// Multilanguage: EN (default), CS (Czech), DE (German)
// Conditional logic: Promoters (9-10) → features, Passives (7-8) → improvements, Detractors (0-6) → complaints

const npsJson = {
  "title": {
    "default": "NPS Survey Question",
    "cs": "NPS dotazník",
    "de": "NPS-Umfrage"
  },
  "logo": "https://surveyjs.io/Content/Images/examples/logo.png",
  "logoHeight": "60px",
  "headerView": "advanced",
  "locale": "en",
  "completedHtml": {
    "default": "<h3>Thank you for your feedback</h3>",
    "cs": "<h3>Děkujeme za vaši zpětnou vazbu</h3>",
    "de": "<h3>Vielen Dank für Ihr Feedback</h3>"
  },
  "completedHtmlOnCondition": [
    {
      "expression": "{nps_score} >= 9",
      "html": {
        "default": "<h3>Thank you for your feedback</h3> <h4>We are glad that you love our product. Your ideas and suggestions will help us make it even better.</h4>",
        "cs": "<h3>Děkujeme za vaši zpětnou vazbu</h3> <h4>Jsme rádi, že se vám náš produkt líbí. Vaše nápady a návrhy nám pomohou udělat ho ještě lepší.</h4>",
        "de": "<h3>Vielen Dank für Ihr Feedback</h3> <h4>Wir freuen uns, dass Ihnen unser Produkt gefällt. Ihre Ideen und Vorschläge helfen uns, es noch besser zu machen.</h4>"
      }
    },
    {
      "expression": "{nps_score} >= 6  and {nps_score} <= 8",
      "html": {
        "default": "<h3>Thank you for your feedback</h3> <h4>We are glad that you shared your ideas with us. They will help us make our product better.</h4>",
        "cs": "<h3>Děkujeme za vaši zpětnou vazbu</h3> <h4>Děkujeme, že jste se s námi podělili o své podněty. Pomohou nám náš produkt zlepšit.</h4>",
        "de": "<h3>Vielen Dank für Ihr Feedback</h3> <h4>Vielen Dank, dass Sie Ihre Ideen mit uns teilen. Sie helfen uns, unser Produkt zu verbessern.</h4>"
      }
    }
  ],
  "pages": [
    {
      "name": "page1",
      "elements": [
        {
          "type": "rating",
          "name": "nps_score",
          "title": {
            "default": "On a scale of zero to ten, how likely are you to recommend our product to a friend or colleague?",
            "cs": "Na škále od 0 do 10, jak pravděpodobné je, že byste doporučili náš produkt příteli nebo kolegovi?",
            "de": "Auf einer Skala von 0 bis 10: Wie wahrscheinlich ist es, dass Sie unser Produkt einem Freund oder Kollegen empfehlen?"
          },
          "isRequired": true,
          "rateCount": 11,
          "rateMin": 0,
          "rateMax": 10,
          "minRateDescription": {
            "default": "(Most unlikely)",
            "cs": "(Vůbec nepravděpodobné)",
            "de": "(Sehr unwahrscheinlich)"
          },
          "maxRateDescription": {
            "default": "(Most likely)",
            "cs": "(Velmi pravděpodobné)",
            "de": "(Sehr wahrscheinlich)"
          }
        },
        {
          "type": "checkbox",
          "name": "promoter_features",
          "visibleIf": "{nps_score} >= 9",
          "title": {
            "default": "Which of the following features do you value the most?",
            "cs": "Kterých z následujících vlastností si ceníte nejvíce?",
            "de": "Welche der folgenden Eigenschaften schätzen Sie am meisten?"
          },
          "description": {
            "default": "Please select no more than three features.",
            "cs": "Vyberte prosím maximálně tři vlastnosti.",
            "de": "Bitte wählen Sie höchstens drei Eigenschaften aus."
          },
          "isRequired": true,
          "validators": [
            {
              "type": "answercount",
              "text": {
                "default": "Please select no more than three features.",
                "cs": "Vyberte prosím maximálně tři vlastnosti.",
                "de": "Bitte wählen Sie höchstens drei Eigenschaften aus."
              },
              "maxCount": 3
            }
          ],
          "choices": [
            {
              "value": "Performance",
              "text": {
                "default": "Performance",
                "cs": "Výkon",
                "de": "Leistung"
              }
            },
            {
              "value": "Stability",
              "text": {
                "default": "Stability",
                "cs": "Stabilita",
                "de": "Stabilität"
              }
            },
            {
              "value": "User interface",
              "text": {
                "default": "User interface",
                "cs": "Uživatelské rozhraní",
                "de": "Benutzeroberfläche"
              }
            },
            {
              "value": "Complete functionality",
              "text": {
                "default": "Complete functionality",
                "cs": "Kompletní funkcionalita",
                "de": "Vollständige Funktionalität"
              }
            },
            {
              "value": "Learning materials (documentation, demos, code examples)",
              "text": {
                "default": "Learning materials (documentation, demos, code examples)",
                "cs": "Studijní materiály (dokumentace, ukázky, příklady kódu)",
                "de": "Lernmaterialien (Dokumentation, Demos, Codebeispiele)"
              }
            },
            {
              "value": "Quality support",
              "text": {
                "default": "Quality support",
                "cs": "Kvalitní podpora",
                "de": "Qualitativ hochwertiger Support"
              }
            }
          ],
          "showOtherItem": true,
          "otherText": {
            "default": "Other features:",
            "cs": "Jiné vlastnosti:",
            "de": "Andere Eigenschaften:"
          },
          "colCount": 2
        },
        {
          "type": "comment",
          "name": "passive_experience",
          "visibleIf": "{nps_score} >= 7  and {nps_score} <= 8",
          "title": {
            "default": "What can we do to make your experience more satisfying?",
            "cs": "Co můžeme udělat, aby vaše zkušenost byla uspokojivější?",
            "de": "Was können wir tun, um Ihre Erfahrung zufriedenstellender zu machen?"
          }
        },
        {
          "type": "comment",
          "name": "disappointing_experience",
          "visibleIf": "{nps_score} <= 6",
          "title": {
            "default": "Please let us know why you had such a disappointing experience with our product",
            "cs": "Prosím, napište nám, proč pro vás byla zkušenost s naším produktem tak zklamáním",
            "de": "Bitte teilen Sie uns mit, warum Sie eine so enttäuschende Erfahrung mit unserem Produkt gemacht haben"
          }
        }
      ]
    }
  ]
};

// === MYSQL CONNECTION ===
// Charset: utf8mb4 - Full Unicode support (emoji, Czech, German, Chinese...)
// Collation: utf8mb4_unicode_ci - Case-insensitive, linguistically correct sorting
// Credentials: Loaded from .env (MYSQL_DEV_* or MYSQL_PROD_* based on --env)
// VAZBA: API používá stejné nastavení v API/src/db.js

// Get database credentials from .env based on environment
const getDbConfig = (env) => {
  if (env === 'prod') {
    return {
      host: process.env.MYSQL_PROD_HOST,
      port: parseInt(process.env.MYSQL_PROD_PORT || '3306'),
      user: process.env.MYSQL_PROD_USER,
      password: process.env.MYSQL_PROD_PASSWORD,
      database: process.env.MYSQL_PROD_DATABASE,
      charset: 'utf8mb4', // KRITICKÉ pro správné UTF-8
      collation: 'utf8mb4_unicode_ci' // KRITICKÉ pro správné UTF-8
    };
  } else {
    return {
      host: process.env.MYSQL_DEV_HOST || process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.MYSQL_DEV_PORT || process.env.DB_PORT || '3306'),
      user: process.env.MYSQL_DEV_USER || process.env.DB_USER,
      password: process.env.MYSQL_DEV_PASSWORD || process.env.DB_PASSWORD,
      database: process.env.MYSQL_DEV_DATABASE || process.env.DB_NAME,
      charset: 'utf8mb4', // KRITICKÉ pro správné UTF-8
      collation: 'utf8mb4_unicode_ci' // KRITICKÉ pro správné UTF-8
    };
  }
};

const dbConfig = getDbConfig(envArg);
console.log(`📊 Database: ${dbConfig.database} @ ${dbConfig.host}`);

if (envArg === 'prod') {
  console.log('\n⚠️  WARNING: You are about to insert data into PRODUCTION database!');
  console.log('This will DELETE existing forms, campaigns, and respondents.');
  console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
  await new Promise(resolve => setTimeout(resolve, 5000));
}

const connection = await mysql.createConnection(dbConfig);

console.log('Connected to MySQL');

// === DATA CLEANUP ===
// Pořadí mazání respektuje foreign keys:
// 1. campaign_respondents (závislé na campaigns)
// 2. campaigns (závislé na form_versions)
// 3. form_versions (závislé na forms)
// 4. forms (root table)
await connection.execute('DELETE FROM campaign_respondents');
await connection.execute('DELETE FROM campaigns');
await connection.execute('DELETE FROM form_versions');
await connection.execute('DELETE FROM forms');
console.log('✓ Cleared old data');

// === FORM INSERT ===
// form_id: Random 16-char ID (např. '549HHXFZ38V6ZX8D')
// name: Human-readable název formuláře
// created_by/last_modified_by: Admin ID (musí existovat v admins tabulce)
// VAZBA: form_versions.form_id → forms.form_id
await connection.execute(
  'INSERT INTO forms (form_id, name, created_by, last_modified_by, created, last_update) VALUES (?, ?, ?, ?, NOW(), NOW())',
  ['549HHXFZ38V6ZX8D', 'NPS Survey', 'ADMIN001', 'ADMIN001']
);
console.log('✓ Inserted form');

// === FORM VERSION INSERT ===
// version_id: Random 16-char ID (např. 'MBZQTG7YEBNR552F')
// version: Číslo verze (1, 2, 3...) - incrementální
// surveyjs_version: Verze SurveyJS library použitá při vytvoření
// languages: JSON array s jazyky ['cs', 'de', 'en'] - auto-detected z data
// data: SurveyJS JSON jako string (JSON.stringify!) - KRITICKÉ pro UTF-8
// VAZBA: campaigns.version_id → form_versions.version_id
// Insert form version with JSON.stringify (like you did with knex)
const jsonString = JSON.stringify(npsJson);
await connection.execute(
  'INSERT INTO form_versions (version_id, form_id, version, version_description, surveyjs_version, languages, data, created_by, last_modified_by, created, last_update) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
  ['MBZQTG7YEBNR552F', '549HHXFZ38V6ZX8D', 1, 'Default NPS template', '1.12.0', JSON.stringify(['cs', 'de', 'en']), jsonString, 'ADMIN001', 'ADMIN001']
);
console.log('✓ Inserted form version');

// === CAMPAIGN INSERT ===
// campaign_id: Random 16-char ID (např. '4KS624HEW5PBFFSM')
// public_id: Human-readable URL slug (např. 'nps-survey-2026')
// title: JSON object s jazyky {"en": "...", "cs": "...", "de": "..."} - zobrazí se v UI
// description: JSON object s jazyky - interní poznámka pro admina
// open_on: Datum otevření (NOW() = okamžitě)
// close_on: Datum uzavření (90 dní od vytvoření)
// is_public: 0 = private (jen pro pozvané), 1 = veřejný (odkaz)
// allow_multiple_responses: 0 = jedna odpověď, 1 = více odpovědí
// VAZBA: campaign_respondents.campaign_id → campaigns.campaign_id
// Insert campaign
await connection.execute(
  'INSERT INTO campaigns (campaign_id, public_id, title, description, version_id, email_template, open_on, close_on, is_public, allow_multiple_responses, created_by, last_modified_by, created, last_update) VALUES (?, ?, ?, ?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 90 DAY), ?, ?, ?, ?, NOW(), NOW())',
  [
    '4KS624HEW5PBFFSM',
    'nps-survey-2026',
    JSON.stringify({ "en": "NPS Survey 2026", "cs": "NPS průzkum 2026", "de": "NPS-Umfrage 2026" }),
    JSON.stringify({ "en": "Help us improve our product", "cs": "Pomozte nám zlepšit náš produkt", "de": "Helfen Sie uns, unser Produkt zu verbessern" }),
    'MBZQTG7YEBNR552F',
    JSON.stringify({
      "subject": { "en": "Your feedback matters", "cs": "Vaše zpětná vazba je důležitá", "de": "Ihr Feedback ist wichtig" },
      "body": { "en": "Hi {{salutation}} {{department}},\n\nWe would love to hear your feedback.", "cs": "Ahoj {{salutation}} {{department}},\n\nRádi bychom slyšeli vaši zpětnou vazbu.", "de": "Hallo {{salutation}} {{department}},\n\nWir würden gerne Ihr Feedback hören." }
    }),
    0,
    0,
    'ADMIN001',
    'ADMIN001'
  ]
);
console.log('✓ Inserted campaign');

// === SAMPLE RESPONDENT INSERT ===
// Ukázkový respondent demonstrující custom attributes systém
// respondent_id: 'R' + random uppercase alphanumeric (např. 'RABC123XYZ')
// email: Email respondenta (bude použit pro pozvání)
// 
// === SECURITY HASHING ===
// token: Random 64-char hex string (crypto.randomBytes(32)) - NENÍ uložen v DB!
// email_hash: SHA256(email.toLowerCase()) - Pro deduplication, anonymizaci
//   - Použití: Kontrola, zda email už existuje (bez uložení plain emailu v indexu)
//   - 64 chars hex (SHA256 output)
// token_hash: SHA256(token) - Pro secure survey URLs
//   - Použití: Ověření tokenu v URL parametru bez uložení plain tokenu
//   - 128 chars max (SHA256 = 64, ale DB má rezervu)
//   - Token se regeneruje při každém pozvání (proto se neukládá)
// 
// === CUSTOM ATTRIBUTES (data JSON) ===
// Libovolné atributy pro personalizaci průzkumu:
// - age: number - Věk respondenta (pro segmentaci, statistiky)
// - gender: string - Pohlaví ('male', 'female', 'other', 'prefer-not-to-say')
// - salutation: string - Oslovení v emailu ('Mr.', 'Ms.', 'Dr.', 'Prof.')
// - department: string - Oddělení firmy (pro analýzu podle týmů)
// - location: string - Pobočka/město (pro geo analýzu)
// - employee_id: string - Interní ID zaměstnance
// - join_date: string - Datum nástupu (pro analýzu podle senority)
// - manager_email: string - Email manažera (pro hierarchické reporty)
// - custom_field_1, custom_field_2, ... - Libovolné další
// 
// Tyto atributy jsou dostupné v:
// 1. Email šablonách (placeholders: {{age}}, {{department}}, ...)
// 2. Survey logice (conditional questions based on attributes)
// 3. Response analytics (group by department, location, ...)
// Insert sample respondent with custom attributes
const email = process.env.ADMIN_EMAIL || 'admin@example.com';
const token = crypto.randomBytes(32).toString('hex');
const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
await connection.execute(
  'INSERT INTO campaign_respondents (respondent_id, campaign_id, email, token, email_hash, token_hash, data, created, last_update) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
  [
    'R' + Math.random().toString(36).substring(2, 15).toUpperCase(),
    '4KS624HEW5PBFFSM',
    email,
    token,  // Add plaintext token
    emailHash,
    tokenHash,
    JSON.stringify({
      age: 35,
      gender: 'male',
      salutation: 'Mr.',
      department: 'Engineering',
      location: 'Prague'
    })
  ]
);
console.log('✓ Inserted sample respondent with custom attributes (age, gender, salutation, department, location)');

// Verify data
const [rows] = await connection.execute(
  'SELECT JSON_EXTRACT(data, "$.title.cs") as czech_title FROM form_versions WHERE version_id = ?',
  ['MBZQTG7YEBNR552F']
);
console.log('\n✓ Verification:', rows[0]);

await connection.end();
console.log('\n✅ NPS Survey data inserted successfully with proper UTF-8 encoding!');
