/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/middleware/rateLimit.js]
 *
 * WHO I AM:    In-memory per-IP rate limiting middleware.
 * WHAT I OWN:  Tracking request timestamps per client IP, limiting requests
 *              within window limits, and returning 429 when limits are exceeded.
 * WHAT I DON'T: Persistent storage of limits (uses in-memory map).
 * WHO CALLS ME: server/index.js (applied to /api/proxy route).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import config from '../config.js';

/**
 * rateLimitMap — in-memory sliding-window request tracker.
 * Key: Client IP address, Value: Array of request timestamps (epoch ms).
 *
 * @type {Map<string, number[]>}
 */
const rateLimitMap = new Map();

// WHY we clean up the rateLimitMap periodically:
// Prevents memory leak over long durations as IPs change and request counts grow.
//
// WHY .unref() is called on the interval:
// Without .unref(), this interval keeps the Node.js event loop alive and
// prevents graceful shutdown from completing.
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [ip, timestamps] of rateLimitMap.entries()) {
    const validTimestamps = timestamps.filter(t => now - t < config.rateLimit.windowMs);
    if (validTimestamps.length === 0) {
      rateLimitMap.delete(ip);
    } else {
      rateLimitMap.set(ip, validTimestamps);
    }
  }
}, 60000);
cleanupInterval.unref();

/**
 * rateLimiter — Express middleware to limit requests per IP address.
 *
 * WHY we rely solely on req.ip (with trust proxy set in index.js):
 *   When `app.set('trust proxy', 1)` is configured, Express automatically
 *   parses X-Forwarded-For and sets req.ip to the real client IP. Manually
 *   reading x-forwarded-for here would bypass Express's trusted proxy logic
 *   and could be spoofed by untrusted clients.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function rateLimiter(req, res, next) {
  // WHY we guard with config.rateLimit.enabled:
  // Allows rate limiting to be disabled in development or testing environments
  // without removing the middleware from the chain.
  if (!config.rateLimit.enabled) {
    return next();
  }

  const ip = req.ip || 'unknown-ip';
  const now = Date.now();

  let timestamps = rateLimitMap.get(ip) || [];

  // Filter out timestamps outside the sliding window
  timestamps = timestamps.filter(t => now - t < config.rateLimit.windowMs);

  if (timestamps.length >= config.rateLimit.maxRequests) {
    // WHY we compute Retry-After from the oldest timestamp in the window:
    // The client needs to know when their oldest request will expire from the
    // window, which is when they'll next be allowed to make a request.
    const oldestTimestamp = timestamps[0];
    const retryAfterMs = config.rateLimit.windowMs - (now - oldestTimestamp);
    const retryAfterSec = Math.ceil(retryAfterMs / 1000);

    res.setHeader('Retry-After', String(retryAfterSec));
    return res.status(429).json({
      ok: false,
      error: {
        code: 'RATE_LIMITED',
        message: `Too many requests. Please retry after ${retryAfterSec} seconds.`
      }
    });
  }

  timestamps.push(now);
  rateLimitMap.set(ip, timestamps);
  next();
}
