# API Documentation Endpoint

API poskytuje self-documenting endpoint na kořenové cestě `/` se třemi formáty výstupu.

## Endpointy

### GET /
Vrací OpenAPI dokumentaci v různých formátech podle query parametru `format` nebo `Accept` headeru.

**Query parametry:**
- `format` (optional): Explicitní formát výstupu
  - `json` - OpenAPI specifikace jako JSON
  - `yaml` - OpenAPI specifikace jako YAML
  - `html` - Interaktivní Swagger UI dokumentace

**Auto-detekce formátu:**
- Pokud není zadán `format` parametr, endpoint detekuje formát z `Accept` headeru:
  - **Prohlížeč** (`Accept: text/html,...`) → automaticky vrátí HTML Swagger UI
  - **API klient** (curl, PowerShell, atd.) → vrátí JSON

**Příklady:**

```bash
# Prohlížeč - automaticky HTML Swagger UI
# Otevřete: http://localhost:3000/

# curl - automaticky JSON
curl http://localhost:3000/

# Explicitní JSON formát
curl http://localhost:3000/?format=json

# Explicitní YAML formát
curl http://localhost:3000/?format=yaml

# Explicitní HTML formát
curl http://localhost:3000/?format=html
```

**PowerShell příklady:**

```powershell
# JSON formát (automaticky detekováno)
Invoke-RestMethod -Uri 'http://localhost:3000/' -Method GET

# YAML formát
Invoke-RestMethod -Uri 'http://localhost:3000/?format=yaml' -Method GET

# HTML Swagger UI - stáhne HTML
Invoke-RestMethod -Uri 'http://localhost:3000/?format=html' -Method GET

# HTML Swagger UI - otevře v prohlížeči (automatická detekce)
Start-Process 'http://localhost:3000/'
```

## Generování dokumentace

Dokumentace je vygenerována jako statické soubory při build procesu:

### 1. Editace OpenAPI specifikace
```bash
# Editujte soubor
docs/openapi.yaml
```

### 2. Generování statických souborů
```bash
cd API
node generate-docs.mjs
```

Tento příkaz vygeneruje:
- `docs/openapi.json` - JSON verze specifikace
- `docs/openapi.html` - Swagger UI s embedded specifikací

### 3. Build a deploy
```bash
# Prebuild automaticky spustí generate-docs.mjs
cd API
node prebuild.mjs  # nebo automaticky při sam build

# Build Lambda
sam build

# Lokální test
sam local start-api --env-vars env.json --port 3000 --template .aws-sam/build/template.yaml
```

## Implementační detaily

### Dev dependencies
- `yaml` package je použit pouze jako dev dependency pro konverzi YAML → JSON
- Není součástí produkčního Lambda balíčku

### Build proces
1. **generate-docs.mjs**: Načte `openapi.yaml`, převede na JSON, vygeneruje HTML se Swagger UI
2. **prebuild.mjs**: Zkopíruje všechny 3 soubory (yaml, json, html) do `src/docs/`
3. **sam build**: Zabalí `src/docs/` do Lambda package
4. **Lambda runtime**: Handler pouze čte a vrací statické soubory (žádné parsování)

### Handler logika
```javascript
// API/src/handlers/documentation.js
- loadDocFile(filename): Načte statický soubor z src/docs/, cachuje v paměti
- handleDocumentation(): Vrátí podle format parametru:
  - json → openapi.json (application/json)
  - yaml → openapi.yaml (text/yaml)
  - html → openapi.html (text/html)
```

### Výhody tohoto přístupu
✅ Žádné runtime dependencies (yaml package není v Lambda)  
✅ Rychlá odezva (statické soubory, in-memory cache)  
✅ Malý Lambda package  
✅ Swagger UI embeddované v HTML (žádné externí API calls)  
✅ Dokumentace vždy synchronizovaná s buildem  

## Cache
Všechny formáty jsou cachovány:
- **In-memory cache**: První request načte soubor, další používají cached verzi
- **HTTP cache**: `Cache-Control: public, max-age=3600` (1 hodina)
