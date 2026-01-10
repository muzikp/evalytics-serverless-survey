/**
 * ========================================
 * EVALYTICS SURVEY - DATABASE SCHEMA
 * ========================================
 * 
 * Finální schéma zahrnující všechny migrace (001-008)
 * MySQL 8.x | Charset: utf8mb4_unicode_ci
 * 
 * TABULKY:
 * 1. users - Admin uživatelé systému
 * 2. user_api_tokens - Personal Access Tokens pro REST API
 * 3. forms - Master records formulářů (bez version-specific dat)
 * 4. form_versions - Verze formulářů s SurveyJS JSON
 * 5. campaigns - Průzkumové kampaně
 * 6. campaign_respondents - Respondenti kampaní s custom attributes
 * 7. responses - Odpovědi respondentů
 * 8. response_attachments - Přílohy k odpovědím
 * 9. storage_items - Uložené soubory
 * 10. email_blacklist - Blacklist emailů
 * 11. campaign_email_log - Log odeslaných emailů
 * 12. email_delivery_events - Delivery eventy od providera (SES)
 * 
 * VAZBY (Foreign Keys):
 * users → forms.created_by, forms.last_modified_by
 * forms → form_versions.form_id
 * form_versions → campaigns.version_id
 * campaigns → campaign_respondents.campaign_id
 * campaign_respondents → responses.respondent_id
 * responses → response_attachments.response_id
 * storage_items → response_attachments.storage_item_id
 */

-- ========================================
-- TABLE: users
-- ========================================
-- Admin uživatelé s přístupem do systému
-- 
-- VAZBY:
-- - forms.created_by → users.user_id
-- - forms.last_modified_by → users.user_id
-- - form_versions.created_by → users.user_id
-- - campaigns.created_by → users.user_id
-- 
CREATE TABLE IF NOT EXISTS users (
  -- Primární klíč: Random 16-char ID (např. 'ADMIN001')
  user_id            VARCHAR(16) PRIMARY KEY COMMENT 'Unique user ID (např. ADMIN001)',
  
  -- Základní údaje
  firstname          VARCHAR(256) NOT NULL COMMENT 'Křestní jméno',
  lastname           VARCHAR(256) NOT NULL COMMENT 'Příjmení',
  email              VARCHAR(256) NOT NULL UNIQUE COMMENT 'Email pro přihlášení (musí být unique)',
  
  -- Autentizace
  password_hash      VARCHAR(256) NOT NULL COMMENT 'Bcrypt hash hesla (10 rounds, 60 chars)',
  api_token_hash     VARCHAR(128) NULL COMMENT 'Hash API tokenu pro REST access (deprecated - viz user_api_tokens)',
  
  -- Oprávnění
  roles              JSON NOT NULL COMMENT 'JSON object rolí: {"master-admin": 1, "admin": 1, "viewer": 1}',
  
  -- Metadata
  created            DATETIME NOT NULL COMMENT 'Timestamp vytvoření uživatele',
  last_update        DATETIME NOT NULL COMMENT 'Timestamp poslední změny'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: user_api_tokens
-- ========================================
-- Personal Access Tokens (PAT) pro programmatický REST access
-- Token plaintext zobrazen pouze jednou při vytvoření
-- 
-- VAZBY:
-- - user_id → users.user_id (ON DELETE CASCADE)
-- 
CREATE TABLE IF NOT EXISTS user_api_tokens (
  -- Primární klíč: Random 32-char ID
  token_id           VARCHAR(32) PRIMARY KEY COMMENT 'Unique token ID',
  
  -- Vazba na uživatele
  user_id            VARCHAR(16) NOT NULL COMMENT 'ID uživatele (FK → users.user_id)',
  
  -- Token údaje
  name               VARCHAR(128) NOT NULL COMMENT 'Human-readable název tokenu (např. "CI/CD Pipeline")',
  token_hash         VARCHAR(128) NOT NULL COMMENT 'SHA256 hash tokenu (64 chars) - token plaintext neuložen',
  scopes             JSON NOT NULL COMMENT 'JSON array oprávnění ["forms:read", "campaigns:write", ...]',
  
  -- Expirace a revokace
  expires_at         DATETIME NULL COMMENT 'Datum expirace (NULL = nikdy nevyprší)',
  last_used          DATETIME NULL COMMENT 'Poslední použití tokenu',
  revoked_at         DATETIME NULL COMMENT 'Datum revokace (NULL = aktivní)',
  
  -- Metadata
  created            DATETIME NOT NULL COMMENT 'Timestamp vytvoření tokenu',
  last_update        DATETIME NOT NULL COMMENT 'Timestamp poslední změny',
  
  -- Constraints
  UNIQUE KEY uq_user_token_name (user_id, name),
  KEY ix_user_token_user (user_id),
  KEY ix_user_token_hash (token_hash),
  CONSTRAINT fk_user_token_user FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: forms
-- ========================================
-- Master records formulářů (bez version-specific dat)
-- V migraci 003 odstraněna duplikátní data (surveyjs_version, languages, data)
-- - pouze metadata sdílená všemi verzemi
-- 
-- VAZBY:
-- - form_versions.form_id → forms.form_id
-- - created_by → users.user_id
-- - last_modified_by → users.user_id
-- 
CREATE TABLE IF NOT EXISTS forms (
  -- Primární klíč: Random 16-char ID (crypto.randomBytes)
  form_id            VARCHAR(16) PRIMARY KEY COMMENT 'Unique form ID (např. 549HHXFZ38V6ZX8D)',
  
  -- Základní údaje
  name               VARCHAR(256) NOT NULL COMMENT 'Human-readable název formuláře (např. "NPS Survey")',
  
  -- Soft delete (migration 008)
  removed            TINYINT(1) DEFAULT 0 COMMENT 'Soft delete flag: 0=active, 1=smazán',
  
  -- Metadata
  created            DATETIME NOT NULL COMMENT 'Timestamp vytvoření formuláře',
  last_update        DATETIME NOT NULL COMMENT 'Timestamp poslední změny',
  created_by         VARCHAR(16) NOT NULL COMMENT 'User ID autora (FK → users.user_id)',
  last_modified_by   VARCHAR(16) NOT NULL COMMENT 'User ID posledního editora (FK → users.user_id)',
  
  -- Indexes
  KEY idx_removed (removed),
  
  -- Foreign Keys
  CONSTRAINT fk_forms_created_by FOREIGN KEY (created_by) REFERENCES users(user_id),
  CONSTRAINT fk_forms_modified_by FOREIGN KEY (last_modified_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: form_versions
-- ========================================
-- Verze formulářů s SurveyJS JSON definicí
-- Každá verze je immutable snapshot stavu formuláře
-- 
-- VAZBY:
-- - form_id → forms.form_id
-- - campaigns.version_id → form_versions.version_id
-- - created_by → users.user_id
-- - last_modified_by → users.user_id
-- 
CREATE TABLE IF NOT EXISTS form_versions (
  -- Primární klíč: Random 16-char ID (crypto.randomBytes)
  version_id         VARCHAR(16) PRIMARY KEY COMMENT 'Unique version ID (např. MBZQTG7YEBNR552F)',
  
  -- Vazba na form
  form_id            VARCHAR(16) NOT NULL COMMENT 'ID formuláře (FK → forms.form_id)',
  
  -- Verze údaje
  form_name          VARCHAR(256) COMMENT 'Název formuláře (duplicitní kvůli JOINs) - migration 004',
  version            INT NOT NULL COMMENT 'Číslo verze (1, 2, 3...) - incrementální',
  version_description TEXT NULL COMMENT 'Popis změn v této verzi - migration 005',
  
  -- SurveyJS specifika
  surveyjs_version   VARCHAR(16) NOT NULL COMMENT 'Verze SurveyJS library (např. "1.12.0")',
  languages          JSON NOT NULL COMMENT 'JSON array jazyků ["cs", "de", "en"] - auto-detected',
  data               JSON NOT NULL COMMENT 'SurveyJS JSON definice (MUST use JSON.stringify() from Node.js!)',
  
  -- Soft delete (migration 008)
  removed            TINYINT(1) DEFAULT 0 COMMENT 'Soft delete flag: 0=active, 1=smazán',
  
  -- Metadata
  created            DATETIME NOT NULL COMMENT 'Timestamp vytvoření verze',
  last_update        DATETIME NOT NULL COMMENT 'Timestamp poslední změny',
  created_by         VARCHAR(16) NOT NULL COMMENT 'User ID autora (FK → users.user_id)',
  last_modified_by   VARCHAR(16) NOT NULL COMMENT 'User ID posledního editora (FK → users.user_id)',
  
  -- Indexes
  UNIQUE KEY uq_form_version (form_id, version),
  KEY idx_removed (removed),
  
  -- Foreign Keys
  CONSTRAINT fk_form_versions_form FOREIGN KEY (form_id) REFERENCES forms(form_id) ON DELETE CASCADE,
  CONSTRAINT fk_form_versions_created_by FOREIGN KEY (created_by) REFERENCES users(user_id),
  CONSTRAINT fk_form_versions_modified_by FOREIGN KEY (last_modified_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: campaigns
-- ========================================
-- Průzkumové kampaně - instance formuláře s respondenty
-- 
-- VAZBY:
-- - version_id → form_versions.version_id (která verze formuláře)
-- - campaign_respondents.campaign_id → campaigns.campaign_id
-- - created_by → users.user_id
-- - last_modified_by → users.user_id
-- 
CREATE TABLE IF NOT EXISTS campaigns (
  -- Primární klíč: Random 16-char ID (crypto.randomBytes)
  campaign_id        VARCHAR(16) PRIMARY KEY COMMENT 'Unique campaign ID (např. 4KS624HEW5PBFFSM)',
  
  -- Vazba na form version
  version_id         VARCHAR(16) NOT NULL COMMENT 'ID verze formuláře (FK → form_versions.version_id)',
  
  -- Nastavení přístupu (migration 006)
  is_public          TINYINT(1) DEFAULT 0 COMMENT '0=private (jen pro pozvané), 1=veřejný odkaz',
  allow_multiple_responses TINYINT(1) NOT NULL DEFAULT 0 COMMENT '0=jedna odpověď, 1=více odpovědí od jednoho respondenta',
  
  -- Identifikace
  public_id          VARCHAR(256) NOT NULL UNIQUE COMMENT 'Human-readable URL slug (např. "nps-survey-2026")',
  title              JSON NOT NULL COMMENT 'JSON object s jazyky {"en": "...", "cs": "...", "de": "..."}',
  description        JSON NULL COMMENT 'JSON object popisku (interní poznámka pro admina)',
  
  -- Email šablona
  email_template     JSON NOT NULL COMMENT 'JSON object email šablony s placeholders {{name}}, {{department}}, ...',
  email_template_fields JSON NULL COMMENT 'Custom email placeholders with multilingual values: [{"id":"greeting","cs":"Dobrý den","en":"Hello"}]',
  
  -- Časový rozsah
  open_on            DATETIME NULL COMMENT 'Datum otevření (NULL = okamžitě)',
  close_on           DATETIME NULL COMMENT 'Datum uzavření (NULL = nekončí)',
  
  -- Limity
  max_attempts       INT NULL COMMENT 'Max počet pokusů (NULL = neomezeno)',
  
  -- Auto-save nastavení
  auto_save_interval_seconds INT NULL DEFAULT 10 COMMENT 'Interval průběžného ukládání v sekundách (NULL = vypnuto, default 10)',
  
  -- Soft delete (migration 008)
  removed            TINYINT(1) DEFAULT 0 COMMENT 'Soft delete flag: 0=active, 1=smazán',
  
  -- Metadata
  created            DATETIME NOT NULL COMMENT 'Timestamp vytvoření kampaně',
  last_update        DATETIME NOT NULL COMMENT 'Timestamp poslední změny',
  created_by         VARCHAR(16) NOT NULL COMMENT 'User ID autora (FK → users.user_id)',
  last_modified_by   VARCHAR(16) NOT NULL COMMENT 'User ID posledního editora (FK → users.user_id)',
  
  -- Indexes
  KEY idx_removed (removed),
  
  -- Foreign Keys
  CONSTRAINT fk_campaigns_version FOREIGN KEY (version_id) REFERENCES form_versions(version_id),
  CONSTRAINT fk_campaigns_created_by FOREIGN KEY (created_by) REFERENCES users(user_id),
  CONSTRAINT fk_campaigns_modified_by FOREIGN KEY (last_modified_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: campaign_respondents
-- ========================================
-- Respondenti kampaní s custom attributes pro personalizaci
-- 
-- VAZBY:
-- - campaign_id → campaigns.campaign_id (ON DELETE CASCADE)
-- - responses.respondent_id → campaign_respondents.respondent_id
-- 
-- CUSTOM ATTRIBUTES (data JSON):
-- - age: number - Věk respondenta
-- - gender: string - Pohlaví ('male', 'female', 'other')
-- - salutation: string - Oslovení ('Mr.', 'Ms.', 'Dr.')
-- - department: string - Oddělení
-- - location: string - Pobočka/město
-- - employee_id: string - Interní ID
-- - ...libovolné další pro email placeholders a conditional questions
-- 
CREATE TABLE IF NOT EXISTS campaign_respondents (
  -- Primární klíč: 'R' + random uppercase alphanumeric
  respondent_id      VARCHAR(32) PRIMARY KEY COMMENT 'Unique respondent ID (např. RABC123XYZ)',
  
  -- Vazba na campaign
  campaign_id        VARCHAR(16) NOT NULL COMMENT 'ID kampaně (FK → campaigns.campaign_id)',
  
  -- Kontakt
  email              VARCHAR(256) NOT NULL COMMENT 'Email respondenta (pro pozvání)',
  token              VARCHAR(64) NULL COMMENT 'Plaintext token for private campaign URLs',
  email_hash         CHAR(64) NOT NULL COMMENT 'SHA256(email.toLowerCase()) - deduplication, privacy',
  token_hash         VARCHAR(128) NOT NULL COMMENT 'SHA256(random_token) - secure survey URL verification',
  
  -- Custom attributes pro personalizaci
  data               JSON NULL COMMENT 'Custom attributes: {age, gender, salutation, department, location, ...}',
  
  -- Invitation tracking (migration 007)
  invitation_sent_at DATETIME NULL COMMENT 'Timestamp odeslání pozvánky (NULL = neodeslána)',
  invitation_error   TEXT NULL COMMENT 'Chybová zpráva při odesílání (NULL = úspěch)',
  
  -- Soft delete (migration 008)
  removed            TINYINT(1) DEFAULT 0 COMMENT 'Soft delete flag: 0=active, 1=smazán',
  
  -- Metadata
  created            DATETIME NOT NULL COMMENT 'Timestamp vytvoření respondenta',
  last_update        DATETIME NOT NULL COMMENT 'Timestamp poslední změny',
  
  -- Indexes
  UNIQUE KEY uq_campaign_email (campaign_id, email),
  KEY ix_respondents_email_hash (campaign_id, email_hash),
  KEY idx_campaign (campaign_id),
  KEY idx_email (email),
  KEY idx_invitation_sent (campaign_id, invitation_sent_at),
  KEY idx_removed (removed),
  
  -- Foreign Keys
  CONSTRAINT fk_respondents_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: responses
-- ========================================
-- Odpovědi respondentů na průzkumy
-- 
-- VAZBY:
-- - respondent_id → campaign_respondents.respondent_id
-- - campaign_id → campaigns.campaign_id
-- - version_id → form_versions.version_id (která verze byla vyplněna)
-- - response_attachments.response_id → responses.response_id
-- 
CREATE TABLE IF NOT EXISTS responses (
  -- Primární klíč: Random 64-char ID
  response_id        VARCHAR(64) PRIMARY KEY COMMENT 'Unique response ID',
  
  -- Vazby
  respondent_id      VARCHAR(32) NOT NULL COMMENT 'ID respondenta (FK → campaign_respondents.respondent_id)',
  campaign_id        VARCHAR(16) NOT NULL COMMENT 'ID kampaně (FK → campaigns.campaign_id)',
  version_id         VARCHAR(16) NOT NULL COMMENT 'ID verze formuláře (FK → form_versions.version_id)',
  
  -- Pokus
  attempt_no         INT NOT NULL DEFAULT 1 COMMENT 'Číslo pokusu (1, 2, 3...) - pro allow_multiple_responses',
  
  -- Status
  status             ENUM('in_progress','completed') NOT NULL DEFAULT 'in_progress' COMMENT 'in_progress=rozpracováno, completed=odesláno',
  
  -- Data
  request_data       JSON NULL COMMENT 'HTTP request metadata (IP, user-agent, ...)',
  client_meta        JSON NULL COMMENT 'Client-side metadata (browser, screen resolution, ...)',
  data               JSON NOT NULL COMMENT 'SurveyJS odpovědi jako JSON {question_name: value, ...}',
  
  -- Metadata
  submitted_at       DATETIME NULL COMMENT 'Timestamp odeslání (NULL = in_progress)',
  
  -- Soft delete (migration 008)
  removed            TINYINT(1) DEFAULT 0 COMMENT 'Soft delete flag: 0=active, 1=smazán',
  
  created            DATETIME NOT NULL COMMENT 'Timestamp vytvoření response',
  last_update        DATETIME NOT NULL COMMENT 'Timestamp poslední změny',
  
  -- Indexes
  UNIQUE KEY uq_attempt (respondent_id, attempt_no),
  KEY ix_campaign_status (campaign_id, status),
  KEY idx_removed (removed),
  
  -- Foreign Keys
  CONSTRAINT fk_responses_respondent FOREIGN KEY (respondent_id) REFERENCES campaign_respondents(respondent_id),
  CONSTRAINT fk_responses_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
  CONSTRAINT fk_responses_version FOREIGN KEY (version_id) REFERENCES form_versions(version_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: storage_items
-- ========================================
-- Uložené soubory (uploadnuté v průzkumech)
-- 
-- VAZBY:
-- - response_attachments.storage_item_id → storage_items.storage_item_id
-- - created_by → users.user_id (optional)
-- - last_modified_by → users.user_id (optional)
-- 
CREATE TABLE IF NOT EXISTS storage_items (
  -- Primární klíč: Random 32-char ID
  storage_item_id    VARCHAR(32) PRIMARY KEY COMMENT 'Unique storage item ID',
  
  -- Umístění
  location           TEXT NOT NULL COMMENT 'Storage location (S3 bucket URL, local path, ...)',
  local_path         TEXT NULL COMMENT 'Local filesystem path (pokud je lokální)',
  
  -- Metadata souboru
  name               VARCHAR(256) NOT NULL COMMENT 'Původní název souboru',
  description        TEXT NULL COMMENT 'Popis souboru (optional)',
  filetype           VARCHAR(256) NOT NULL COMMENT 'MIME type (image/jpeg, application/pdf, ...)',
  size_bytes         BIGINT NULL COMMENT 'Velikost v bytech',
  checksum_sha256    VARCHAR(64) NULL COMMENT 'SHA256 checksum souboru',
  
  -- Metadata
  created            DATETIME NOT NULL COMMENT 'Timestamp uploadu',
  last_update        DATETIME NOT NULL COMMENT 'Timestamp poslední změny',
  created_by         VARCHAR(16) NULL COMMENT 'User ID uploadera (FK → users.user_id)',
  last_modified_by   VARCHAR(16) NULL COMMENT 'User ID posledního editora (FK → users.user_id)',
  
  -- Foreign Keys
  CONSTRAINT fk_storage_created_by FOREIGN KEY (created_by) REFERENCES users(user_id),
  CONSTRAINT fk_storage_modified_by FOREIGN KEY (last_modified_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: response_attachments
-- ========================================
-- Přílohy k odpovědím (vazba response ↔ storage_item)
-- 
-- VAZBY:
-- - response_id → responses.response_id
-- - storage_item_id → storage_items.storage_item_id
-- 
CREATE TABLE IF NOT EXISTS response_attachments (
  -- Primární klíč: Random 32-char ID
  upload_id          VARCHAR(32) PRIMARY KEY COMMENT 'Unique upload ID',
  
  -- Vazby
  response_id        VARCHAR(64) NOT NULL COMMENT 'ID odpovědi (FK → responses.response_id)',
  storage_item_id    VARCHAR(32) NOT NULL COMMENT 'ID souboru (FK → storage_items.storage_item_id)',
  
  -- Kontext
  question_name      VARCHAR(256) NULL COMMENT 'Název SurveyJS question (ze které otázky pochází)',
  
  -- Status
  status             ENUM('pending','ready','rejected') NOT NULL DEFAULT 'pending' COMMENT 'pending=nahrává se, ready=hotový, rejected=zamítnutý',
  
  -- Metadata
  created            DATETIME NOT NULL COMMENT 'Timestamp vytvoření vazby',
  last_update        DATETIME NOT NULL COMMENT 'Timestamp poslední změny',
  
  -- Foreign Keys
  CONSTRAINT fk_attachments_response FOREIGN KEY (response_id) REFERENCES responses(response_id),
  CONSTRAINT fk_attachments_storage FOREIGN KEY (storage_item_id) REFERENCES storage_items(storage_item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: email_blacklist
-- ========================================
-- Blacklist emailů (bounce, complaint, manual block)
-- 
-- POZNÁMKA: Existuje i stará tabulka email_black_list z 001_init
-- - tato je novější a jednodušší (migration 006)
-- 
CREATE TABLE IF NOT EXISTS email_blacklist (
  -- Primární klíč: Email (unique)
  email              VARCHAR(255) PRIMARY KEY COMMENT 'Blacklistovaný email',
  
  -- Důvod
  reason             VARCHAR(255) COMMENT 'Důvod blacklistu (bounce, complaint, manual, ...)',
  
  -- Metadata
  blacklisted_at     DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT 'Timestamp přidání na blacklist',
  blacklisted_by     VARCHAR(255) COMMENT 'Kdo přidal (user_id nebo "system")'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: campaign_email_log
-- ========================================
-- Log odeslaných emailů (pozvánky, připomínky)
-- 
-- VAZBY:
-- - campaign_id → campaigns.campaign_id
-- - respondent_id → campaign_respondents.respondent_id
-- 
CREATE TABLE IF NOT EXISTS campaign_email_log (
  -- Primární klíč: Auto-increment BIGINT
  email_log_id       BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique log ID',
  
  -- Vazby
  campaign_id        VARCHAR(16) NOT NULL COMMENT 'ID kampaně (FK → campaigns.campaign_id)',
  respondent_id      VARCHAR(32) NOT NULL COMMENT 'ID respondenta (FK → campaign_respondents.respondent_id)',
  
  -- Email údaje
  recipient_email    VARCHAR(256) NOT NULL COMMENT 'Email příjemce',
  email_type         ENUM('invite','reminder') NOT NULL COMMENT 'invite=pozvánka, reminder=připomínka',
  
  -- Provider údaje
  provider           ENUM('ses') NOT NULL DEFAULT 'ses' COMMENT 'Email provider (AWS SES)',
  provider_message_id VARCHAR(256) NULL COMMENT 'Message ID od providera (pro tracking)',
  
  -- Status tracking
  status             ENUM('queued','sent','delivered','bounced','complaint','rejected','failed') NOT NULL DEFAULT 'queued' COMMENT 'Status doručení',
  last_event_type    VARCHAR(64) NULL COMMENT 'Poslední event type od providera',
  last_event_at      DATETIME NULL COMMENT 'Timestamp posledního eventu',
  error_message      TEXT NULL COMMENT 'Chybová zpráva (pokud failed)',
  
  -- Metadata
  created            DATETIME NOT NULL COMMENT 'Timestamp vytvoření logu (= odeslání)',
  last_update        DATETIME NOT NULL COMMENT 'Timestamp poslední změny statusu',
  
  -- Indexes
  KEY ix_emaillog_campaign (campaign_id),
  KEY ix_emaillog_respondent (respondent_id),
  KEY ix_emaillog_provider_msg (provider_message_id),
  
  -- Foreign Keys
  CONSTRAINT fk_emaillog_campaign FOREIGN KEY (campaign_id) REFERENCES campaigns(campaign_id),
  CONSTRAINT fk_emaillog_respondent FOREIGN KEY (respondent_id) REFERENCES campaign_respondents(respondent_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ========================================
-- TABLE: email_delivery_events
-- ========================================
-- Delivery eventy od email providera (AWS SES webhooks)
-- 
-- Ukládá raw eventy pro audit trail a troubleshooting
-- 
CREATE TABLE IF NOT EXISTS email_delivery_events (
  -- Primární klíč: Auto-increment BIGINT
  event_id           BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT 'Unique event ID',
  
  -- Provider údaje
  provider           ENUM('ses') NOT NULL DEFAULT 'ses' COMMENT 'Email provider (AWS SES)',
  provider_message_id VARCHAR(256) NOT NULL COMMENT 'Message ID od providera',
  
  -- Event údaje
  event_type         VARCHAR(64) NOT NULL COMMENT 'Event type (send, delivery, bounce, complaint, ...)',
  event_at           DATETIME NOT NULL COMMENT 'Timestamp eventu (od providera)',
  recipient_email    VARCHAR(256) NULL COMMENT 'Email příjemce',
  
  -- Raw payload
  payload_json       JSON NULL COMMENT 'Celý JSON payload od providera (pro debug)',
  
  -- Indexes
  KEY ix_ede_msg (provider_message_id),
  KEY ix_ede_type (event_type),
  KEY ix_ede_at (event_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

/**
 * ========================================
 * POZNÁMKY K SCHÉMATU
 * ========================================
 * 
 * 1. CHARSET: Všechny tabulky používají utf8mb4_unicode_ci pro plnou Unicode podporu
 * 
 * 2. SOFT DELETE: Tabulky forms, form_versions, campaigns, campaign_respondents, responses
 *    mají 'removed' flag pro soft delete (0=active, 1=smazán)
 * 
 * 3. JSON FIELDS: Vždy používej JSON.stringify() z Node.js, NIKDY SQL escape sekvence!
 * 
 * 4. SECURITY HASHING:
 *    - password_hash: bcrypt (10 rounds, 60 chars)
 *    - email_hash: SHA256(email.toLowerCase()) - 64 chars hex
 *    - token_hash: SHA256(random_token) - 64 chars hex
 * 
 * 5. CUSTOM ATTRIBUTES: campaign_respondents.data může obsahovat libovolné JSON atributy
 *    pro personalizaci emailů a conditional questions
 * 
 * 6. FOREIGN KEY CASCADE: campaign_respondents ON DELETE CASCADE (smaže se s kampaní)
 * 
 * 7. DEPRECATED: email_black_list tabulka z původního 001_init (neimplementována zde)
 * 
 * 8. INICIALIZACE: Pro vložení demo dat použij: node utils/sql/insert_nps_direct.js
 */
