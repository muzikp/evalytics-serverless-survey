# Deployment Guide

Komplexní průvodce nasazením Evalytics Survey na AWS infrastrukturu.

## 📋 Prerekvizity

- **Node.js** 20+ (`node --version`)
- **AWS CLI** v2 (`aws --version`) nebo Python pip: `pip install awscli`
- **AWS SAM CLI** (`sam --version`)
- **AWS Account** s konfigurovanými credentials
- **Route53 Hosted Zone** (pro custom doménu)
- **Doménový registrátor** (např. Forpsi, GoDaddy)

## 🔧 1. Konfigurace

### A. AWS Credentials

```bash
aws configure
# AWS Access Key ID: <your-key>
# AWS Secret Access Key: <your-secret>
# Default region: eu-central-1
# Default output format: json
```

### B. Environment Variables

Vytvoř `.env` v root adresáři:

```env
# AWS Configuration
AWS_ACCESS_KEY=your_access_key
AWS_SECRET_KEY=your_secret_key
AWS_REGION=eu-central-1

# Production Database (RDS or external)
MYSQL_PROD_HOST=your-rds-endpoint.rds.amazonaws.com
MYSQL_PROD_PORT=3306
MYSQL_PROD_USER=admin
MYSQL_PROD_PASSWORD=strong_password
MYSQL_PROD_DATABASE=evalytics_survey

# Admin Credentials
ADMIN_EMAIL=admin@evalytics.cz
ADMIN_PASSWORD=SecurePassword123

# AWS SES (verified email/domain)
SES_SENDER_EMAIL=noreply@evalytics.cz
SES_VERIFIED_DOMAIN=evalytics.cz

# API Configuration
API_STAGE=prod
API_STACK_NAME=evalytics-survey-api-prod
```

---

## 🚀 2. API Deployment (AWS Lambda + API Gateway)

### Automatické nasazení (PowerShell)

```powershell
# Kompletní deploy (UI + API)
.\scripts\deploy.ps1

# Pouze API
.\scripts\deploy.ps1 -SkipUI

# Pouze UI
.\scripts\deploy.ps1 -SkipAPI
```

### Manuální nasazení

```bash
cd API

# 1. Validate SAM template
sam validate

# 2. Build
sam build

# 3. Deploy
sam deploy \
  --stack-name evalytics-survey-api-prod \
  --region eu-central-1 \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides \
    MySqlHost=$MYSQL_PROD_HOST \
    MySqlPort=$MYSQL_PROD_PORT \
    MySqlUser=$MYSQL_PROD_USER \
    MySqlPassword=$MYSQL_PROD_PASSWORD \
    MySqlDatabase=$MYSQL_PROD_DATABASE \
    AdminEmail=$ADMIN_EMAIL \
    AdminPassword=$ADMIN_PASSWORD \
    SesSenderEmail=$SES_SENDER_EMAIL
```

### CloudFormation Outputs

Po úspěšném deploye získáš:

```
ApiEndpoint: https://<api-id>.execute-api.eu-central-1.amazonaws.com
```

Poznamenej si **API URL** pro další kroky.

---

## 🌐 3. UI Deployment (CloudFront + S3)

### A. Build UI

```bash
cd UI
npm run build
# Output: UI/build/
```

### B. S3 Bucket Setup

```bash
# Vytvoř S3 bucket pro statický web
aws s3 mb s3://evalytics-survey-ui-prod --region eu-central-1

# Upload build
aws s3 sync build/ s3://evalytics-survey-ui-prod --delete
```

**Pro AWS CLI přes Python:**
```bash
python -m awscli s3 mb s3://evalytics-survey-ui-prod --region eu-central-1
python -m awscli s3 sync UI/build/ s3://evalytics-survey-ui-prod --delete
```

### C. Request ACM Certificate

**DŮLEŽITÉ:** Certifikát pro CloudFront musí být v **us-east-1** (ne eu-central-1)!

```bash
# Request certificate
aws acm request-certificate \
  --domain-name survey.evalytics.cz \
  --validation-method DNS \
  --region us-east-1

# Output: CertificateArn
```

Poznamenej si **Certificate ARN**.

### D. DNS Validation (Route53)

1. Získej validační CNAME:
```bash
aws acm describe-certificate \
  --certificate-arn <certificate-arn> \
  --region us-east-1
```

2. Přidej CNAME záznam do Route53 (v **AWS Console** je jednodušší):

V Route53 Console → Hosted zones → evalytics.cz → **Create record**:
- Record name: `_<validation-string>.survey` (např. `_63b08789464aeed79efd842177c57773.survey`)
- Record type: **CNAME**
- Value: `<validation-cname-value>` (např. `_c3ec25ef005b68bf62c61cf08fcdf175.jkddzztszm.acm-validations.aws.`)
- TTL: 300

3. Počkej 5-30 minut na validaci certifikátu.

### E. CloudFront Distribution

Vytvoř CloudFront distribuci v **AWS Console** (jednodušší než CLI):

1. Otevři [CloudFront Console](https://console.aws.amazon.com/cloudfront)
2. **Create Distribution** → **Origin Settings**:
   - Origin domain: `evalytics-survey-ui-prod.s3.eu-central-1.amazonaws.com`
   - Origin access: **Origin Access Control (OAC)** - Create new OAC
3. **Default Cache Behavior**:
   - Viewer protocol policy: **Redirect HTTP to HTTPS**
   - Allowed HTTP methods: **GET, HEAD**
   - Cache policy: **CachingOptimized**
4. **Settings**:
   - Alternate domain names (CNAMEs): `survey.evalytics.cz`
   - Custom SSL certificate: Vyber svůj ACM certifikát
   - Default root object: `index.html`
5. **Error Pages** (pro SPA routing):
   - Error code: **404**
   - Response page path: `/index.html`
   - HTTP Response code: **200**
6. **Create Distribution**

### F. S3 Bucket Policy (pro CloudFront OAC)

Po vytvoření CloudFront distribuce zkopíruj doporučenou S3 bucket policy z CloudFront console a aplikuj ji na S3 bucket v S3 Console.

### G. Route53 A Alias Record

Přidej A Alias záznam pro svou doménu v Route53 Console:

- Record name: `survey` (pro survey.evalytics.cz)
- Record type: **A**
- Alias: **Yes**
- Route traffic to: **Alias to CloudFront distribution**
- Distribution: Vyber svou CloudFront distribuci

---

## 🌍 4. DNS Setup (Route53)

### A. Route53 Hosted Zone

Pokud ještě nemáš hosted zónu:

```bash
aws route53 create-hosted-zone \
  --name evalytics.cz \
  --caller-reference $(date +%s)
```

Poznamenej si **Zone ID** a **4 nameservery**.

### B. Kompletní DNS záznamy

Potřebné záznamy pro plnou funkčnost:

#### 1. A záznamy (root doména)

Pokud máš jiný web na evalytics.cz (např. GitHub Pages):

V Route53 Console:
- Record name: (prázdné - pro root evalytics.cz)
- Record type: **A**
- Value (každá IP na samostatný řádek):
```
185.199.108.153
185.199.109.153
185.199.110.153
185.199.111.153
```
- TTL: 1800

#### 2. CNAME záznamy

**www subdomain:**
- Record name: `www`
- Record type: **CNAME**
- Value: `muzikp.github.io`
- TTL: 1800

**API subdomain:**
- Record name: `api`
- Record type: **CNAME**
- Value: `<api-gateway-id>.execute-api.eu-central-1.amazonaws.com` (bez https://)
- TTL: 300

**Google Domain Verification** (pokud používáš Google Workspace):
- Record name: `ri6ngbndo7ou` (tvůj verification string)
- Record type: **CNAME**
- Value: `gv-z4fzhnd3uszzny.dv.googlehosted.com` (tvůj verification target)
- TTL: 1800

#### 3. MX záznamy (Google Workspace)

- Record name: (prázdné - pro root evalytics.cz)
- Record type: **MX**
- Value (každý na samostatný řádek s prioritou):
```
1 aspmx.l.google.com
5 alt1.aspmx.l.google.com
5 alt2.aspmx.l.google.com
10 alt3.aspmx.l.google.com
10 alt4.aspmx.l.google.com
```
- TTL: 3600

#### 4. TXT záznamy (Google Workspace + SPF)

- Record name: (prázdné - pro root evalytics.cz)
- Record type: **TXT**
- Value (každá hodnota na samostatný řádek v uvozovkách):
```
"google-site-verification=<your-verification-code>"
"v=spf1 include:_spf.google.com ~all"
```
- TTL: 1800

**POZNÁMKA:** Pro jednu doménu můžeš mít JEN JEDEN TXT záznam, ale ten záznam může obsahovat VÍCE hodnot.

#### 5. DKIM (Google Workspace)

- Record name: `google._domainkey`
- Record type: **TXT**
- Value (rozdělen kvůli 255 char limitu - každá část v uvozovkách, odděleno mezerou):
```
"v=DKIM1; k=rsa; p=MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA2a4MCNekryxhDguWeMhityPI4PBi/Ecji5zOzCNOYuqzooizJBGLOj3W6SreQyXNiz8qZotucRRpSNVrUL/jUX4iqu3Z0iconh2pqQJKOag1yJyiFPLhHnHwR6fPjq6mWd30+6NHWiCYAhlI+Pk/AFdq2hdf8vmO6iFCfb" "ZaT8M5rqdbp1xR3xDFNCpNFLv8Lh9LFn9XSNn0sEGkqndpP2mi14FINlC77HTfw9TM8RRE21LiAsqqsOSI8hbuO0N7NBt37i11vRjpPDnkxNA+p7+plfLif/5rDXfANt6Pvzwrj4Ihcy+0uAqp3Dmt7i11GrgKKLjm7hWitpgYMLLZuQIDAQAB"
```
- TTL: 1800

**POZNÁMKA:** Dlouhé TXT záznamy musí být rozděleny na 255-char části. Každá část je v samostatných uvozovkách s mezerou mezi nimi. AWS Route53 je automaticky spojí při DNS dotazu.

### C. Přepnutí Nameserverů u Registrátora

U svého doménového registrátora (Forpsi, GoDaddy, etc.) nastav nameservery na Route53:

```
ns-1289.awsdns-33.org
ns-370.awsdns-46.com
ns-1679.awsdns-17.co.uk
ns-575.awsdns-07.net
```

**DŮLEŽITÉ:** Před přepnutím nameserverů zkontroluj, že máš v Route53 **VŠECHNY** DNS záznamy, které máš u registrátora, jinak ti přestanou fungovat!

**Propagace DNS trvá 24-48 hodin** (obvykle pár hodin).

---

## ✅ 5. Verifikace

### A. API Endpoint

```bash
curl https://api.evalytics.cz/v1/health
# Expected: {"status": "ok"}
```

### B. UI Dostupnost

```bash
curl -I https://survey.evalytics.cz
# Expected: 200 OK
```

### C. Email Funkčnost

Otestuj odeslání emailu přes admin rozhraní:
```
https://survey.evalytics.cz/admin
```

### D. DNS Propagace

```bash
nslookup survey.evalytics.cz
nslookup api.evalytics.cz
nslookup evalytics.cz
```

---

## 🔄 6. Continuous Deployment (GitHub Actions)

### A. GitHub Secrets

Přidej do **Settings → Secrets and variables → Actions**:

```
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
MYSQL_PROD_HOST
MYSQL_PROD_PORT
MYSQL_PROD_USER
MYSQL_PROD_PASSWORD
MYSQL_PROD_DATABASE
ADMIN_EMAIL
ADMIN_PASSWORD
SES_SENDER_EMAIL
```

### B. Workflows

Workflows jsou již nakonfigurovány v `.github/workflows/`:

- **deploy-api.yml** - Deploy API při push do `main`
- **deploy-ui.yml** - Deploy UI při push do `main`

---

## 🛠️ 7. Údržba a Monitoring

### A. CloudWatch Logs

```bash
# API Lambda logs
aws logs tail /aws/lambda/evalytics-survey-ApiFunction --follow

# Email worker logs
aws logs tail /aws/lambda/evalytics-survey-EmailWorkerFunction --follow
```

### B. CloudFront Invalidation

Po update UI:

```bash
aws cloudfront create-invalidation \
  --distribution-id <distribution-id> \
  --paths "/*"
```

### C. Database Backups

Pro RDS:
- Automatické snapshoty (7-35 dní retention)
- Manuální snapshoty před velkými změnami

### D. SES Delivery Audit

Aby fungoval audit doručení:
1) V AWS SES nastav **configuration set** a **event destination** (delivery/bounce/complaint) do SNS topicu `SesEventsTopic` vytvořeného SAM templatem.
2) SNS přeposílá do SQS `SesEventsQueue` a zpracuje to `EmailEventWorkerFunction`.
3) Worker ukládá eventy do DB (`email_delivery_events`) a aktualizuje `campaign_email_log`.

---

## 📊 8. Cost Estimates

**Měsíční náklady (při 10K dotazníků/měsíc):**

- Lambda: ~$5 (1M requests free tier)
- API Gateway: ~$3.50
- S3: ~$1 (5GB storage)
- CloudFront: ~$1 (10GB transfer free tier)
- RDS db.t3.micro: ~$15-20
- Route53: $0.50/hosted zone + $0.40/million queries
- SES: $0 (62K emails/month free tier)

**Celkem: ~$25-30/měsíc**

---

## 🚨 Troubleshooting

### API Deploy Fails

```bash
# Check SAM template
sam validate

# Check CloudFormation events
aws cloudformation describe-stack-events \
  --stack-name evalytics-survey-api-prod \
  --max-items 10
```

### CloudFront 403 Errors

- Zkontroluj S3 bucket policy (CloudFront OAC přístup)
- Zkontroluj Default Root Object: `index.html`

### Certificate Validation Stuck

- Zkontroluj DNS validační CNAME v Route53
- Může trvat až 30 minut

### Email Delivery Issues

- Zkontroluj SES verified domain/email
- Zkontroluj SES sending quota (sandbox = 200 emails/day)
- Request production access: [AWS SES Console](https://console.aws.amazon.com/ses)

### DNS Not Resolving

- Zkontroluj, že nameservery jsou správně nastaveny u registrátora
- DNS propagace může trvat až 48 hodin
- Použij `dig` nebo `nslookup` pro testování

---

## 📚 Další dokumentace

- [Development Guide](DEVELOPMENT.md) - Lokální vývoj
- [API Specification](openapi.yaml) - OpenAPI 3.0
- [Architecture](SPEC.md) - Technické detaily
