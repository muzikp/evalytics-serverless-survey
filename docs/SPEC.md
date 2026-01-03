# Evalytics Serverless Survey Platform — technická dokumentace (pracovní verze)

> Tento dokument vychází z přiloženého návrhu „Evalytics Serverless Survey Platform“ (DOCX) a doplňuje jej o doporučenou architekturu, datový model, bezpečnostní zásady a chybějící API operace.
>
> API je popsáno samostatně v souboru `docs/openapi.yaml` (OpenAPI 3.1).


## 0) Repo struktura, tooling a konvence

Repo je rozděleno tak, aby se dobře vyvíjelo lokálně ve VSCode (s pomocí Claude Sonnet) a zároveň se snadno nasazovalo automatizovaně přes GitHub Actions.

**Adresářová struktura:**
- `/UI` – frontend (Svelte), statický build pro GitHub Pages
- `/API` – backend (AWS Lambda + API Gateway) v AWS SAM
- `/utils` – skripty, lokální infra (docker compose), DB migrace/seed, helper nástroje
- `/resources` – dočasné pracovní materiály (LLM instrukce, prompt šablony, check-listy)
- `/docs` – dokumentace (včetně `openapi.yaml`)

**Konvence:**
- Všechny cesty a příkazy v dokumentaci předpokládají root repozitáře.
- Konfigurace přes `.env` soubory: `API/.env` (backend), `UI/.env` (frontend), lokálně nikdy necommitovat.
- Jednotné formátování: Prettier (UI), ESLint (UI/API), EditorConfig (repo).

**Vývoj s Claude Sonnet ve VSCode (doporučení):**
- Zadání pro LLM dávat vždy s odkazem na konkrétní soubory (např. „uprav `API/src/...` a `docs/openapi.yaml`“).
- Vynucovat konzistenci API: nejdřív upravit OpenAPI, pak implementaci handlerů, pak UI integraci.
- Na větší změny používat „plan → implement → test → doc“ (checklist je v `/resources/LLM_WORKFLOW.md`).

## 1) Cíl produktu a rozsah

Platforma slouží k:
- tvorbě a správě dotazníků v **SurveyJS**,
- verzování dotazníků přes **snapshots** (zmrazené verze),
- publikaci dotazníků přes **campaigns** (kampaně) na veřejné URL,
- správě respondentů a rozesílání pozvánek přes **AWS SES**,
- sběru odpovědí a exportu (JSON) + základní analytice,
- správě souborů (úložiště artefaktů a příloh – „storage_items“).

### Definice pojmů (doménový model)
- **Template**: „živý“ dotazník v editaci (SurveyJS JSON), může se měnit.
- **Snapshot**: verze template (ideálně **immutabilní** po publikaci).
- **Campaign**: publikace snapshotu (časové okno, texty mailu, veřejné `public_id`).
- **Respondent**: e-mail + token pro přístup k dotazníku v dané kampani.
- **Response**: uložená odpověď respondenta; podporujeme **1 nebo více pokusů (attempts)** podle nastavení kampaně.
- **Blacklist/Unsubscribe**: odhlášení z komunikace (globální nebo pro snapshot).
- **StorageItem**: metadata souboru uloženého mimo DB (typicky S3).

## 2) Uživatelské role a přístupy

Podle návrhu:
- **Master admin**: plná správa uživatelů a systému (DB init/reset, správa uživatelů).
- **Admin**: správa dotazníků, snapshotů, kampaní, respondentů, exportů.

Doporučení:
- Rozlišit role v JWT (claim `roles`) a na backendu vynutit autorizaci na úrovni handlerů.
- Ponechat **API token** jako nouzový/servisní přístup, ale primárně používat JWT.

## 3) Frontend (Svelte statická aplikace)

### 3.1 Administrátorská část
Požadavky z návrhu:
- Hostováno jako **Svelte statický web** na GitHub Pages (nebo ekvivalent).
- Fixní navbar, 2 jazyky (CZ/EN), layout s centrálním obsahem a jednoduchými kartami.
- Funkce: správa Templates / Snapshots / Campaigns / Respondents / Responses + export.

Doporučení UX:
- **Draft vs Published**: zřetelně oddělit editaci template od publikovaných snapshotů (read-only).
- **Kampaně**: stránka kampaně by měla mít 3 taby: Respondenti, Odpovědi, Nastavení + „Send test mail“.
- **Import respondentů**: CSV import (email + volitelná metadata) s preview a validací.
- **Lokalizace**: držet texty kampaní (title/description/email template) jako mapu `locale -> text`.

### 3.2 Veřejná část (respondent)
- Veřejné URL: `/survey/{public_id}#t=...`
- Zobrazení dotazníku podle snapshotu.
- **Pokračování v rozpracovaném dotazníku** (načtení poslední otevřené response).
- **Nový pokus (attempt)**: pouze pokud to admin povolí v nastavení kampaně (`allow_multiple_responses` + případně `max_attempts`), respondent může začít nový pokus (`POST /survey/{public_id}/attempts`).
- **Upload souborů**: respondent uploaduje přílohy přímo do S3 přes pre-signed URL (`POST /survey/{public_id}/attachments` -> upload -> `.../complete`).

Doporučení:
- Přidat „soft save“ (autosave) po X sekundách / při změně stránky.
- Client telemetry (volitelně): doba vyplňování, počty návratů, device info (GDPR-friendly).
- U file uploadů řešit UX: progres, možnost mazat, validace typu/velikosti ještě před uploadem.

## 4) Backend (AWS Lambda + API Gateway + SES)

### 4.1 Komponenty
- **AWS API Gateway**: **HTTP API**, CORS (levnější než REST API pro náš use-case).
- **AWS Lambda** (Node.js): business logika.
- **MySQL**: perzistence dotazníků, kampaní, respondentů, odpovědí.
- **AWS SES**: odesílání emailů (pozvánky/reminder).

Doporučení:
- Přidat **SQS** mezi „send“ endpoint a SES pro robustní dávkové odesílání (retry, throttling).
- Přidat **CloudWatch alarms** (error rate, throttles, SES bounce/complaint).
- Zvážit **S3** pro exporty a soubory (storage).

### 4.2 Autentizace a autorizace

Cíle:
- API má fungovat jako backend pro UI i jako „klasické“ REST API (pro integrace).
- Respondenti nemají účty (přístup jen přes invitation link).
- Admini jsou spravovaní interně.

Mechanismy:

**Scopes (doporučení):**
- `templates:read|write`, `snapshots:read|write`, `campaigns:read|write`, `respondents:read|write`, `responses:read|write`, `email:send`, `admin:users` (jen master).
- JWT i PAT mohou nést `scopes`; backend vynucuje autorizaci per endpoint.

Mechanismy:
- **Public (respondent)**: token se doručí v invitation linku ideálně v URL fragmentu `#t=...` a následné API volání používá hlavičku `X-Respondent-Token`. Query parametr `token` je jen pro zpětnou kompatibilitu (deprecated).
- **Admin (interaktivní login)**: `POST /auth` → krátkodobý JWT (doporučeně 1 hodina; `expires_in=3600`). Klient posílá `Authorization: Bearer ...`.
- **Programmatic REST clients (integrace)**: dlouhodobý **Personal Access Token (PAT)** v hlavičce `X-API-Token`. Hodnota tokenu se vrací pouze jednou při vytvoření (`POST /api-tokens`), v DB se ukládá jen hash.

Ekonomická volba:
- Ověření JWT dělat **přímo v Lambda handleru/middleware** (žádný Lambda authorizer).
  - Authorizer = další Lambda invokace/latence na každý request (v malém provozu zbytečné).
- Zůstat na **API Gateway HTTP API** (levnější a jednodušší), dokud nepotřebujete REST‑only „API management“ funkce (např. API keys/usage plans, request validation, per-client throttling v API Gateway).

Doporučení (bezpečnost):
- **Nikdy neukládat respondent token v plaintextu**. Ukládat pouze hash (např. SHA-256 + pepper), porovnávat hash.
- `public_id` není tajné (je v URL). Tajný je `token`.
- U public endpointů zvažte anti‑abuse: rate limiting (např. WAF/CloudFront), limity pokusů na IP a minimální intervaly pro autosave.
- **Response attempts**: pokud povolíte více pokusů, doporučuji zavést `max_attempts` a pravidla, kdy je možné založit nový pokus.
- **File upload**: nikdy netahat soubory přes API Gateway (limity). Použít S3 pre-signed URL + omezení velikosti a typů souborů.


## 5) Datový model (MySQL) a doporučené úpravy

V návrhu se objevují tabulky: `users`, `templates`, `snapshots`, `campaigns`, `campaign_respondents`, `response`, `black_list`, `storage_items`.

### 5.1 Doporučené zásady
- Primární klíče: buď krátké stringy (ULID/KSUID), nebo int auto-increment konzistentně. Nedoporučuji mix bez důvodu.
- Přidat **FOREIGN KEY** (pokud to provoz dovolí) a indexy:
  - `snapshots.template_id -> templates.template_id`
  - `campaigns.snapshot_id -> snapshots.snapshot_id`
  - `campaign_respondents.campaign_id -> campaigns.campaign_id`
  - `response.respondent_id -> campaign_respondents.respondent_id`
- JSON: používat `JSON` typ pro SurveyJS data i pro `data` u response (validace aplikačně).

### 5.2 Konkrétní zlepšení proti návrhu
- `response` tabulka: doporučuji přejmenovat na `responses` (SQL reserved-ish nuance a konzistence).
- `black_list.snapshot_id`:
  - buď `NULL` pro globální unsubscribe,
  - nebo konkrétní snapshot.
- `storage_items`:
  - v návrhu je překlep `storoge_item_id` — sjednotit na `storage_item_id`.
- Audit:
  - držet `created_by`, `last_modified_by` jako FK na `users.user_id` (nebo aspoň konzistentní identifikátor).

### 5.3 Response attempts (1 nebo více odpovědí)
Aby šlo podporovat „jedna odpověď“ i „více pokusů“, doporučuji model:
- tabulka `responses` s poli: `response_id`, `respondent_id`, `campaign_id`, `snapshot_id`, `attempt_no`, `status` (`in_progress|completed`), `data` (JSON), `client_meta` (JSON), `submitted_at`, `created`, `last_update`.
- unikátní klíč: `(respondent_id, attempt_no)`.
- pro variantu „jen jedna odpověď“: `allow_multiple_responses=false`, vždy `attempt_no=1` a aktualizace děláme upsertem.
- pro variantu „více pokusů“: nový attempt vytvoří `POST /survey/{public_id}/attempts` (nebo `new_attempt=true`).

### 5.4 Přílohy (file uploads) navázané na odpovědi
Doporučený model:
- `storage_items` (metadata + S3 klíč)
- `response_attachments` (`upload_id`, `response_id`, `storage_item_id`, `question_name`, `status` pending/ready, `created`)

Flow (respondent):
1) `POST /survey/{public_id}/attachments` -> server vytvoří pending záznam + vrátí pre-signed upload.
2) klient uploadne soubor přímo do S3.
3) klient zavolá `POST /survey/{public_id}/attachments/{upload_id}/complete` -> server označí attachment jako ready.

Doporučení:
- omezit **max velikost souboru** na **50 MB** a povolené typy na: **images, documents, audio, video** (MIME kategorie `image/*`, vybrané dokumenty jako PDF/DOCX/XLSX/PPTX/TXT, `audio/*`, `video/*`).
- čistit orphan uploads (pending, které nikdy nebyly dokončené) např. po 24h.
- zvážit antivirus scanning (např. S3 event -> Lambda -> AV) u citlivých použití.



> Doporučení: v UI po načtení tokenu z `location.hash` token okamžitě odstranit z URL (replaceState) a na API/hosting nastavit `Referrer-Policy: same-origin` (nebo `no-referrer`), aby se token nepropagoval do referer/logů.

## 6) Emailing a odhlášení
- Email template per locale: subject + body (HTML + plain-text fallback).
- V patičce emailu musí být 2 odkazy:
  - **a)** „už nechci dostávat upozornění na tento výzkum“ → unsubscribe **jen pro daný snapshot/research**
  - **b)** „už nechci dostávat vůbec žádné emaily“ → **globální** unsubscribe
- Oba odkazy používají **podepsaný unsubscribe token** (např. HMAC), aby API nikdy nemuselo přijímat email v query stringu.
- Při odesílání vždy vkládat **unsubscribe link** (ideálně s HMAC tokenem).
- Zpracovat SES eventy (bounce/complaint) — automaticky blacklistovat.

### 6.1 Reminder logika (cílit na 2 skupiny)
Podle rozhodnutí:
- **not started**: respondent nemá žádnou response (žádný attempt).
- **incomplete**: existuje response se `status=in_progress` a nebyla aktivní v posledních X minutách (grace period).

Doporučení implementace:
- API umožní u reminderu nastavit `reminder_targets` (`not_started|incomplete|both`) a `incomplete_grace_minutes`.
- samotné odesílání dělat asynchronně (SQS), aby to bylo robustní a bez timeoutů.


### 6.2 Audit doručení (SES)
- Každé odeslání (invite/reminder) zapisovat do `campaign_email_log` se stavem `queued` a po odeslání `sent`.
- Z AWS SES sbírat **delivery/bounce/complaint** eventy a ukládat je do `email_delivery_events` (payload JSON) + aktualizovat `campaign_email_log.status` a `last_event_*`.
- Pro automatické zpracování doporučuji: SES → (Event destination) → SNS/SQS → Lambda worker.
- Při **bounce**/**complaint** automaticky přidat záznam do blacklistu (globálně), aby se předešlo reputačním problémům odesílatele.

## 7) Exporty a analytika
- Export odpovědí: zatím pouze **raw JSON** (1:1 podle SurveyJS), filtrování podle kampaně/snapshotu + volitelná anonymizace.
- (Později) Doporučuji „flattening“ SurveyJS odpovědí pro CSV/BI použití:
  - buď ukládat raw JSON a flattenovat při exportu,
  - nebo udržovat materializovanou tabulku pro rychlý export (až později).

## 7.1 Retence (GDPR-friendly)
- Platforma by měla podporovat **konfigurovatelnou retenční politiku** na úrovni kampaně (nebo snapshotu).
- Prakticky: `identifiable_retention_days` + akce `anonymize|delete` + pravidelný review.
- Klíčové: uchovávat identifikátory (email, token hash) odděleně, aby šla anonymizace provést „odstřižením“ identity od odpovědí.
  - buď ukládat raw JSON a flattenovat při exportu,
  - nebo udržovat materializovanou tabulku pro rychlý export (až později).

## 8) Observabilita
- Každý request logovat s `request_id`.
- Oddělit logy public vs admin.
- Metriky: latency, 4xx/5xx, SES send rate, bounce/complaint.

## 9) Testování
- Unit testy pro DB layer + token hashing + validace stavu kampaně.
- Integrační testy: public flow (GET survey -> POST response -> GET response).
- Seed data pro lokální vývoj (docker compose: MySQL + LocalStack volitelně).

## 10) Rozhodnutí a implementační TODO

### 10.1 Rozhodnuto
- **Unsubscribe**: v patičce emailu budou 2 odkazy:
  - **a)** odhlásit pouze upozornění na **tento výzkum** (snapshot‑scoped)
  - **b)** odhlásit **všechny** emaily (global)
- **Attempts**: více pokusů je možné **pouze pokud to admin povolí v nastavení kampaně** (`allow_multiple_responses` + volitelně `max_attempts`).
- **File uploads (respondenti)**: povolené kategorie **images, documents, audio, video**, max **50 MB** na soubor.
- **Exporty**: zatím stačí export odpovědí jako **raw JSON**.
- **Audit doručení**: vyžadován (delivery/bounce/complaint) + ukládání eventů.
- **Autorizace**: admini interně; UI session přes **JWT** (1 h), programatický přístup přes **PAT** se **scopes**.

### 10.2 Implementační TODO (aby to bylo produkčně robustní)
- **SES delivery audit pipeline**: zřídit SES event destination → SNS/SQS a Lambda handler, který:
  - ukládá raw eventy do `email_delivery_events`
  - aktualizuje `campaign_email_log.status` a `last_event_*`
  - při bounce/complaint automaticky zapisuje global blacklist
- **Upload bezpečnost**: enforce size/type na presignu + orphan cleanup (pending uploads).
- **/config**: v produkci vypnout nebo hard‑lock (master only + ideálně IP allowlist).
- **Rate limiting public části**: minimálně WAF/CloudFront nebo per‑IP limity (aby někdo nebruteforcoval tokeny).
- **Retence**: nastavit explicitní hodnoty per kampaň/tenant (včetně `legal_hold`).



## 12) Automatizace nasazení (GitHub + AWS)

Cíl: vyvíjet a testovat lokálně, a do produkce nasazovat opakovatelně „jedním tlačítkem“ přes GitHub Actions.

### 12.1 Lokální vývoj (doporučený flow)
- **DB**: MySQL v Dockeru (`/utils/docker-compose.yml`)
- **API**: AWS SAM lokálně (`sam local start-api`) nebo alternativně Node dev server (pokud se zvolí framework)
- **UI**: Svelte dev server (`npm run dev`)

Viz také `docs/DEVELOPMENT.md`.

### 12.2 Produkční nasazení — UI (GitHub Pages)
- Build UI v CI (`UI/npm run build`)
- Deploy přes GitHub Pages workflow (Artifacts → Pages)
- Později lze přepnout na vlastní doménu `https://survey.evalytics.cz` (CNAME + cert).

### 12.3 Produkční nasazení — API (AWS SAM)
- Validace šablony (`sam validate`), build (`sam build`), deploy (`sam deploy`)
- Pro GitHub Actions použít `aws-actions/configure-aws-credentials` (doporučeně přes OIDC), nebo secrets s access key.
- Environment proměnné a tajemství: AWS Secrets Manager / SSM Parameter Store (ne commit do repo).
- Emailing: SES ověřená adresa `info@evalytics.cz` (v AWS účtu + v sandboxu limity).

### 12.4 Dávkové odesílání emailů
I při objemech „desítky až stovky“ doporučuji posílat emaily asynchronně:
- endpoint `/campaigns/{id}/send` vytvoří job + dá položky do SQS (1 message = 1 recipient)
- worker lambda čte SQS, posílá přes SES, ukládá log do DB
- výhody: retry, throttling, žádné timeouty API, přehledné statistiky

### 12.5 Retence a mazání (GDPR)
GDPR stanovuje zásadu **storage limitation** (čl. 5(1)(e)): osobní údaje mají být uchovávány v identifikovatelné podobě „ne déle, než je nezbytné“ pro účel zpracování.  
Proto je vhodné mít v kampani/tenantovi explicitní **retention policy** a automatizaci pro:
- anonymizaci (ponechat agregace/statistiku bez identit),
- mazání starých odpovědí a příloh,
- pravidelný review.

Pozn.: konkrétní retenční doby jsou závislé na účelu, smluvních podmínkách a interních pravidlech; pro „maximální možné doby“ je vhodné nastavit dlouhou retenci **jen pokud existuje právní důvod** a současně technicky umožnit anonymizaci/mazání.
