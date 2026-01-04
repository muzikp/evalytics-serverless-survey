// Documentation handler - serves pre-generated static OpenAPI documentation
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { apiResponse, errorResponse } from '../utils.js';
import { logError } from '../logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for static files
let cachedFiles = {
  yaml: null,
  json: null,
  html: null
};

function loadDocFile(filename) {
  const cacheKey = filename.replace('openapi.', '');
  
  if (cachedFiles[cacheKey]) {
    return cachedFiles[cacheKey];
  }

  try {
    // Load from bundled docs directory
    const docsPath = join(__dirname, '..', 'docs', filename);
    const content = readFileSync(docsPath, 'utf8');
    cachedFiles[cacheKey] = content;
    return content;
  } catch (error) {
    console.error(`Failed to load ${filename}:`, error);
    throw new Error('Documentation not available');
  }
}

/**
 * Handle documentation requests
 * @param {object} event - Lambda event
 * @param {string} method - HTTP method
 * @param {string} path - Request path
 * @returns {Promise<object>} API response
 */
export async function handleDocumentation(event, method, path) {
  // Only support GET
  if (method !== 'GET') {
    return errorResponse(405, 'METHOD_NOT_ALLOWED', 'Only GET is supported');
  }

  try {
    const params = event.queryStringParameters || {};
    let format = params.format;

    // Auto-detect format from Accept header if not explicitly specified
    if (!format) {
      const acceptHeader = event.headers?.accept || event.headers?.Accept || '';
      // Browser requests typically have 'text/html' as first preference
      if (acceptHeader.includes('text/html')) {
        format = 'html';
      } else {
        format = 'json';
      }
    }

    switch (format.toLowerCase()) {
      case 'html':
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
          },
          body: loadDocFile('openapi.html')
        };

      case 'yaml':
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'text/yaml; charset=utf-8',
            'Cache-Control': 'public, max-age=3600'
          },
          body: loadDocFile('openapi.yaml')
        };

      case 'json':
      default:
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600'
          },
          body: loadDocFile('openapi.json')
        };
    }
  } catch (error) {
    logError('Documentation error', error, {
      method,
      path
    });
    return errorResponse(500, 'DOCUMENTATION_ERROR', error.message);
  }
}
