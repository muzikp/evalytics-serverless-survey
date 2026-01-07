# Evalytics Serverless Survey Platform

Monorepo pro webovou aplikaci pro sběr dotazníkových dat (SurveyJS) s architekturou:
- **UI**: Svelte statický web → CloudFront + S3
- **API**: AWS Lambda + API Gateway (AWS SAM)
- **DB**: MySQL (lokálně Docker, produkce RDS)
- **Email**: AWS SES s delivery tracking
- **Storage**: AWS S3 pro uploads

## 🚀 Quick Start

```bash
# 1. Instalace
git clone https://github.com/muzikp/evalytics-serverless-survey.git
cd evalytics-serverless-survey
npm install

# 2. Konfigurace
cp .env.example .env
# Vyplň .env podle docs/DEPLOYMENT.md

# 3. Lokální vývoj
npm run dev  # Spustí API (SAM local) + UI (Vite)
```

## 📚 Dokumentace

- **[Deployment Guide](docs/DEPLOYMENT.md)** - Kompletní návod na nasazení (API, UI, DNS)
- **[Development](docs/DEVELOPMENT.md)** - Lokální vývoj a testování
- **[API Specification](docs/openapi.yaml)** - OpenAPI 3.0 dokumentace
- **[Technical Spec](docs/SPEC.md)** - Architektura a technické detaily

## 📁 Struktura

```
├── API/              # AWS Lambda backend (Node.js)
├── UI/               # SvelteKit frontend
├── docs/             # Dokumentace
├── scripts/          # PowerShell deployment skripty (gitignored)
└── utils/            # Docker, SQL migrace, helpery
```
