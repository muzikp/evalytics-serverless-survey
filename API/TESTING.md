# Lokální testování Evalytics API

## Prerekvizity
- MySQL 8.0 běží na localhost:3306
- Node.js 20+
- AWS SAM CLI

## Quick Start

### 1. Inicializace databáze
```bash
mysqlsh --sql -u vcagent -pHUIEwhmeAk9I7k7b_Wg8T -h localhost -f utils/sql/setup_local_db.sql
mysqlsh --sql -u vcagent -pHUIEwhmeAk9I7k7b_Wg8T -h localhost -f utils/sql/create-admin.sql
```

### 2. Build API
```bash
cd API
sam build
```

### 3. Testovací flow

#### Přihlášení admina
```bash
sam local invoke ApiFunction --event test-login-admin.json --env-vars .\env.json
```
**Výstup:** JWT token (použij v dalších requestech v Authorization header)

#### Vytvoření template
```bash
sam local invoke ApiFunction --event test-create-template.json --env-vars .\env.json
```
**Výstup:** `template_id` (např. DGFVT9W6A8M6N1ZF)

#### Vytvoření snapshot
```bash
# Uprav test-create-snapshot.json - vlož template_id
sam local invoke ApiFunction --event test-create-snapshot.json --env-vars .\env.json
```
**Výstup:** `snapshot_id` a `version`

#### Vytvoření campaign
```bash
# Uprav test-create-campaign.json - vlož snapshot_id
sam local invoke ApiFunction --event test-create-campaign.json --env-vars .\env.json
```
**Výstup:** `campaign_id` a `public_id`

#### Přidání respondenta
```bash
# Uprav test-add-respondent.json - vlož campaign_id do path
sam local invoke ApiFunction --event test-add-respondent.json --env-vars .\env.json
```
**Výstup:** `token` (respondent access token) - **ulož si ho, nevrací se znovu!**

#### Načtení public survey (jako respondent)
```bash
# Uprav test-get-survey.json - vlož public_id do path a token do X-Respondent-Token header
sam local invoke ApiFunction --event test-get-survey.json --env-vars .\env.json
```
**Výstup:** Kompletní survey_data + respondent info

#### Odeslání odpovědi
```bash
# Uprav test-submit-response.json - vlož public_id do path, token do headeru, data do body
sam local invoke ApiFunction --event test-submit-response.json --env-vars .\env.json
```
**Výstup:** `response_id`, `attempt_no`, `status`, `submitted_at`

#### Zobrazení odpovědí (jako admin)
```bash
sam local invoke ApiFunction --event test-list-responses.json --env-vars .\env.json
```
**Výstup:** Seznam všech odpovědí s daty

## Testovací credentials

### Admin
- Email: `muzikp@gmail.com`
- Password: `Profesor764`

### API Token (dlouhodobý přístup)
Místo JWT tokenu (platnost 1h) můžeš vytvořit API token:

```bash
# 1. Přihlas se a získej JWT
sam local invoke ApiFunction --event test-login-admin.json --env-vars .\env.json

# 2. Vytvoř API token (vlož JWT do test-create-api-token.json)
sam local invoke ApiFunction --event test-create-api-token.json --env-vars .\env.json
```

**Výstup:** `token` (např. `G-Y44Oz86mWTEbNdhheB52qzBJgdaY5v7Bem3C_xmDw`)

**Použití:** Posílej v headeru `X-API-Token` místo `Authorization: Bearer ...`

```json
{
  "headers": {
    "X-API-Token": "G-Y44Oz86mWTEbNdhheB52qzBJgdaY5v7Bem3C_xmDw"
  }
}
```

API token **nikdy nevyprší** (dokud ho nesmazáš) a má definované scopes:
- `templates:read`, `templates:write`
- `snapshots:read`, `snapshots:write`
- `campaigns:read`, `campaigns:write`
- `responses:read`

### Testovací respondent
- Email: `respondent@example.com`
- Token: _generován při přidání do campaign_

## Ověření v databázi

```bash
# Zobrazit všechny tabulky
mysqlsh --sql -u vcagent -pHUIEwhmeAk9I7k7b_Wg8T -h localhost -D evalytics_survey -e "SHOW TABLES"

# Zobrazit templates
mysqlsh --sql -u vcagent -pHUIEwhmeAk9I7k7b_Wg8T -h localhost -D evalytics_survey -e "SELECT template_id, name FROM templates"

# Zobrazit campaigns
mysqlsh --sql -u vcagent -pHUIEwhmeAk9I7k7b_Wg8T -h localhost -D evalytics_survey -e "SELECT campaign_id, LEFT(public_id, 20), title FROM campaigns"

# Zobrazit odpovědi
mysqlsh --sql -u vcagent -pHUIEwhmeAk9I7k7b_Wg8T -h localhost -D evalytics_survey -e "SELECT response_id, status, data FROM responses"
```

## Známé problémy

### SAM local start-api
`sam local start-api` končí předčasně - použij místo toho `sam local invoke` s test event soubory.

### Environment variables
`env.json` obsahuje DB credentials pro Docker container (`host.docker.internal`).

### API Token vs JWT
- **JWT token**: Získáš po přihlášení, platnost 1 hodina, automaticky obsahuje všechna práva podle role
- **API token**: Vytvoříš explicitně, nikdy nevyprší, musíš definovat scopes, ideální pro automatizaci/skripty

## API endpoints summary

### Autentizace
- `POST /auth` - Login (vrací JWT token)
- `GET /auth/me` - Info o přihlášeném uživateli
- `GET /api-tokens` - Seznam API tokenů
- `POST /api-tokens` - Vytvoření API tokenu (vrací plaintext token **pouze jednou**)
- `DELETE /api-tokens/{id}` - Smazání API tokenu

### Admin endpoints (vyžadují JWT nebo API token s příslušným scope)
- `GET /templates`, `POST /templates`, `GET /templates/{id}`, `PUT /templates/{id}`, `DELETE /templates/{id}`
- `GET /snapshots`, `POST /snapshots`, `GET /snapshots/{id}`, `POST /snapshots/{id}`, `DELETE /snapshots/{id}`
- `GET /campaigns`, `POST /campaigns`, `GET /campaigns/{id}`, `PUT /campaigns/{id}`, `DELETE /campaigns/{id}`
- `POST /campaigns/{id}/respondents` - Přidat respondenty (vrací tokeny)
- `POST /campaigns/{id}/send` - Odeslat emaily (placeholder)
- `GET /responses` - Seznam odpovědí s filtry
- `GET /responses/{id}` - Detail odpovědi

### Public endpoints (bez autentizace nebo s respondent tokenem)
- `GET /survey` - Seznam otevřených průzkumů
- `GET /survey/{public_id}` - Detail průzkumu
- `POST /survey/{public_id}/response` - Odeslání odpovědi (vyžaduje X-Respondent-Token)
- `GET /survey/{public_id}/response` - Načtení vlastní odpovědi (vyžaduje X-Respondent-Token)

## Kompletní test flow v jednom

```bash
cd API

# 1. Build
sam build

# 2. Login a získej token
$token = (sam local invoke ApiFunction --event test-login-admin.json --env-vars .\env.json 2>&1 | Select-String '"token"' | ForEach-Object { $_ -match '"token":"([^"]+)"'; $matches[1] })

# 3. Create template
$templateId = (sam local invoke ApiFunction --event test-create-template.json --env-vars .\env.json 2>&1 | Select-String '"template_id"' | ForEach-Object { $_ -match '"template_id":"([^"]+)"'; $matches[1] })

# 4. Create snapshot
# ... atd.

# Kompletní odpovědi viditelné v `sam local invoke ... --event test-list-responses.json`
```

## Public survey endpoint
Public survey je dostupný bez autentizace na:
```
GET /survey/{public_id}
```

S respondent tokenem:
```
GET /survey/{public_id}
X-Respondent-Token: <token>
```

## API dokumentace
Kompletní OpenAPI specifikace: `docs/openapi.yaml`
