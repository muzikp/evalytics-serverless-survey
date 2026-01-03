# Prompt šablony (Claude Sonnet)

## 1) Implementace endpointu podle OpenAPI
> Implementuj endpoint `<METHOD> <PATH>` dle `docs/openapi.yaml`.  
> Dodrž schémata request/response.  
> Přidej validaci vstupu, auth a error handling.  
> Napiš krátký unit test a aktualizuj relevantní část UI (pokud existuje).

## 2) DB migrace
> Přidej migraci v `/utils/sql/` pro změnu: <popis>.  
> Ujisti se, že je forward-only a idempotentní.  
> Aktualizuj `docs/SPEC.md` (datový model, indexy).

## 3) Review bezpečnosti
> Projdi implementaci tokenů, CORS, uploadů a emailing.  
> Najdi slabiny (plaintext token, PII v logu, chybějící rate limit).  
> Navrhni konkrétní opravy a změny v kódu.
