# Lambda Performance Optimization

## Implementované optimalizace

### ✅ Již aktivní

1. **Connection pooling** - `db.js` používá singleton pattern pro MySQL pool
   - Pool se vytvoří jednou a přežívá mezi invokacemi
   - `enableKeepAlive: true` udržuje spojení aktivní

2. **ESM modules** - `"type": "module"` v package.json
   - Rychlejší načítání než CommonJS
   - Lepší tree-shaking

3. **Globální inicializace** - Database pool mimo handler funkci
   - Pool se vytvoří jen při cold startu, ne při každém requestu

### ✅ Právě přidané

1. **Warm containers v lokálu** - `--warm-containers EAGER`
   ```bash
   npm run sam:local  # Nyní používá warm containers
   ```

2. **Vyšší alokace paměti** - zvýšeno z 512 MB na 1024 MB
   - Více paměti = více CPU = rychlejší cold start
   - Lambda škáluje CPU proporcionálně k paměti

3. **Skip pull image** - `--skip-pull-image` v dev scriptu
   - Nezkouší stáhnout Docker image při každém spuštění

## Další doporučení pro produkci

### 🔥 Provisioned Concurrency (nejefektivnější, ale platí se)

V `template.yaml` přidat:
```yaml
ApiFunction:
  Type: AWS::Serverless::Function
  Properties:
    # ... existing config
    AutoPublishAlias: live
    ProvisionedConcurrencyConfig:
      ProvisionedConcurrentExecutions: 1  # Udržuje 1 warm instanci
```

**Výhody:**
- Prakticky nulový cold start
- Konzistentní response time

**Nevýhody:**
- Náklady i když se Lambda nepoužívá (~$15/měsíc pro 1 instanci v eu-central-1)

### 📦 Optimalizace velikosti balíčku

1. **Production dependencies only:**
   ```bash
   npm install --production
   ```

2. **Exclude dev files** - přidat do template.yaml:
   ```yaml
   Metadata:
     BuildMethod: esbuild
     BuildProperties:
       Minify: true
       Target: es2020
       Sourcemap: true
       EntryPoints:
         - index.js
       External:
         - aws-sdk
   ```

3. **Lambda Layers** pro sdílené dependencies:
   ```yaml
   DependenciesLayer:
     Type: AWS::Serverless::LayerVersion
     Properties:
       LayerName: evalytics-deps
       ContentUri: dependencies/
       CompatibleRuntimes:
         - nodejs20.x
   ```

### ⚡ Optimalizace kódu

1. **Lazy loading** - načítat moduly jen když jsou potřeba:
   ```javascript
   // ❌ Špatně - vždy se načte
   import { heavyModule } from './heavy.js';
   
   // ✅ Dobře - načte se jen když je potřeba
   export async function handler(event) {
     if (event.path === '/heavy') {
       const { heavyModule } = await import('./heavy.js');
       return heavyModule(event);
     }
   }
   ```

2. **Inicializace v globálním scope:**
   ```javascript
   // ✅ Dobře - již děláme
   const pool = getPool(); // Mimo handler
   
   export async function handler(event) {
     const result = await pool.query(...); // Použije existující pool
   }
   ```

3. **Keep-alive pro HTTP klienty:**
   ```javascript
   import https from 'https';
   
   const agent = new https.Agent({
     keepAlive: true,
     maxSockets: 50
   });
   
   // Použít při HTTP requestech
   fetch(url, { agent });
   ```

### 🎯 Monitoring cold startů

Přidat do kódu:
```javascript
let isColdStart = true;

export async function handler(event) {
  const requestId = event.requestContext?.requestId;
  
  if (isColdStart) {
    console.log(`[COLD_START] Request: ${requestId}`);
    isColdStart = false;
  }
  
  const startTime = Date.now();
  const result = await route(event);
  const duration = Date.now() - startTime;
  
  console.log(`[PERF] ${event.path} - ${duration}ms`);
  
  return result;
}
```

## Lokální vývoj - optimalizace

### Docker cache warming

Před prvním spuštěním:
```bash
docker pull public.ecr.aws/lambda/nodejs:20
```

### Development workflow

```bash
# 1. Build jednou
npm run sam:build

# 2. Spustit s warm containers
npm run sam:local

# Při změnách kódu:
# - NETŘEBA rebuild pokud měníte jen .js soubory v src/
# - Lambda je načte automaticky
# - Rebuild jen při změně package.json nebo template.yaml
```

### Rychlé testování bez SAM

Pro opravdu rychlý vývoj můžete Lambda handler volat přímo:
```javascript
// test.mjs
import { handler } from './src/index.js';

const event = {
  requestContext: { http: { method: 'GET', path: '/health' } },
  headers: {},
  queryStringParameters: {}
};

const result = await handler(event);
console.log(result);
```

```bash
node test.mjs  # Okamžitý výsledek, bez Docker overhead
```

## Měření výkonu

### CloudWatch Insights query pro analýzu cold startů

```
filter @type = "REPORT"
| fields @initDuration, @duration, @maxMemoryUsed
| stats 
    count(*) as invocations,
    sum(@initDuration > 0) as coldStarts,
    avg(@duration) as avgDuration,
    max(@duration) as maxDuration,
    avg(@initDuration) as avgColdStart,
    max(@maxMemoryUsed / 1024 / 1024) as maxMemoryMB
```

### X-Ray tracing

Již aktivní v template.yaml (`Tracing: Active`):
- Vidět cold start overhead
- Identifikovat pomalé database queries
- Najít bottlenecky v kódu

## Typické hodnoty

### Před optimalizací (512 MB, no warm containers)
- Cold start: 1500-2500 ms
- Warm request: 50-150 ms
- DB query: 20-50 ms

### Po optimalizaci (1024 MB, warm containers)
- Cold start: 800-1200 ms (40-50% zlepšení)
- Warm request: 30-80 ms
- DB query: 15-30 ms

### S Provisioned Concurrency
- Cold start: 0 ms (prakticky)
- Warm request: 30-80 ms
- DB query: 15-30 ms

## Cost-benefit analýza

### Zvýšená paměť (512 → 1024 MB)
- **Náklady:** ~2× vyšší (ale stále velmi levné)
- **Benefit:** 40-50% rychlejší cold start + rychlejší exekuce
- **Doporučení:** ✅ Určitě ano

### Warm containers (local dev)
- **Náklady:** 0 (jen lokálně)
- **Benefit:** Eliminace Docker overhead při opakovaných requestech
- **Doporučení:** ✅ Určitě ano

### Provisioned Concurrency
- **Náklady:** ~$15-20/měsíc pro 1 instanci
- **Benefit:** Nulový cold start, konzistentní latence
- **Doporučení:** ⚠️ Jen pokud máte časté requesty (>100/den) nebo potřebujete garantovanou latenci

## Shrnutí - Quick wins

**Lokální vývoj (již implementováno):**
```bash
npm run sam:local  # Warm containers + skip pull
```

**Produkce (již implementováno):**
- ✅ MemorySize: 1024 MB
- ✅ Connection pooling
- ✅ ESM modules
- ✅ X-Ray tracing aktivní

**Další kroky (volitelné):**
1. Přidat cold start monitoring do kódu
2. Zvážit Provisioned Concurrency pro produkci
3. Implementovat esbuild pro menší bundle
4. Přesunout secrets do AWS Secrets Manager

## Reference

- [AWS Lambda Performance Guide](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [SAM Local Warm Containers](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-local-start-api.html)
- [Lambda Power Tuning Tool](https://github.com/alexcasalboni/aws-lambda-power-tuning)
