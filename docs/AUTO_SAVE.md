# Auto-Save Konfigurace

## Přehled

Auto-save je funkce pro automatické ukládání rozpracovaných odpovědí v průzkumu. Respondent tak nepřijde o data, pokud zavře browser nebo naviguje pryč před dokončením průzkumu.

## Nastavení

Auto-save se konfiguruje na úrovni **kampaně** pomocí pole `auto_save_interval_seconds` v databázi:

| Hodnota | Chování |
|---------|---------|
| `10` (default) | Ukládá každých 10 sekund po poslední změně |
| `5` | Ukládá každých 5 sekund |
| `30` | Ukládá každých 30 sekund |
| `NULL` | Auto-save vypnuto |
| `0` nebo záporné | Auto-save vypnuto |

## Databázová struktura

```sql
-- Sloupec v campaigns table
auto_save_interval_seconds INT NULL DEFAULT 10 
COMMENT 'Interval průběžného ukládání v sekundách (NULL = vypnuto, default 10)'
```

## API Response

Hodnota se vrací v GET `/survey/{publicId}` endpointu:

```json
{
  "public_id": "nps-survey-2026",
  "title": {...},
  "survey_data": {...},
  "auto_save_interval_seconds": 10,
  "respondent": {...}
}
```

## Frontend implementace

UI survey component (`UI/src/routes/survey/[publicId]/+page.svelte`) používá tuto hodnotu pro debounce timer:

```javascript
function handleValueChanged(sender, options) {
  // Skip if disabled
  if (!autoSaveIntervalSeconds || autoSaveIntervalSeconds <= 0) {
    return;
  }

  // Schedule auto-save after configured interval
  if (autoSaveTimer) {
    clearTimeout(autoSaveTimer);
  }

  autoSaveTimer = setTimeout(() => {
    autoSave(sender);
  }, autoSaveIntervalSeconds * 1000);
}
```

## Status rozlišení

Auto-save ukládá odpovědi se statusem `in_progress`:

```json
{
  "data": {...},
  "status": "in_progress"  // Auto-save
}
```

Finální odeslání nastaví status na `completed`:

```json
{
  "data": {...},
  "status": "completed"  // Final submit
}
```

## Databázové změny

- **Status**: `in_progress` nebo `completed`
- **submitted_at**: Nastaveno pouze při `status = 'completed'`
- **last_update**: Aktualizováno při každém auto-save

## Kdy použít

| Scénář | Doporučené nastavení |
|--------|---------------------|
| Dlouhé průzkumy (15+ minut) | `10` sekund (default) |
| Krátké průzkumy (< 5 minut) | `30` sekund nebo `NULL` |
| Citlivá data (GDPR) | `NULL` (vypnuto) |
| Mobilní respondenti | `5` sekund (častější ztráta spojení) |

## Výhody

- ✅ **Prevence ztráty dat** - Respondent nepřijde o data při nechtěném zavření browseru
- ✅ **Seamless UX** - Auto-save běží na pozadí, respondent není rušen
- ✅ **Návrat k rozpracované odpovědi** - Při opětovném otevření se načtou uložená data
- ✅ **Konfigurovatelné** - Administrátor může nastavit interval podle typu průzkumu

## Nevýhody

- ❌ **Zvýšené API volání** - Více requestů na backend (mitigováno debounce)
- ❌ **Částečná data** - Neúplné odpovědi uloženy v databázi
- ❌ **Privacy concerns** - Data ukládána před finálním souhlasem respondenta

## Migrace

Pro přidání do existující databáze:

```bash
cd utils/sql
node run-migration-009.js
```

Nebo manuálně:

```sql
ALTER TABLE campaigns
ADD COLUMN auto_save_interval_seconds INT NULL DEFAULT 10
COMMENT 'Interval průběžného ukládání v sekundách (NULL = vypnuto, default 10)'
AFTER max_attempts;
```

## Testování

1. Vytvořte kampaň s `auto_save_interval_seconds = 5`
2. Otevřete průzkum s respondent tokenem
3. Vyplňte pole a počkejte 5 sekund
4. Zkontrolujte console pro: `✅ Auto-saved at HH:MM:SS`
5. Zavřete browser a otevřete stejný odkaz
6. Ověřte, že data jsou načtena

## Zabezpečení

- Auto-save vyžaduje respondent token (stejně jako finální submit)
- Email-based authorization zajišťuje, že respondent může ukládat pouze své odpovědi
- Rate limiting na backend API (TODO)
