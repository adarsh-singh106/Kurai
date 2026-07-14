/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/config.js]
 *
 * WHO I AM:    The configuration hub for the Kurai server.
 * WHAT I OWN:  Reading environment variables, validating them, and exporting a
 *              read-only configuration object with sensible defaults.
 * WHAT I DON'T: Any active application logic or runtime state.
 * WHO CALLS ME: Any file in the server requiring configuration parameters.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dotenv from 'dotenv';

// WHY config.js owns the single dotenv.config() call:
// Centralising env loading here prevents double-loading from index.js and
// guarantees env vars are available before any other module reads config.
dotenv.config();

/**
 * safeParseInt — parses a string to integer with a guaranteed fallback.
 *
 * WHY we validate parseInt results:
 *   parseInt('hello', 10) returns NaN, which silently corrupts numeric config
 *   values and causes hard-to-debug runtime failures downstream.
 *
 * @param {string} value - The raw string to parse
 * @param {number} fallback - Default value when parsing fails
 * @returns {number} The parsed integer or the fallback
 */
function safeParseInt(value, fallback) {
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? fallback : parsed;
}

/**
 * @type {Readonly<Object>} config — Frozen application configuration object.
 */
const config = {
  port: safeParseInt(process.env.PORT, 3000),
  nodeEnv: process.env.NODE_ENV || 'development',
  storageBackend: process.env.STORAGE_BACKEND || 'file',
  databaseUrl: process.env.DATABASE_URL || '',
  redisUrl: process.env.REDIS_URL || '',

  // WHY we expose corsOrigin as a config value:
  // Allows deployment-time override of allowed origins without code changes.
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',

  proxy: {
    timeoutMs: safeParseInt(process.env.PROXY_TIMEOUT_MS, 30000),
    maxResponseBytes: safeParseInt(process.env.PROXY_MAX_RESPONSE_BYTES, 52428800), // 50MB
    allowPrivateIps: process.env.PROXY_ALLOW_PRIVATE_IPS === 'true'
  },

  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== 'false',
    windowMs: safeParseInt(process.env.RATE_LIMIT_WINDOW_MS, 60000),
    maxRequests: safeParseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 100)
  },

  auth: {
    enabled: process.env.AUTH_ENABLED === 'true',
    secret: process.env.AUTH_SECRET || ''
  }
};

/**
 * validateConfig — performs startup-time sanity checks on the configuration.
 *
 * WHY we validate at startup instead of lazily:
 *   Catching misconfigurations immediately prevents cryptic runtime errors
 *   (e.g. an auth-enabled server with no secret silently accepts all tokens).
 *
 * @throws {Error} If a critical misconfiguration is detected
 */
function validateConfig() {
  // WHY 32 characters minimum for auth secret:
  // Shorter secrets are vulnerable to brute-force attacks; 32 chars provides
  // ~192 bits of entropy which is sufficient for HMAC-based token signing.
  if (config.auth.enabled && config.auth.secret.length < 32) {
    throw new Error(
      '[kurai-config] AUTH_ENABLED=true but AUTH_SECRET is missing or too short (min 32 chars).'
    );
  }

  if (config.port < 1 || config.port > 65535) {
    throw new Error(`[kurai-config] PORT must be between 1 and 65535, got: ${config.port}`);
  }

  if (config.proxy.timeoutMs < 1000) {
    throw new Error(`[kurai-config] PROXY_TIMEOUT_MS must be >= 1000ms, got: ${config.proxy.timeoutMs}`);
  }
}

// Run validation immediately on import
validateConfig();

// WHY Object.freeze:
// Prevents configuration values from being altered at runtime by malicious or buggy code.
Object.freeze(config);
Object.freeze(config.proxy);
Object.freeze(config.rateLimit);
Object.freeze(config.auth);

export default config;
