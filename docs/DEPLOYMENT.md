# DEPLOYMENT (GitHub + AWS)

## UI (GitHub Pages)
Doporučený způsob: GitHub Actions workflow, který:
1) nainstaluje dependencies
2) buildne statický web
3) publikuje přes Pages

Viz `.github/workflows/deploy-ui.yml`.

Poznámky pro SvelteKit `adapter-static`:
- defaultní output je `UI/build/`
- pro GitHub Pages (repo != `username.github.io`) je potřeba nastavit `kit.paths.base` na `/<repo>` a generovat fallback `404.html`
- přidej `.nojekyll` do `UI/static/` (už je v repu)

## API (AWS SAM)
Doporučený způsob: GitHub Actions workflow, který:
1) `sam validate`
2) `sam build`
3) `sam deploy`

Viz `.github/workflows/deploy-api.yml`.

### Poznámky k tajemstvím
- DB creds a další secrets držet v AWS SSM / Secrets Manager
- GitHub Actions přístup do AWS ideálně přes OIDC (krátkodobé role), nebo přes Secrets

## Migrace DB
Doporučení: verzované SQL migrace v `/utils/sql/` a jednoduchý migrate script (TODO).


## SES delivery audit (bounce/complaint/delivery)
Aby fungoval audit doručení:
1) V AWS SES nastav **configuration set** a **event destination** (delivery/bounce/complaint) do SNS topicu `SesEventsTopic` vytvořeného SAM templatem.
2) SNS přeposílá do SQS `SesEventsQueue` a zpracuje to `EmailEventWorkerFunction`.
3) Worker ukládá eventy do DB (`email_delivery_events`) a aktualizuje `campaign_email_log`.

Pozn.: konfigurace SES (configuration set + event destination) se často nastavuje jednorázově mimo SAM template (nebo jako samostatný stack).