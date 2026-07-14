/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/middleware/errorHandler.js]
 *
 * WHO I AM:    Global error handling middleware.
 * WHAT I OWN:  Catching all thrown exceptions or next(err) invocations,
 *              logging them, and returning uniform error responses.
 * WHAT I DON'T: Creating specific application error instances (route/service layer concern).
 * WHO CALLS ME: server/index.js (wired at the end of the middleware chain).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import config from '../config.js';
import { logger } from './logger.js';

/**
 * HTTP_ERROR_CODES — maps common HTTP status codes to their canonical error codes.
 *
 * WHY we maintain an explicit mapping:
 *   Ensures the client receives predictable, machine-readable error codes
 *   regardless of which service layer threw the error.
 *
 * @type {Record<number, string>}
 */
const HTTP_ERROR_CODES = {
  400: 'BAD_REQUEST',
  404: 'NOT_FOUND',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'RATE_LIMITED'
};

/**
 * errorHandler — intercepts all unhandled errors and maps them to a secure JSON envelope.
 *
 * WHY we never leak stack traces in production:
 *   Stack traces expose file paths, database schemas, and configuration variables,
 *   which could be exploited by malicious actors. We only output them in development mode.
 *
 * WHY the 4-argument signature (err, req, res, next) is mandatory:
 *   Express identifies error-handling middleware by its arity; removing `next`
 *   would cause Express to treat this as a normal middleware and skip it for errors.
 *
 * @param {Error} err - The error object thrown or passed via next(err)
 * @param {import('express').Request} req - Express request
 * @param {import('express').Response} res - Express response
 * @param {import('express').NextFunction} next - Express next (required for 4-arg signature)
 */
export function errorHandler(err, req, res, next) {
  const statusCode = err.status || err.statusCode || 500;
  const isDev = config.nodeEnv === 'development';

  // WHY we use logger instead of console.error:
  // The logger provides consistent formatting and can be redirected to file/service.
  logger.error(`[${req.method}] ${req.originalUrl} → ${statusCode}: ${err.message}`);
  if (isDev && err.stack) {
    logger.error(err.stack);
  }

  // WHY we return a generic message for 500 in production:
  // Internal error details (DB connection strings, file paths) should never
  // reach the client in production environments.
  const errorCode = err.code || HTTP_ERROR_CODES[statusCode] || 'INTERNAL_SERVER_ERROR';
  const message = statusCode === 500 && !isDev
    ? 'An unexpected error occurred'
    : err.message || 'An unexpected error occurred';

  res.status(statusCode).json({
    ok: false,
    error: {
      code: errorCode,
      message,
      ...(isDev ? { stack: err.stack } : {})
    }
  });
}
