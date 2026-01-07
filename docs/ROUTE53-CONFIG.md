# Route53 Configuration Guide

Tento dokument obsahuje pokyny pro nastavení DNS záznamů v AWS Route53 pro produkční prostředí Evalytics Survey.

## Požadované Domény

```
evalytics.cz (nebo jiná doména)
├── survey.evalytics.cz → UI (CloudFront nebo GitHub Pages)
└── api.evalytics.cz → API Gateway (AWS Lambda)
```

## Postup Konfigurace

### 1. Hosted Zone

Pokud ještě nemáš hosted zone pro `evalytics.cz`:

```bash
aws route53 create-hosted-zone \
  --name evalytics.cz \
  --caller-reference $(date +%s) \
  --hosted-zone-config Comment="Evalytics Survey Production"
```

**Výstup:**
- Poznamenat si **Zone ID** (např. `Z1234567890ABC`)
- Poznamenat si **Name Servers** (4 NS záznamy)

**DŮLEŽITÉ:** U svého registrátora domény (např. Wedos, Forpsi) nastavit Name Servery z AWS Route53.

---

### 2. API Endpoint (api.evalytics.cz)

Po deployment API pomocí `deploy.ps1` získáš API Gateway URL ve formátu:

```
https://abcd1234.execute-api.eu-central-1.amazonaws.com
```

#### Varianta A: CNAME (jednodušší)

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
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

**Poznámka:** Nahraď `<ZONE_ID>` a `abcd1234...` skutečnou hodnotou z deployment výstupu.

#### Varianta B: Custom Domain (API Gateway) - Doporučeno pro produkci

1. **Vytvoř Custom Domain v API Gateway:**

```bash
aws apigatewayv2 create-domain-name \
  --domain-name api.evalytics.cz \
  --domain-name-configurations CertificateArn=<ACM_CERTIFICATE_ARN>
```

**Prerekvizita:** ACM (AWS Certificate Manager) certifikát pro `*.evalytics.cz` nebo `api.evalytics.cz` v regionu `eu-central-1`.

2. **Vytvoř API Mapping:**

```bash
aws apigatewayv2 create-api-mapping \
  --domain-name api.evalytics.cz \
  --api-id <API_ID> \
  --stage '$default'
```

3. **Vytvoř A Alias záznam v Route53:**

```bash
# Nejdřív získej Target Domain Name z API Gateway custom domain
aws apigatewayv2 get-domain-name --domain-name api.evalytics.cz

# Pak vytvoř Alias záznam
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "api.evalytics.cz",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "<API_GATEWAY_HOSTED_ZONE_ID>",
          "DNSName": "<API_GATEWAY_TARGET_DOMAIN>",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

**Poznámka:** `API_GATEWAY_HOSTED_ZONE_ID` je specifický pro region (pro eu-central-1 je to např. `Z1U9ULNL0V5AJ3`).

---

### 3. UI Endpoint (survey.evalytics.cz)

#### Varianta A: GitHub Pages (pokud používáš GitHub Pages)

1. V GitHub repo nastav Custom Domain v **Settings → Pages → Custom domain**: `survey.evalytics.cz`
2. GitHub vytvoří CNAME soubor v root
3. V Route53 vytvoř CNAME záznam:

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "survey.evalytics.cz",
        "Type": "CNAME",
        "TTL": 300,
        "ResourceRecords": [{"Value": "yourusername.github.io"}]
      }
    }]
  }'
```

#### Varianta B: CloudFront + S3 (doporučeno pro produkci)

1. **Upload buildu do S3:**

```bash
cd UI
npm run build
aws s3 sync build/ s3://evalytics-survey-ui-prod --delete
```

2. **Vytvoř CloudFront distribuci:**

```bash
aws cloudfront create-distribution \
  --origin-domain-name evalytics-survey-ui-prod.s3.amazonaws.com \
  --default-root-object index.html \
  --viewer-certificate ACMCertificateArn=<ACM_CERTIFICATE_ARN>,SSLSupportMethod=sni-only
```

**Prerekvizita:** ACM certifikát v **us-east-1** pro CloudFront.

3. **Vytvoř A Alias záznam:**

```bash
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch '{
    "Changes": [{
      "Action": "CREATE",
      "ResourceRecordSet": {
        "Name": "survey.evalytics.cz",
        "Type": "A",
        "AliasTarget": {
          "HostedZoneId": "Z2FDTNDATAQYW2",
          "DNSName": "<CLOUDFRONT_DOMAIN>",
          "EvaluateTargetHealth": false
        }
      }
    }]
  }'
```

**Poznámka:** `Z2FDTNDATAQYW2` je vždy hosted zone ID pro CloudFront.

---

### 4. SSL/TLS Certifikáty (ACM)

#### Pro API Gateway (eu-central-1):

```bash
aws acm request-certificate \
  --domain-name api.evalytics.cz \
  --validation-method DNS \
  --region eu-central-1
```

#### Pro CloudFront (us-east-1):

```bash
aws acm request-certificate \
  --domain-name survey.evalytics.cz \
  --subject-alternative-names '*.evalytics.cz' \
  --validation-method DNS \
  --region us-east-1
```

Po vytvoření certifikátu:
1. AWS ACM vrátí CNAME záznamy pro DNS validaci
2. Přidej je do Route53
3. Počkej cca 5-30 minut na validaci
4. Certifikát bude ve stavu **Issued**

---

## Ověření Konfigurace

### DNS Propagace

```bash
# Check API DNS
dig api.evalytics.cz
nslookup api.evalytics.cz

# Check UI DNS
dig survey.evalytics.cz
nslookup survey.evalytics.cz
```

### SSL Certifikáty

```bash
# Check API SSL
curl -I https://api.evalytics.cz/health

# Check UI SSL
curl -I https://survey.evalytics.cz
```

### API Health Check

```bash
# Pokud máš /health endpoint
curl https://api.evalytics.cz/health

# Nebo test nějakého základního endpointu
curl -H "Authorization: Bearer YOUR_API_TOKEN" \
  https://api.evalytics.cz/api/forms
```

---

## Troubleshooting

### DNS nefunguje

**Problém:** `NXDOMAIN` nebo `SERVFAIL`

**Řešení:**
1. Zkontroluj Name Servery u registrátora domény
2. Počkej 24-48 hodin na propagaci NS záznamů
3. Ověř Zone ID: `aws route53 list-hosted-zones`

### SSL Certificate Invalid

**Problém:** `NET::ERR_CERT_AUTHORITY_INVALID`

**Řešení:**
1. Zkontroluj stav certifikátu: `aws acm describe-certificate --certificate-arn <ARN>`
2. Ověř, že certifikát je ve stavu **Issued**
3. Pro CloudFront: certifikát MUSÍ být v **us-east-1**
4. Pro API Gateway: certifikát MUSÍ být ve stejném regionu jako API (eu-central-1)

### CloudFront 403 Forbidden

**Problém:** `AccessDenied` nebo `403 Forbidden`

**Řešení:**
1. Zkontroluj S3 bucket policy (musí povolit GetObject pro CloudFront)
2. Zkontroluj Origin Access Identity (OAI) nastavení
3. Ověř Default Root Object (`index.html`)

### API Gateway 5xx Errors

**Problém:** Lambda vrací chyby

**Řešení:**
1. Zkontroluj CloudWatch Logs: `/aws/lambda/evalytics-survey-api-prod-ApiFunction-*`
2. Ověř environment variables v Lambda (DB_HOST, DB_PASSWORD atd.)
3. Zkontroluj Security Group pro RDS (musí povolit 3306 z Lambda)

---

## Automatizace (PowerShell Script)

Můžeš vytvořit `setup-route53.ps1` pro automatizaci:

```powershell
# setup-route53.ps1
param(
    [string]$ZoneId,
    [string]$ApiEndpoint,
    [string]$UiEndpoint
)

# API CNAME
aws route53 change-resource-record-sets `
  --hosted-zone-id $ZoneId `
  --change-batch "{
    `"Changes`": [{
      `"Action`": `"UPSERT`",
      `"ResourceRecordSet`": {
        `"Name`": `"api.evalytics.cz`",
        `"Type`": `"CNAME`",
        `"TTL`": 300,
        `"ResourceRecords`": [{`"Value`": `"$ApiEndpoint`"}]
      }
    }]
  }"

# UI CNAME
aws route53 change-resource-record-sets `
  --hosted-zone-id $ZoneId `
  --change-batch "{
    `"Changes`": [{
      `"Action`": `"UPSERT`",
      `"ResourceRecordSet`": {
        `"Name`": `"survey.evalytics.cz`",
        `"Type`": `"CNAME`",
        `"TTL`": 300,
        `"ResourceRecords`": [{`"Value`": `"$UiEndpoint`"}]
      }
    }]
  }"

Write-Host "✓ Route53 records created/updated"
```

**Použití:**

```powershell
.\setup-route53.ps1 `
  -ZoneId Z1234567890ABC `
  -ApiEndpoint abcd1234.execute-api.eu-central-1.amazonaws.com `
  -UiEndpoint yourusername.github.io
```

---

## Reference

- [AWS Route53 Documentation](https://docs.aws.amazon.com/route53/)
- [ACM Certificate Validation](https://docs.aws.amazon.com/acm/latest/userguide/dns-validation.html)
- [API Gateway Custom Domains](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html)
- [CloudFront with S3](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/GettingStarted.SimpleDistribution.html)
