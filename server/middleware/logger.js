/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/middleware/logger.js]
 *
 * WHO I AM:    HTTP request and response logger middleware + shared logger.
 * WHAT I OWN:  Logging details of incoming HTTP requests (method, URL, time taken)
 *              and providing a levelled logger object for other modules.
 * WHAT I DON'T: File-based persistence of logs (logs go to standard stdout).
 * WHO CALLS ME: server/index.js (Express global middlewares) and
 *               server/middleware/errorHandler.js (levelled logger).
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * logger — minimal levelled logger with a consistent [kurai] prefix.
 * WHY an object instead of bare console calls: gives every module one place
 * to redirect output to a file/service later without touching call sites.
 */
export const logger = {
  info: (...args) => console.log('[kurai]', ...args),
  warn: (...args) => console.warn('[kurai]', ...args),
  error: (...args) => console.error('[kurai]', ...args)
};

/**
 * requestLogger — logs incoming requests and their duration.
 */
export function requestLogger(req, res, next) {
  const start = Date.now();

  // Hook response finish event to log outcome
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`[kurai] ${req.method} ${req.originalUrl} - Status: ${res.statusCode} (${duration}ms)`);
  });

  next();
}
