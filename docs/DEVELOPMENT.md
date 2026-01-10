# DEVELOPMENT (lokální vývoj)

## Předpoklady
- Node.js LTS
- Docker + Docker Compose
- AWS SAM CLI
- VSCode (+ doporučené extension v `.vscode/extensions.json`)

## Lokální DB (MySQL)
Spusť:
```bash
docker compose -f utils/docker-compose.yml up -d
```

- MySQL: `localhost:3306`
- Adminer: `http://localhost:8080`

## Inicializace schématu
V `/utils/sql/001_init.sql` je návrh počátečního schématu.
Můžeš jej aplikovat ručně přes klienta nebo automatizovat (TODO skript).

## API lokálně
```bash
npm run sam:local
```
SAM zpřístupní API na `http://127.0.0.1:3000` (default).

## UI lokálně
UI je SvelteKit s `@sveltejs/adapter-static`.

Lokální běh:
```bash
npm run dev:ui
```

Lokální napojení na API:

```bash
VITE_API_BASE_URL=http://127.0.0.1:3000 npm run dev:ui
```

## API Token pro testování

Pro snadné testování API bez přihlašování můžete vytvořit trvalý API token:

```bash
cd API
node create-admin-api-token.js
```

Token použijte v Postman nebo curl s headerem:
```
X-API-Token: <your-token>
```

## Doporučený workflow s Claude Sonnet ve VSCode
- udržuj „single source of truth“ pro API v `docs/openapi.yaml`
- změny dělej ve sledu: OpenAPI → backend → UI → testy → dokumentace
- používej checklist v `resources/LLM_WORKFLOW.md`
