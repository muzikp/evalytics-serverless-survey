# Quick Start Guide

Návod pro rychlé spuštění Evalytics Survey aplikace lokálně i v produkci.

## Prerekvizity

- **Node.js** 20+ (`node --version`)
- **MySQL** 8+ (`mysql --version`)
- **AWS CLI** (`aws --version`) - pro produkční deployment
- **AWS SAM CLI** (`sam --version`) - pro API deployment
- **PowerShell** 7+ (`$PSVersionTable.PSVersion`) - pro Windows scripty

## 1️⃣ První instalace (lokálně)

### A. Klonování a instalace závislostí

```bash
git clone https://github.com/yourusername/evalytics-serverless-survey.git
cd evalytics-serverless-survey

# Install root dependencies
npm install

# Install API dependencies
cd API
npm install
cd ..

# Install UI dependencies
cd UI
npm install
cd ..
```

### B. Konfigurace `.env`

Vytvoř `.env` v root adresáři:

```env
# Development Database
MYSQL_DEV_HOST=localhost
MYSQL_DEV_PORT=3306
MYSQL_DEV_USER=vcagent
MYSQL_DEV_PASSWORD=YOUR_PASSWORD
MYSQL_DEV_DATABASE=evalytics_survey

# Admin Credentials
ADMIN_EMAIL=admin@evalytics.cz
ADMIN_PASSWORD=SecurePassword123

# JWT Secret
JWT_SECRET=change-this-to-random-string

# AWS (pro lokální vývoj zatím nepovinné)
AWS_REGION=eu-central-1
SES_FROM_EMAIL=info@evalytics.cz
```

### C. Inicializace databáze

```powershell
# Windows (PowerShell)
.\init-database.ps1

# Linux/Mac (Bash) - TODO: vytvořit init-database.sh
bash init-database.sh
```

**Co to udělá:**
- ✅ Vytvoří databázi `evalytics_survey`
- ✅ Vytvoří 12 tabulek (users, forms, campaigns atd.)
- ✅ Vytvoří admin uživatele (ADMIN001)
- ✅ Vloží demo NPS survey

**Výstup:**

```
[1/4] Creating database...
✓ Database created/verified

[2/4] Initializing schema...
✓ 12 tables created

[3/4] Creating admin user...
✓ Admin user created (ADMIN001)

[4/4] Inserting demo data...
✓ NPS Survey inserted

✅ DATABASE INITIALIZATION COMPLETE!
```

### D. Spuštění aplikace

**Terminál 1: API (SAM local)**

```bash
npm run sam:local
```

**Výstup:**

```
Mounting ApiFunction at http://127.0.0.1:3000/{proxy+}
You can now browse to http://127.0.0.1:3000/health
```

**Terminál 2: UI (Vite dev server)**

```bash
cd UI
npm run dev
```

**Výstup:**

```
VITE v6.0.0  ready in 1234 ms
➜  Local:   http://localhost:5174/
```

### E. Přihlášení

Otevři [http://localhost:5174](http://localhost:5174) a přihlas se:

- **Email:** `admin@evalytics.cz` (z .env ADMIN_EMAIL)
- **Password:** `SecurePassword123` (z .env ADMIN_PASSWORD)

---

## 2️⃣ Produkční deployment

### A. Konfigurace produkční databáze

V `.env` přidej produkční credentials (např. AWS RDS):

```env
# Production Database
MYSQL_PROD_HOST=evalytics.ccjtwm5m8s71.eu-central-1.rds.amazonaws.com
MYSQL_PROD_PORT=3306
MYSQL_PROD_USER=vcagent
MYSQL_PROD_PASSWORD=PROD_PASSWORD
MYSQL_PROD_DATABASE=ess_v1

# AWS Credentials
AWS_ACCOUNT_ID=123456789012
AWS_ACCESS_KEY=AKIA...
AWS_SECRET_KEY=...
```

### B. Inicializace produkční databáze

```powershell
# POZOR: Toto vytvoří schéma v produkční databázi!
.\init-database.ps1 -Environment prod -SkipDemoData
```

**Poznámka:** `-SkipDemoData` vynechá demo NPS survey (doporučeno pro produkci).

### C. Deployment UI + API

```powershell
# Deploy obojí (UI na GitHub, API na AWS Lambda)
.\deploy.ps1

# Pouze API
.\deploy.ps1 -SkipUI

# Pouze UI
.\deploy.ps1 -SkipAPI
```

**Výstup:**

```
[1/2] 🎨 DEPLOYING UI
📦 Building UI...
✓ UI build complete
📤 Pushing to GitHub...
✓ Pushed to GitHub

[2/2] 🚀 DEPLOYING API
🔨 Building SAM application...
✓ SAM build complete
🚀 Deploying to AWS Lambda...
✓ API deployed successfully
✓ API URL: https://abcd1234.execute-api.eu-central-1.amazonaws.com

✅ DEPLOYMENT COMPLETE!
```

### D. DNS konfigurace (Route53)

Po prvním deployment nakonfiguruj DNS podle [docs/ROUTE53-CONFIG.md](docs/ROUTE53-CONFIG.md):

1. **API:** `api.evalytics.cz` → API Gateway endpoint
2. **UI:** `survey.evalytics.cz` → CloudFront nebo GitHub Pages

**Rychlý setup (CNAME):**

```bash
# API
aws route53 change-resource-record-sets \
  --hosted-zone-id Z1234567890ABC \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.evalytics.cz",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "abcd1234.execute-api.eu-central-1.amazonaws.com"}]
      }
    }]
  }'
```

---

## 3️⃣ Ověření funkčnosti

### Lokální

```bash
# API health check
curl http://localhost:3000/health

# UI v prohlížeči
open http://localhost:5174
```

### Produkční

```bash
# API health check
curl https://api.evalytics.cz/health

# UI v prohlížeči
open https://survey.evalytics.cz
```

---

## 4️⃣ Časté problémy

### "Cannot connect to MySQL"

**Řešení:**
1. Zkontroluj, že MySQL server běží: `mysql -u vcagent -p`
2. Zkontroluj credentials v `.env`
3. Ověř, že databáze existuje: `SHOW DATABASES;`

### "Admin user already exists"

**Řešení:**
1. Buď přeskoč create-admin: upravit `init-database.ps1` a zakomentovat step 3
2. Nebo smaž stávajícího admina: `DELETE FROM users WHERE user_id = 'ADMIN001';`

### SAM deploy selhává

**Řešení:**
1. Zkontroluj AWS credentials: `aws sts get-caller-identity`
2. Zkontroluj SAM CLI: `sam --version` (min. 1.0.0)
3. Zkontroluj region v `.env`: `AWS_REGION=eu-central-1`

### DNS nefunguje (Route53)

**Řešení:**
1. Počkej 24-48h na propagaci NS záznamů
2. Ověř Name Servery u registrátora domény
3. Zkontroluj hosted zone: `aws route53 list-hosted-zones`

---

## 5️⃣ Další kroky

- **Dokumentace API:** [docs/openapi.yaml](docs/openapi.yaml)
- **Vývoj workflow:** [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)
- **Produkční deployment:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Route53 setup:** [docs/ROUTE53-CONFIG.md](docs/ROUTE53-CONFIG.md)

---

## 6️⃣ Podpora

Pro další pomoc:
1. Zkontroluj [docs/](docs/) složku
2. Podívej se na [GitHub Issues](https://github.com/yourusername/evalytics-serverless-survey/issues)
3. Kontaktuj tým: info@evalytics.cz
