# Deployment Scripts

PowerShell skripty pro automatizaci deploymentu a správy infrastruktury.

## 🚀 Hlavní Skripty

### `deploy.ps1`
Kompletní deployment UI a API do produkce.

```powershell
# Kompletní deploy (UI + API)
.\deploy.ps1

# Pouze UI (build + git push)
.\deploy.ps1 -SkipAPI

# Pouze API (SAM build + deploy)
.\deploy.ps1 -SkipUI

# S custom commit message
.\deploy.ps1 -CommitMessage "feat: new feature"
```

**Požadavky:**
- `.env` soubor s AWS credentials a DB config
- AWS SAM CLI nainstalován
- Git configured

### `init-database.ps1`
Inicializace MySQL databáze včetně demo dat.

```powershell
# Lokální dev databáze s demo daty
.\init-database.ps1

# Bez demo dat
.\init-database.ps1 -SkipDemoData

# Produkční databáze
.\init-database.ps1 -Environment prod -SkipDemoData
```

**Požadavky:**
- MySQL server běžící
- `.env` s MYSQL_DEV_* nebo MYSQL_PROD_* credentials

## 🌐 DNS & Infrastruktura

### `setup-route53.ps1`
Automatizace Route53 DNS záznamů.

```powershell
.\setup-route53.ps1 `
  -ZoneId Z05603941YHUGCR3H2VON `
  -ApiEndpoint "4y4wz559kj.execute-api.eu-central-1.amazonaws.com" `
  -UiEndpoint "muzikp.github.io"
```

### `setup-cloudfront.ps1`
Zjednodušený helper pro CloudFront setup.

```powershell
.\setup-cloudfront.ps1 `
  -BucketName evalytics-survey-ui-prod `
  -DomainName survey.evalytics.cz `
  -Route53ZoneId Z05603941YHUGCR3H2VON
```

**Poznámka:** Tento skript pouze zobrazuje instrukce pro manuální setup v AWS Console.

### `migrate-dns.ps1`
Migrace všech DNS záznamů z Forpsi do Route53.

```powershell
.\migrate-dns.ps1
```

Přidává:
- A záznamy (GitHub Pages)
- CNAME záznamy (www, api, Google verification)
- MX záznamy (Google Workspace)
- TXT záznamy (SPF, site verification)

## 📁 Dočasné Soubory

Složka `scripts/` obsahuje také dočasné JSON soubory vytvořené během běhu skriptů:
- `*.json` - AWS CLI batch operace
- Tyto soubory jsou v `.gitignore`

## 🔧 VS Code Integrace

Všechny skripty jsou integrovány do VS Code tasks (`.vscode/tasks.json`):
- `Ctrl+Shift+P` → "Tasks: Run Task"
- Nebo použij Launch Configuration (F5)

**Příklady tasků:**
- 🚢 Deploy ALL (UI + API)
- 🗄️ Init Database (Dev)
- ☁️ Setup CloudFront + S3
- 🚀 Start Dev (API + UI)

## 📚 Dokumentace

Detailní dokumentace k deploymentu:
- [Deployment Guide](../docs/DEPLOYMENT.md)
- [DNS Setup Status](../docs/DNS-SETUP-STATUS.md)
- [Development Guide](../docs/DEVELOPMENT.md)
