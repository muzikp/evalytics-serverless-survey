// Database connection and utilities
import mysql from 'mysql2/promise';
import { logQuery, logError, isDev } from './logger.js';

let pool = null;

/**
 * Get or create MySQL connection pool
 */
export function getPool() {
  if (!pool) {
    pool = mysql.createPool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'evalytics_survey',
      charset: 'utf8mb4',
      collation: 'utf8mb4_unicode_ci',
      typeCast: function(field, next) {
        // Ensure TEXT/VARCHAR fields are treated as UTF-8 strings
        if (field.type === 'VAR_STRING' || field.type === 'STRING' || 
            field.type === 'BLOB' || field.type === 'TINY_BLOB' || 
            field.type === 'MEDIUM_BLOB' || field.type === 'LONG_BLOB') {
          const value = field.string();
          return value;
        }
        return next();
      },
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: 'Z' // Use UTC
    });
  }
  return pool;
}

/**
 * Execute a query
 * @param {string} sql
 * @param {any[]} params
 * @returns {Promise<any>}
 */
export async function query(sql, params = []) {
  try {
    logQuery(sql, params);
    const pool = getPool();
    const [rows] = await pool.execute(sql, params);
    return rows;
  } catch (error) {
    logError('Database query error', error, {
      sql,
      params: isDev() ? params : '[hidden]'
    });
    throw error;
  }
}

/**
 * Execute a query and return the first row
 */
export async function queryOne(sql, params = []) {
  const rows = await query(sql, params);
  return rows[0] || null;
}

/**
 * Close the connection pool (for graceful shutdown)
 */
export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
