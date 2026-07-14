/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/middleware/logger.js]
 *
 * WHO I AM:    HTTP request and response logger middleware.
 * WHAT I OWN:  Logging details of incoming HTTP requests (method, URL, time taken).
 * WHAT I DON'T: File-based persistence of logs (logs go to standard stdout).
 * WHO CALLS ME: server/index.js (Express global middlewares).
 * ─────────────────────────────────────────────────────────────────────────────
 */

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
