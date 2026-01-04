#!/usr/bin/env node
// Pre-build script - generates and copies docs to src directory for Lambda packaging
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
  console.log('Pre-build: Generating documentation...');
  
  // Generate static documentation files (JSON + HTML)
  execSync('node generate-docs.mjs', { 
    cwd: __dirname,
    stdio: 'inherit'
  });
  
  // Ensure docs directory exists in src
  const docsDir = join(__dirname, 'src', 'docs');
  mkdirSync(docsDir, { recursive: true });

  // Copy all documentation files to src/docs
  const files = ['openapi.yaml', 'openapi.json', 'openapi.html'];
  const sourceDir = join(__dirname, '..', 'docs');
  
  for (const file of files) {
    const srcFile = join(sourceDir, file);
    const destFile = join(docsDir, file);
    
    if (existsSync(srcFile)) {
      copyFileSync(srcFile, destFile);
      console.log(`✓ Copied ${file} to src/docs/`);
    } else {
      console.warn(`⚠ Warning: ${file} not found, skipping`);
    }
  }
  
  console.log('Pre-build complete!');
} catch (error) {
  console.error('Error in pre-build:', error.message);
  process.exit(1);
}
