# DNS & Domain Setup Checklist

Rychlý průvodce nastavením DNS pro evalytics.cz po nasazení do AWS.

## ✅ Hotové kroky

- [x] Route53 Hosted Zone vytvořena (ID: Z05603941YHUGCR3H2VON)
- [x] API nasazeno na AWS Lambda (https://4y4wz559kj.execute-api.eu-central-1.amazonaws.com)
- [x] UI build nahrán do S3 (evalytics-survey-ui-prod)
- [x] ACM certifikát vyžádán (us-east-1, arn:aws:acm:us-east-1:959391504404:certificate/d5b1e100-478a-4088-bc69-a5da2d790e62)
- [x] DNS validační CNAME přidán do Route53

## 📋 DNS Záznamy v Route53

### A Records (GitHub Pages)
```
evalytics.cz → 185.199.108.153, 185.199.109.153, 185.199.110.153, 185.199.111.153
```

### CNAME Records
```
www.evalytics.cz → muzikp.github.io
api.evalytics.cz → 4y4wz559kj.execute-api.eu-central-1.amazonaws.com
ri6ngbndo7ou.evalytics.cz → gv-z4fzhnd3uszzny.dv.googlehosted.com
_63b08789464aeed79efd842177c57773.survey.evalytics.cz → _c3ec25ef005b68bf62c61cf08fcdf175.jkddzztszm.acm-validations.aws.
```

### MX Records (Google Workspace)
```
evalytics.cz → 1 aspmx.l.google.com
evalytics.cz → 5 alt1.aspmx.l.google.com
evalytics.cz → 5 alt2.aspmx.l.google.com
evalytics.cz → 10 alt3.aspmx.l.google.com
evalytics.cz → 10 alt4.aspmx.l.google.com
```

### TXT Records
```
evalytics.cz → "google-site-verification=OKBGeKG_gxmeZyLpQUn0McYxr2Nkg5sXDqeenzv4CH8"
evalytics.cz → "v=spf1 include:_spf.google.com ~all"
google._domainkey.evalytics.cz → "v=DKIM1; k=rsa; p=..." (split into 2 parts)
```

## ⏳ Zbývající kroky

### 1. Počkat na validaci ACM certifikátu
Zkontroluj status:
```bash
python -m awscli acm describe-certificate \
  --certificate-arn arn:aws:acm:us-east-1:959391504404:certificate/d5b1e100-478a-4088-bc69-a5da2d790e62 \
  --region us-east-1 \
  --query "Certificate.Status"
```
Čekej na status: `ISSUED` (5-30 minut)

### 2. Vytvořit CloudFront distribuci
V [CloudFront Console](https://console.aws.amazon.com/cloudfront):
- Origin: evalytics-survey-ui-prod.s3.eu-central-1.amazonaws.com
- Origin access: OAC (Origin Access Control)
- CNAME: survey.evalytics.cz
- SSL certificate: Vyber ACM certifikát
- Default root object: index.html
- Error pages: 404 → /index.html (200)

### 3. Přidat S3 Bucket Policy
Po vytvoření CloudFront distribuce zkopíruj doporučenou bucket policy z CloudFront Console a aplikuj ji na S3 bucket.

### 4. Přidat Route53 A Alias záznam
V Route53 Console:
- Record name: `survey`
- Record type: A
- Alias: Yes
- Target: CloudFront distribution

### 5. Přepnout nameservery u Forpsi
V administraci Forpsi nastav nameservery na:
```
ns-1289.awsdns-33.org
ns-370.awsdns-46.com
ns-1679.awsdns-17.co.uk
ns-575.awsdns-07.net
```

**DŮLEŽITÉ:** Před přepnutím zkontroluj, že máš v Route53 VŠECHNY DNS záznamy!

## 🔍 Verifikace

Po dokončení všech kroků a propagaci DNS (24-48h):

```bash
# Test API
curl https://api.evalytics.cz/v1/health

# Test UI
curl -I https://survey.evalytics.cz

# Test DNS
nslookup survey.evalytics.cz
nslookup api.evalytics.cz
nslookup www.evalytics.cz
nslookup evalytics.cz
```

## 📊 Status

| Komponenta | Status | URL |
|-----------|--------|-----|
| API | ✅ Deployed | https://api.evalytics.cz |
| UI Build | ✅ Uploaded | S3: evalytics-survey-ui-prod |
| ACM Certificate | ⏳ Validating | survey.evalytics.cz |
| CloudFront | 📋 Pending | - |
| DNS Records | ✅ Complete | Route53 |
| Nameservers | 📋 Not switched | Forpsi |

## 📝 Poznámky

- **ACM Certifikát musí být v us-east-1** (pro CloudFront)
- **CloudFront propagace trvá 15-20 minut** po vytvoření
- **DNS propagace trvá 24-48 hodin** po přepnutí nameserverů
- **Testuj před přepnutím NS** - všechny služby (email, web) musí fungovat z Route53

---

**Další dokumentace:**
- [Deployment Guide](DEPLOYMENT.md) - Kompletní deployment průvodce
- [Development Guide](DEVELOPMENT.md) - Lokální vývoj
