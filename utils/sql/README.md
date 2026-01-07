# Database Initialization & Management

Tento adresář obsahuje SQL schéma a inicializační skripty pro evalytics survey databázi.

**Všechny skripty načítají konfiguraci z `.env` souboru** - žádné natvrdo zakódované hodnoty!

## Quick Start (Nová instalace)

```powershell
# 1. Vytvoř databázové schéma (načte DB_NAME z .env)
node utils/sql/init-schema.js

# 2. Vytvoř admin uživatele (načte ADMIN_EMAIL, ADMIN_PASSWORD z .env)
node utils/sql/create-admin.js

# 3. (Optional) Inicializuj s NPS dotazníkem a ukázkovými daty
node utils/sql/insert_nps_direct.js
```

### Environment Selection

```powershell
# Development (default) - používá MYSQL_DEV_* proměnné
node utils/sql/init-schema.js
node utils/sql/create-admin.js

# Production - používá MYSQL_PROD_* proměnné
node utils/sql/init-schema.js --env prod
node utils/sql/create-admin.js --env prod
```

## Database Setup

- **Local Development**: MySQL 8.x lokálně (ne Docker)
- **Production**: AWS RDS MySQL
- **Configuration**: Vše v `.env` souboru v project root
- **Character Set**: `utf8mb4_unicode_ci` pro správné UTF-8 (čeština, němčina, emoji...)

### Required .env Variables

**Development Database:**
```env
MYSQL_DEV_HOST=localhost
MYSQL_DEV_PORT=3306
MYSQL_DEV_USER=vcagent
MYSQL_DEV_PASSWORD=your_password
MYSQL_DEV_DATABASE=evalytics_survey
```

**Production Database:**
```env
MYSQL_PROD_HOST=your-rds-host.amazonaws.com
MYSQL_PROD_PORT=3306
MYSQL_PROD_USER=vcagent
MYSQL_PROD_PASSWORD=your_password
MYSQL_PROD_DATABASE=ess_v1
```

**Admin Credentials:**
```env
ADMIN_EMAIL=admin@example.com
ADMIN_PASSWORD=your_secure_password
ADMIN_FIRSTNAME=Admin  # Optional
ADMIN_LASTNAME=User    # Optional
```

## ⚠️ Důležité: UTF-8 Best Practice

**VŽDY používej `JSON.stringify()` při vkládání JSON dat z Node.js!**

❌ **NIKDY** nepoužívej SQL escape sekvence jako `\u003c` - MySQL je uloží doslova a zničí češtinu!

✅ **SPRÁVNĚ**:
```javascript
const jsonString = JSON.stringify(surveyJson);
await connection.execute('INSERT INTO ... VALUES (?)', [jsonString]);
```

## File Structure Po Konsolidaci (2026-01-07)

### 📁 Active Files (KEEP)

**Schema**:
- `001_init.sql` - **KOMPLETNÍ databázové schéma**
  * Všechny tabulky s podrobnou dokumentací každého pole
  * Foreign keys, indexes, constraints
  * Zahrnuje změny z původních migrací 001-008
  * COMMENT u každého sloupce vysvětlující účel a vazby

**Initialization Scripts**:
- `init-schema.js` - **Inicializace databázového schéma**
  * Spustí 001_init.sql s dynamickým DB_NAME z .env
  * Podporuje dev/prod environment selection
  * Safe: IF NOT EXISTS, nevymaže existující data
- `create-admin.js` - **Vytvoření admin uživatele**
  * Načte ADMIN_EMAIL, ADMIN_PASSWORD z .env
  * Automatický bcrypt hashing (10 rounds)
  * Podporuje dev/prod environment selection
- `insert_nps_direct.js` - **Demo data (NPS + sample respondent)**
  * Vkládá: NPS form + version + campaign + sample respondent
  * Custom attributes demo: age, gender, salutation, department, location
  * Kompletní dokumentace uvnitř souboru
- `setup_local_db.sql` - Local DB setup (CREATE DATABASE, GRANT, ...)

**Documentation**:
- `README.md` - Tento soubor

### 🗑️ Deleted Files (2026-01-07 Consolidation)

**Obsolete migrations (sloučeny do 001_init.sql)**:
- `002_rename_to_forms.sql` → templates→forms, snapshots→form_versions
- `002_alter_email_template.sql` → email template changes
- `003_restructure_forms.sql` → odstranění duplikátních dat z forms
- `003_restructure_forms_execute.sql` → execute restrukturalizace
- `003_add_tokens_to_data.sql` → token support
- `004_rename_snapshot_to_version.sql` → snapshot→version
- `004_add_form_name.sql` → form_name field
- `005_add_response_persistence.sql` → response persistence
- `005_add_version_description.sql` → version_description field
- `006_campaign_respondents.sql` → is_public, allow_retries
- `006_add_post_submit_controls.sql` → post-submit controls
- `007_add_invitation_tracking.sql` → invitation_sent_at, invitation_error
- `008_add_soft_delete.sql` → removed flag

**Obsolete utilities**:
- `run-migration-007.ps1` → migration runner (již není potřeba)

**Obsolete seed files** (deleted 2026-01-07 audit):
- `seed_example_data.sql`, `seed_example_multilingual.sql`
- `seed_simple.sql`, `seed_test_data.sql`
- `seed_nps_default.sql` (měl UTF-8 escape sequence problémy)
- `seed_nps_utf8.sql`, `test-campaign-data.sql`
- `generate-campaign.sql`, `fix_seed_encoding.js`

## Running Database Setup

### Doporučený způsob (Node.js skripty)

**Výhody:**
- ✅ Automaticky načítá .env (DB_NAME, credentials, admin údaje)
- ✅ Bezpečné (bcrypt hashing, žádné plaintext hesla v SQL)
- ✅ Environment switching (dev/prod)
- ✅ Lepší error handling

```powershell
# Development
node utils/sql/init-schema.js
node utils/sql/create-admin.js

# Production
node utils/sql/init-schema.js --env prod
node utils/sql/create-admin.js --env prod
```

### Alternativní způsob (MySQL CLI)

Pokud chceš spustit SQL ručně:

```powershell
# Development
mysql -u vcagent -p evalytics_survey < utils/sql/001_init.sql

# Production (nahraď credentials)
mysql -h your-host -u user -p database < utils/sql/001_init.sql
```

⚠️ **Poznámka:** Admin uživatele MUSÍŠ vytvořit přes `create-admin.js` (bcrypt hashing)

## Database Schema Documentation

Schéma `001_init.sql` obsahuje **12 tabulek** s podrobnou dokumentací:

### Core Tables
- **users** - Admin uživatelé systému
- **user_api_tokens** - Personal Access Tokens pro REST API
- **forms** - Master records formulářů
- **form_versions** - Verze formulářů s SurveyJS JSON
- **campaigns** - Průzkumové kampaně
- **campaign_respondents** - Respondenti s custom attributes

### Response Tables
- **responses** - Odpovědi respondentů
- **response_attachments** - Přílohy k odpovědím
- **storage_items** - Uložené soubory

### Email Tables
- **email_blacklist** - Blacklist emailů
- **campaign_email_log** - Log odeslaných emailů
- **email_delivery_events** - Delivery eventy od providera (SES)

Každá tabulka má **COMMENT u každého sloupce** vysvětlující:
- Účel sloupce
- Datový typ a omezení
- Foreign key vazby
- Příklady hodnot
- Kdy a jak se používá

## Adding Sample Respondents

Když vytváříš respondenty programově, vždy generuj **oba hashe**:

```javascript
import crypto from 'crypto';

const email = 'user@example.com';
const token = crypto.randomBytes(32).toString('hex'); // 64 chars hex
const emailHash = crypto.createHash('sha256').update(email.toLowerCase()).digest('hex'); // 64 chars
const tokenHash = crypto.createHash('sha256').update(token).digest('hex'); // 64 chars

// Insert s email_hash a token_hash (oba povinné!)
await connection.execute(
  `INSERT INTO campaign_respondents 
   (respondent_id, campaign_id, email, email_hash, token_hash, data, created, last_update) 
   VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
  [respondentId, campaignId, email, emailHash, tokenHash, JSON.stringify(customAttributes)]
);
```

### Custom Attributes (data JSON)

Libovolné atributy pro personalizaci:
```javascript
{
  age: 35,                    // Věk (segmentace, statistiky)
  gender: 'male',            // Pohlaví ('male', 'female', 'other')
  salutation: 'Mr.',         // Oslovení v emailu
  department: 'Engineering', // Oddělení (analýza podle týmů)
  location: 'Prague',        // Pobočka/město (geo analýza)
  employee_id: 'E12345',     // Interní ID
  join_date: '2020-01-15',   // Datum nástupu (seniorita)
  manager_email: 'boss@...'  // Manager (hierarchie)
}
```

Použití:
1. **Email templates**: placeholders `{{age}}`, `{{department}}`, ...
2. **Survey logic**: conditional questions based on attributes
3. **Analytics**: group by department, location, age groups...

## Key Variables Reference

### Form & Version IDs
- `form_id`: Random 16-char (např. `549HHXFZ38V6ZX8D`)
- `version_id`: Random 16-char (např. `MBZQTG7YEBNR552F`)
- Generováno: `crypto.randomBytes(8).toString('hex').toUpperCase()`

### Campaign IDs
- `campaign_id`: Random 16-char (např. `4KS624HEW5PBFFSM`)
- `public_id`: Human-readable slug (např. `nps-survey-2026`)

### Security Hashes
- `email_hash`: SHA256(email.toLowerCase()) - 64 chars
  * Použití: Deduplication, privacy, rychlý lookup
- `token_hash`: SHA256(random_token) - 64 chars
  * Použití: Secure survey URL verification
  * Token není uložen (regeneruje se při pozvání)

### Admin & Roles
- `user_id`: String ID (např. `ADMIN001`)
- `password_hash`: bcrypt (10 rounds) - 60 chars
  * Format: `$2a$10$[22 chars salt][31 chars hash]`
- `roles`: JSON object `{"master-admin": 1, "admin": 1, "viewer": 1}`

## Database Dependencies (Foreign Keys)

```
users (admin)
  └── forms.created_by → users.user_id
       └── form_versions.form_id → forms.form_id
            └── campaigns.version_id → form_versions.version_id
                 └── campaign_respondents.campaign_id → campaigns.campaign_id
```

Pořadí mazání dat (respektuje FK):
1. `campaign_respondents`
2. `campaigns`
3. `form_versions`
4. `forms`
5. `users` (pokud není referenced)

## Notes

- **Charset warning**: Vždy kontroluj `charset: 'utf8mb4'` a `collation: 'utf8mb4_unicode_ci'`
- **JSON.stringify**: Kritické pro správné UTF-8 - viz insert_nps_direct.js
- **Migration order**: Spouštěj 001→008 sekvenčně (některé jsou deprecated ale kept for reference)
- **Password security**: Změň default heslo po prvním přihlášení!
- **Token regeneration**: token_hash se mění při každém pozvání (proto plain token není uložen)
- `003_restructure_forms.sql` - Restructure forms schema
- `004_add_form_name.sql` - Add name column to forms
- `005_add_version_description.sql` - Add description to form versions
- `006_campaign_respondents.sql` - Create campaign respondents table
- `007_add_invitation_tracking.sql` - Add invitation_sent_at and invitation_error columns

## Current Schema Overview

### Main Tables
- `users` - System users with roles
- `forms` - Survey form definitions
- `form_versions` - Versioned form definitions (immutable snapshots)
- `campaigns` - Survey campaigns
- `campaign_respondents` - Respondents for private campaigns
- `responses` - Survey responses
- `email_blacklist` - Blacklisted email addresses

### Key Changes in Recent Migrations
- **Migration 007**: Added `invitation_sent_at` and `invitation_error` columns to track email invitation status
  - Required for showing "Invitations Sent" count in campaign list
  - Will be populated when email sending functionality is implemented
