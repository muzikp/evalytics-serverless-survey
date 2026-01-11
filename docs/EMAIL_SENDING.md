# Email Sending Implementation

## 📧 Overview

Email rozesílání pro kampaně s podporou:
- **Invitation emails** (první pozvánka)
- **Reminder emails** (připomínka)
- **Unsubscribe links** (odhlášení z emailů)
- **Bounce/complaint handling** (automatický blacklist)
- **Multilingual templates** (CS, EN, DE)

---

## 🗄️ Database Changes (Migration 010)

### 1. `campaigns` table
```sql
ALTER TABLE campaigns 
ADD COLUMN reminder_template JSON NULL 
  COMMENT 'Reminder email template (same structure as email_template)';
```

### 2. `campaign_respondents` table
```sql
ALTER TABLE campaign_respondents 
ADD COLUMN unsubscribe_token VARCHAR(64) NULL UNIQUE
  COMMENT 'Unique token for unsubscribe links';
```

### 3. `email_blacklist` table
```sql
ALTER TABLE email_blacklist 
ADD COLUMN scope ENUM('global', 'campaign') NOT NULL DEFAULT 'global',
ADD COLUMN campaign_id VARCHAR(16) NULL,
ADD COLUMN unsubscribe_all TINYINT(1) NOT NULL DEFAULT 0;
```

**Scopes:**
- `campaign` + `unsubscribe_all=0`: Unsubscribed from specific campaign only
- `global` + `unsubscribe_all=1`: Unsubscribed from all emails

---

## 🔌 API Endpoints

### 1. Send Emails
**POST** `/campaigns/{id}/send`

**Request:**
```json
{
  "type": "invite" | "reminder",
  "respondent_ids": ["R123...", "R456..."],  // Optional
  "test_mode": false  // Optional: preview only
}
```

**Response:**
```json
{
  "queued": 25,
  "skipped": 2,
  "errors": [],
  "message": "Queued 25 invite emails for sending"
}
```

**Logic:**
- `invite`: Only sends to respondents where `invitation_sent_at IS NULL`
- `reminder`: Only sends to respondents where `invitation_sent_at IS NOT NULL`
- Automatically excludes blacklisted emails
- Generates unsubscribe tokens if missing

---

### 2. Unsubscribe
**GET** `/unsubscribe/{token}?scope=campaign|global`

**URL Examples:**
```
https://api.evalytics.cz/v1/survey/unsubscribe/abc123...?scope=campaign
https://api.evalytics.cz/v1/survey/unsubscribe/abc123...?scope=global
```

**Response:** HTML confirmation page

**Actions:**
1. Finds respondent by `unsubscribe_token`
2. Adds email to `email_blacklist` with appropriate scope
3. Shows styled confirmation page

---

## 📧 Email Templates

### Structure (JSON)
```json
{
  "en": {
    "subject": "Survey Invitation: {{company_name}}",
    "body": "<h1>Hello __salutation__</h1><p>Click: __link__</p>"
  },
  "cs": {
    "subject": "Pozvánka k průzkumu: {{company_name}}",
    "body": "<h1>Dobrý den __salutation__</h1><p>Klikněte: __link__</p>"
  }
}
```

### Available Placeholders
- `__link__` → Survey URL with token
- `__email__` → Respondent email
- `__{custom_field}__` → From respondent.data (e.g., `__salutation__`, `__department__`)
- Custom email template fields (multilingual)

### Unsubscribe Footer (Auto-injected)
Automatically added to end of every email in appropriate language:

**Czech:**
```
Pokud již nechcete dostávat upozornění o tomto průzkumu, klikněte sem.
Pokud již nechcete dostávat žádná upozornění z této služby, klikněte sem.
```

---

## ⚙️ Architecture

```
┌─────────────────┐
│ UI (Admin)      │
│ Send Button     │
└────────┬────────┘
         │ POST /campaigns/{id}/send
         v
┌─────────────────────────────────────┐
│ API Lambda (index.js)               │
│ - Validate campaign                 │
│ - Filter respondents                │
│ - Render emails                     │
│ - Enqueue to SQS                    │
└────────┬────────────────────────────┘
         │ SQS Message
         v
┌─────────────────────────────────────┐
│ Email Worker (worker.js)            │
│ - Send via AWS SES                  │
│ - Log to campaign_email_log         │
│ - Update invitation_sent_at         │
└────────┬────────────────────────────┘
         │ SES Events (SNS → SQS)
         v
┌─────────────────────────────────────┐
│ EmailEvents Worker (emailEvents.js) │
│ - Process delivery events           │
│ - Handle bounces/complaints         │
│ - Update email log status           │
│ - Add to blacklist (auto)           │
└─────────────────────────────────────┘
```

---

## 🧪 Testing

### Local Development

**1. Start local MySQL:**
```bash
# Already running
```

**2. Run migration:**
```bash
node utils/sql/run-migration-010.js
```

**3. Start SAM local API:**
```bash
cd API
sam build
sam local start-api --port 3000 --env-vars env.json
```

**4. Test send endpoint:**
```bash
# Login first
curl -X POST http://localhost:3000/auth \
  -H "Content-Type: application/json" \
  -d '{"email": "muzikp@gmail.com", "password": "admin123"}'

# Send test emails
curl -X POST http://localhost:3000/campaigns/{campaign_id}/send \
  -H "Authorization: Bearer {token}" \
  -H "Content-Type: application/json" \
  -d '{"type": "invite", "test_mode": true}'
```

**Note:** V lokále nebudou emaily skutečně odeslány (SES vyžaduje AWS credentials). Pro skutečné testování odeslání použij prod nebo SES sandbox.

---

## 📊 Database Queries

### Check email log
```sql
SELECT * FROM campaign_email_log 
WHERE campaign_id = 'C123...' 
ORDER BY created DESC;
```

### Check blacklist
```sql
SELECT * FROM email_blacklist 
ORDER BY blacklisted_at DESC;
```

### Check delivery events
```sql
SELECT * FROM email_delivery_events 
WHERE provider_message_id = 'ses-message-id'
ORDER BY event_at DESC;
```

### Respondents with invitations sent
```sql
SELECT email, invitation_sent_at, invitation_error
FROM campaign_respondents 
WHERE campaign_id = 'C123...' 
  AND invitation_sent_at IS NOT NULL;
```

---

## 🌍 Environment Variables

### Development (env.json)
```json
{
  "PUBLIC_BASE_URL": "http://localhost:5173",
  "API_BASE_URL": "http://localhost:3000",
  "EMAIL_QUEUE_URL": "http://localhost:9324/queue/email-queue"
}
```

### Production (template.yaml)
```yaml
PUBLIC_BASE_URL: "https://survey.evalytics.cz"
API_BASE_URL: "https://api.evalytics.cz/v1/survey"
EMAIL_QUEUE_URL: !Ref EmailQueue
```

---

## 🔐 Security

✅ **Implemented:**
- Unsubscribe tokens (64 chars random, unique)
- Email blacklist (prevents sending to opt-outs)
- Bounce/complaint auto-blacklist
- HTML escaping in placeholders
- HTTPS only for unsubscribe links
- Audit trail (campaign_email_log + email_delivery_events)

---

## 🚀 Deployment

### 1. Deploy Database Changes
```bash
# Run migration on production DB
node utils/sql/run-migration-010.js
# (Update connection config for prod)
```

### 2. Deploy API
```bash
cd API
sam build
sam deploy --config-env prod
```

### 3. Configure SES
- Verify email domain (evalytics.cz)
- Set up SNS topic for SES events
- Configure event publishing (Bounce, Complaint, Delivery)

---

## 📝 TODO (UI Components)

- [ ] **SendEmailsDialog.svelte** - Dialog pro výběr invite/reminder
- [ ] **EmailStatsCard.svelte** - Zobrazení statistik odeslání
- [ ] Tlačítka v campaign detail page
- [ ] Email log viewer (admin)

---

## 🐛 Known Issues

1. **Local SES testing**: SES requires AWS credentials, lokálně se emaily neodešlou
2. **SQS local**: Pro lokální testování by bylo potřeba localstack nebo elasticmq
3. **Reminder template**: Je potřeba přidat do UI formulář pro reminder template

---

## 📚 References

- AWS SES: https://docs.aws.amazon.com/ses/
- SQS: https://docs.aws.amazon.com/sqs/
- Email best practices: https://aws.amazon.com/ses/best-practices/
