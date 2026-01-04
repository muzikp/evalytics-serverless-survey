#!/usr/bin/env node
// Generate static documentation files from OpenAPI YAML
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import yaml from 'yaml';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  console.log('Generating API documentation...');
  
  // Read OpenAPI YAML
  const yamlPath = join(__dirname, '..', 'docs', 'openapi.yaml');
  const yamlContent = readFileSync(yamlPath, 'utf8');
  const spec = yaml.parse(yamlContent);
  
  // Ensure output directory exists
  const docsDir = join(__dirname, '..', 'docs');
  mkdirSync(docsDir, { recursive: true });
  
  // Generate JSON
  const jsonPath = join(docsDir, 'openapi.json');
  writeFileSync(jsonPath, JSON.stringify(spec, null, 2), 'utf8');
  console.log('✓ Generated openapi.json');
  
  // Generate HTML with Swagger UI
  const htmlContent = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Evalytics Serverless Survey API Documentation</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.5/swagger-ui.css">
  <style>
    body {
      margin: 0;
      padding: 0;
    }
    .topbar {
      display: none;
    }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.5/swagger-ui-bundle.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.10.5/swagger-ui-standalone-preset.js"></script>
  <script>
    window.onload = function() {
      const spec = ${JSON.stringify(spec)};
      
      window.ui = SwaggerUIBundle({
        spec: spec,
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        plugins: [
          SwaggerUIBundle.plugins.DownloadUrl
        ],
        layout: "StandaloneLayout",
        filter: true,
        tryItOutEnabled: true
      });
    };
  </script>
</body>
</html>`;
  
  const htmlPath = join(docsDir, 'openapi.html');
  writeFileSync(htmlPath, htmlContent, 'utf8');
  console.log('✓ Generated openapi.html');
  
  console.log('Documentation generation complete!');
} catch (error) {
  console.error('Error generating documentation:', error.message);
  process.exit(1);
}
