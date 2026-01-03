# UI (SvelteKit, adapter-static)

Záměr: moderní responsivní admin UI + veřejná část pro respondenty.

Hostování:
- primárně GitHub Pages (repo build do `UI/build/`)
- později může běžet i na vlastním doménovém hostingu (statické soubory)

## Lokální vývoj

```bash
npm install
npm run dev:ui
```

Pro lokální napojení na API:

```bash
VITE_API_BASE_URL=http://127.0.0.1:3000 npm run dev:ui
```

## Deploy na GitHub Pages

Workflow je v `.github/workflows/deploy-ui.yml`.

Poznámky:
- Výstup statického buildu je `UI/build/` (default pro `@sveltejs/adapter-static`).
- Pro GitHub Pages se používá `kit.paths.base` a fallback `404.html` (viz `UI/svelte.config.js`).
- `.nojekyll` je v `UI/static/.nojekyll`.

## Doporučení do budoucna

- i18n (cs/en)
- SurveyJS runtime v public části, SurveyJS editor v admin části
- audit log + přístupová práva (role) v admin části
