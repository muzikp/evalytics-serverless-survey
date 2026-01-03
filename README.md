# Evalytics Serverless Survey Platform

Monorepo pro webovou aplikaci pro sběr dotazníkových dat (SurveyJS) s architekturou:
- **UI**: Svelte statický web (GitHub Pages)
- **API**: AWS Lambda + API Gateway (AWS SAM), emaily přes AWS SES, soubory přes S3
- **DB**: MySQL (lokálně přes Docker, v produkci typicky RDS)

Dokumentace:
- API specifikace: `docs/openapi.yaml`
- Technická specifikace: `docs/SPEC.md`
- Vývoj lokálně: `docs/DEVELOPMENT.md`
- Nasazení: `docs/DEPLOYMENT.md`

## Struktura repozitáře
- `/UI` – frontend
- `/API` – backend
- `/utils` – skripty, docker, SQL, helpery
- `/resources` – dočasné pracovní instrukce (LLM workflow apod.)
- `/docs` – dokumentace
