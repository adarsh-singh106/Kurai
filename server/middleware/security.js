/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/middleware/security.js]
 *
 * WHO I AM:    Security headers and protection middleware.
 * WHAT I OWN:  Injecting HTTP response headers that protect the application
 *              from XSS, Clickjacking, MIME sniffing, and information leakage.
 * WHAT I DON'T: User authentication (auth.js concerns) or IP blocklists (proxy concern).
 * WHO CALLS ME: server/index.js (Express global middlewares).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import config from '../config.js';

/**
 * securityMiddleware — sets defensive HTTP response headers.
 *
 * WHY we implement this manually instead of using helmet:
 *   Kurai has zero external security dependencies by design; this keeps the
 *   attack surface small and the dependency tree auditable.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
export function securityMiddleware(req, res, next) {
  // Prevent clickjacking
  res.setHeader('X-Frame-Options', 'DENY');

  // Disable MIME sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Enable XSS filtering in older browsers
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // WHY we removed 'unsafe-inline' from script-src:
  // Kurai's client uses external JS files only — no inline <script> tags.
  // Keeping 'unsafe-inline' would negate most XSS protections that CSP provides.
  // style-src still needs 'unsafe-inline' because dynamically-set inline styles
  // are used by the editor and response panels.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self';"
  );

  // WHY Referrer-Policy is set to strict-origin-when-cross-origin:
  // Prevents leaking full URLs (with query params that may contain tokens)
  // to third-party origins, while still sending the origin for same-site requests.
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');

  // WHY Permissions-Policy restricts all sensitive APIs:
  // Kurai is a developer tool that never needs camera, microphone, geolocation,
  // or payment APIs. Disabling them reduces the blast radius of XSS attacks.
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=()'
  );

  // WHY HSTS is only set in production:
  // In development, HTTPS may not be configured; setting HSTS would
  // cause browsers to refuse HTTP connections to localhost.
  if (config.nodeEnv === 'production') {
    res.setHeader(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  next();
}
