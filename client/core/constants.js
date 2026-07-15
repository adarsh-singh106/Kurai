/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/core/constants.js]
 *
 * WHO I AM:    Core application constants container.
 * WHAT I OWN:  Defining read-only static constants like HTTP request methods,
 *              common request headers, response status code mappings, UI color
 *              tokens for methods/statuses, MIME type aliases, and hard limits.
 * WHAT I DON'T: Any dynamic configurations or state properties.
 * WHO CALLS ME: Any feature or view requiring standard definitions.
 *
 * IMMUTABILITY: Every exported value is deep-frozen via `Object.freeze()` so
 *               that no consumer can accidentally mutate a shared constant.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * Supported HTTP request methods.
 * WHY frozen: prevents accidental `.push()` from feature code which would
 * silently add invalid methods across the entire app.
 * @type {Readonly<string[]>}
 */
export const HTTP_METHODS = Object.freeze([
  'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS', 'QUERY'
]);

/**
 * Default headers injected into every new request scaffold.
 * WHY each item is frozen independently: `Object.freeze()` on an array only
 * freezes the array itself (length, indices) — the objects inside remain
 * mutable unless we freeze them too.
 * @type {Readonly<Array<Readonly<{key: string, value: string, enabled: boolean}>>>}
 */
export const DEFAULT_HEADERS = Object.freeze([
  Object.freeze({ key: 'Content-Type', value: 'application/json', enabled: true }),
  Object.freeze({ key: 'Accept', value: '*/*', enabled: true })
]);

/**
 * Comprehensive HTTP response status code → human label map.
 * WHY exhaustive: the response panel uses this to render status badges; missing
 * codes would fall through to "Unknown" which hurts usability.
 * @type {Readonly<Record<number, string>>}
 */
export const RESPONSE_STATUS_CODES = Object.freeze({
  // 2xx — Success
  200: 'OK',
  201: 'Created',
  204: 'No Content',
  // 3xx — Redirection
  301: 'Moved Permanently',
  302: 'Found',
  304: 'Not Modified',
  // 4xx — Client Errors
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  408: 'Request Timeout',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  // 5xx — Server Errors
  500: 'Internal Server Error',
  502: 'Bad Gateway',
  503: 'Service Unavailable',
  504: 'Gateway Timeout'
});

/**
 * CSS variable tokens mapped to each HTTP method for UI badge coloring.
 * WHY CSS variables instead of hex: keeps constants layer decoupled from the
 * active theme — the actual color is resolved at render time by the browser.
 * @type {Readonly<Record<string, string>>}
 */
export const METHOD_COLORS = Object.freeze({
  GET:     'var(--color-method-get)',
  POST:    'var(--color-method-post)',
  PUT:     'var(--color-method-put)',
  PATCH:   'var(--color-method-patch)',
  DELETE:  'var(--color-method-delete)',
  HEAD:    'var(--color-method-head)',
  OPTIONS: 'var(--color-method-options)',
  QUERY:   'var(--color-method-query)'
});

/**
 * Status range → CSS variable tokens for response status badges.
 * WHY ranges instead of individual codes: there are hundreds of possible status
 * codes; grouping by class (2xx, 3xx, …) matches HTTP semantics and keeps
 * the map small.
 * @type {Readonly<Record<string, string>>}
 */
export const STATUS_COLORS = Object.freeze({
  '2xx': 'var(--color-status-success)',
  '3xx': 'var(--color-status-redirect)',
  '4xx': 'var(--color-status-client-error)',
  '5xx': 'var(--color-status-server-error)'
});

/**
 * Common MIME content-type strings used in request body type selectors.
 * @type {Readonly<Record<string, string>>}
 */
export const CONTENT_TYPES = Object.freeze({
  JSON:       'application/json',
  XML:        'application/xml',
  FORM:       'application/x-www-form-urlencoded',
  MULTIPART:  'multipart/form-data',
  TEXT:       'text/plain',
  HTML:       'text/html'
});

/**
 * Hard limits enforced across the client to prevent runaway payloads and
 * unbounded list growth.
 * WHY explicit limits: without these, a user pasting a 50 MB JSON body could
 * freeze the CodeMirror editor, and unlimited history would bloat localStorage.
 * @type {Readonly<Record<string, number>>}
 */
export const LIMITS = Object.freeze({
  /** Maximum URL length in characters (matches common browser limits) */
  MAX_URL_LENGTH: 2048,
  /** Maximum request body size in bytes (~5 MB) */
  MAX_BODY_SIZE: 5 * 1024 * 1024,
  /** Maximum saved history entries before oldest is evicted */
  MAX_HISTORY_ENTRIES: 50,
  /** Maximum headers allowed per request */
  MAX_HEADERS: 100,
  /** Maximum query parameters per request */
  MAX_PARAMS: 100,
  /** Maximum number of collections */
  MAX_COLLECTIONS: 200,
  /** Maximum event listeners before emitting a warning (leak detection) */
  MAX_EVENT_LISTENERS: 10
});
