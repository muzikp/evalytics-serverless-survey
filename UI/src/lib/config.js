/**
 * Configuration
 *
 * API Base URL:
 * - In local dev (via proxy), this defaults to '/api'
 * - In prod, set VITE_API_BASE_URL to your API Gateway domain
 */

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
