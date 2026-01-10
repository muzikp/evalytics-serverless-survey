# Auto-Save Feature - Change Log

**Datum:** 2026-01-10  
**Autor:** muzikp  
**Verze:** 1.0.0

## Přehled změn

Implementována konfigurovatelná auto-save funkce pro průzkumy na úrovni kampaně.

## Databázové změny

### Migration 009: `auto_save_interval_seconds`

**Soubor:** `utils/sql/009_add_auto_save_interval.sql`

```sql
ALTER TABLE campaigns
ADD COLUMN auto_save_interval_seconds INT NULL DEFAULT 10
COMMENT 'Interval průběžného ukládání v sekundách (NULL = vypnuto, default 10)'
AFTER max_attempts;
```

**Parametry:**
- **Typ:** `INT NULL`
- **Default:** `10` (sekund)
- **NULL:** Vypíná auto-save
- **0 nebo záporné:** Vypíná auto-save

## Backend změny

### API Response Update

**Soubor:** `API/src/handlers/public.js`

**Endpoint:** `GET /survey/{publicId}`

**Změna:** Přidáno pole `auto_save_interval_seconds` do response:

```javascript
return apiResponse(200, {
  public_id: campaign.public_id,
  title: campaign.title,
  survey_data: campaign.form_data,
  auto_save_interval_seconds: campaign.auto_save_interval_seconds, // NEW
  // ... ostatní fields
});
```

## Frontend změny

### UI Survey Component

**Soubor:** `UI/src/routes/survey/[publicId]/+page.svelte`

**Změny:**

1. **Nová state proměnná:**
```javascript
let autoSaveIntervalSeconds = null; // Configurable interval from campaign
```

2. **Načtení z API:**
```javascript
const data = await res.json();
campaignData = data;
autoSaveIntervalSeconds = data.auto_save_interval_seconds;
```

3. **Podmíněné spuštění auto-save:**
```javascript
function handleValueChanged(sender, options) {
  // Skip if disabled
  if (!autoSaveIntervalSeconds || autoSaveIntervalSeconds <= 0) {
    return;
  }

  // Schedule auto-save after configured interval
  if (autoSaveTimer) clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(() => {
    autoSave(sender);
  }, autoSaveIntervalSeconds * 1000);
}
```

## Testování

### Test Suite

**Soubor:** `API/test-auto-save-config.js`

**Testy:**
- ✅ Column existence and schema validation
- ✅ Default value verification (10 seconds)
- ✅ NULL disables auto-save
- ✅ Custom intervals (5s, 10s, 30s, 60s)
- ✅ Zero value disables auto-save

**Výsledky:**
```
✅ All tests passed!

📝 Summary:
   - Column auto_save_interval_seconds exists
   - Default value: 10 seconds
   - NULL disables auto-save
   - 0 or negative disables auto-save
   - Positive values set custom interval
```

## Dokumentace

### Nové soubory

1. **`docs/AUTO_SAVE.md`** - Kompletní dokumentace funkce
   - Konfigurace
   - API response
   - Frontend implementace
   - Doporučené hodnoty pro různé scénáře
   - Výhody a nevýhody
   - Migrace instrukce

2. **`utils/sql/009_add_auto_save_interval.sql`** - SQL migrace

3. **`utils/sql/run-migration-009.js`** - Node.js migrační skript

4. **`API/test-auto-save-config.js`** - Test suite

5. **`docs/AUTO_SAVE_CHANGELOG.md`** - Tento soubor

## Kompatibilita

### Existující kampaně
- Automaticky dostanou default hodnotu **10 sekund**
- Pro vypnutí nastavit na `NULL` nebo `0`

### API kompatibilita
- ✅ **Backward compatible** - existující API calls fungují beze změn
- ✅ Nové pole je optional, starší klienti jej ignorují

### Database kompatibilita
- ✅ Safe migration - přidává pouze nový nullable sloupec
- ✅ Default hodnota zajišťuje konzistenci

## Deployment

### Kroky

1. **Backup databáze** (doporučeno)
```bash
mysqldump -u vcagent -p evalytics_survey > backup_$(date +%Y%m%d).sql
```

2. **Spustit migraci**
```bash
cd utils/sql
node run-migration-009.js
```

3. **Verifikovat změny**
```bash
cd ../../API
node test-auto-save-config.js
```

4. **Deploy backend** (API handlers)
```bash
npm run deploy:api
```

5. **Deploy frontend** (UI)
```bash
npm run deploy:ui
```

## Rollback

Pokud by bylo potřeba vrátit změny:

```sql
ALTER TABLE campaigns DROP COLUMN auto_save_interval_seconds;
```

**Note:** Toto odstraní konfiguraci ze všech kampaní. Frontend bude fungovat bez auto-save (jako předtím).

## Konfigurace po nasazení

### Příklady SQL příkazů

**Vypnout auto-save pro konkrétní kampaň:**
```sql
UPDATE campaigns 
SET auto_save_interval_seconds = NULL 
WHERE public_id = 'nps-survey-2026';
```

**Nastavit vlastní interval (5 sekund):**
```sql
UPDATE campaigns 
SET auto_save_interval_seconds = 5 
WHERE public_id = 'customer-satisfaction';
```

**Globálně vypnout auto-save pro všechny kampaně:**
```sql
UPDATE campaigns 
SET auto_save_interval_seconds = NULL;
```

**Nastavit 30 sekund pro dlouhé průzkumy:**
```sql
UPDATE campaigns 
SET auto_save_interval_seconds = 30 
WHERE campaign_id IN (
  SELECT c.campaign_id FROM campaigns c
  JOIN form_versions fv ON c.version_id = fv.version_id
  WHERE JSON_LENGTH(fv.form_data->'$.pages') > 5
);
```

## Monitoring

### Metriky k sledování

1. **API Request Rate** - Zvýšení volání `/survey/{publicId}/response`
2. **Response Times** - Vliv auto-save requestů na backend
3. **Database Growth** - Zvýšení ukládání partial responses
4. **User Completion Rate** - Vliv auto-save na dokončení průzkumů

### Logs

Auto-save operace logují do browser console:
```
✅ Auto-saved at 14:25:30
```

Backend logy obsahují standardní POST requesty s `status: "in_progress"`.

## Známé limitace

1. **Rate limiting** - Není implementován, mohlo by vést k abuse
2. **Storage overhead** - Partial responses zabírají místo v DB
3. **Privacy concerns** - Data ukládána před finálním souhlasem
4. **Network overhead** - Zvýšená frekvence API calls

## Budoucí vylepšení

- [ ] Rate limiting per respondent token
- [ ] Konfigurovatelný cleanup job pro neúplné odpovědi
- [ ] Visual feedback pro uživatele (toast notification)
- [ ] Offline support s IndexedDB
- [ ] Batch auto-save pro multi-page surveys
- [ ] Analytics dashboard pro partial responses

## Související issues

- #001 - Universal responses API
- #002 - Response status tracking
- #003 - Auto-save implementation (tento changelist)

## Další informace

- **Dokumentace:** `docs/AUTO_SAVE.md`
- **Migration:** `utils/sql/009_add_auto_save_interval.sql`
- **Tests:** `API/test-auto-save-config.js`
