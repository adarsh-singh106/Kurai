/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/services/proxyEngine.js]
 *
 * WHO I AM:    The core request proxy and CORS bypass engine.
 * WHAT I OWN:  Forwarding incoming requests, DNS/IP resolving checks (SSRF blocks),
 *              per-hop redirect validation, timing and size measurements, and
 *              header sanitization.
 * WHAT I DON'T: File-system history logs or Express routing details.
 * WHO CALLS ME: server/routes/proxy.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dns from 'dns';
import config from '../config.js';

// WHY dns.promises.lookup with { all: true } instead of resolve4:
// resolve4 only returns A records, so an attacker-controlled AAAA-only hostname
// (or one whose AAAA record points at ::1 / fc00::) would bypass the blocklist
// entirely. lookup() uses the OS resolver and returns BOTH IPv4 and IPv6.
const lookupAsync = dns.promises.lookup;

// Blocked private/loopback/metadata IPv4 ranges (SSRF protection)
// WHY: Prevent clients from probing local networks (like AWS metadata) through Kurai
const BLOCKED_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^localhost$/i,
  /^169\.254\./,   // Link-local metadata
  /^0\.0\.0\.0$/,
  /^0\./           // 0.0.0.0/8 aliases resolve to localhost on Linux
];

// Blocked IPv6 ranges (loopback, unique-local, link-local, unspecified)
const BLOCKED_IPV6_RANGES = [
  /^::1$/,          // loopback
  /^::$/,           // unspecified
  /^f[cd][0-9a-f]{2}:/i, // fc00::/7 unique local
  /^fe[89ab][0-9a-f]:/i  // fe80::/10 link local
];

// Hop-by-hop headers that must not be forwarded
const STRIP_HEADERS = ['host', 'connection', 'transfer-encoding', 'cookie', 'content-length'];

// WHY we cap redirects manually instead of using redirect: 'follow':
// fetch's built-in follow mode re-requests each Location target WITHOUT
// re-running our SSRF checks — a public URL could 302 into 169.254.169.254.
// Following manually lets us validate every hop.
const MAX_REDIRECTS = 5;

/**
 * ProxyError — typed error carrying an HTTP status + machine-readable code
 * so errorHandler.js can map proxy failures to precise client responses
 * instead of generic 500s.
 */
export class ProxyError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

/**
 * isBlockedIp — matches a resolved IP against the IPv4/IPv6 SSRF blocklists.
 */
function isBlockedIp(ip) {
  // Normalise IPv4-mapped IPv6 addresses (::ffff:127.0.0.1) to plain IPv4
  const normalized = ip.toLowerCase().startsWith('::ffff:') ? ip.slice(7) : ip;
  if (BLOCKED_IP_RANGES.some(regex => regex.test(normalized))) return true;
  if (BLOCKED_IPV6_RANGES.some(regex => regex.test(normalized))) return true;
  return false;
}

/**
 * assertHostAllowed — resolves target host (IPv4 + IPv6) and throws a typed
 * 403 ProxyError when it lands in a blocked range.
 */
async function assertHostAllowed(hostname) {
  if (config.proxy.allowPrivateIps) {
    return;
  }

  // Strip brackets from IPv6 literals like [::1]
  const bareHost = hostname.replace(/^\[|\]$/g, '');

  // Check hostname/IP-literal directly
  if (BLOCKED_IP_RANGES.some(regex => regex.test(bareHost)) || isBlockedIp(bareHost)) {
    throw new ProxyError(403, 'SSRF_BLOCKED', `Request to ${hostname} is forbidden.`);
  }

  try {
    // Resolve DNS to check real IPs (prevents DNS rebinding attacks)
    const addresses = await lookupAsync(bareHost, { all: true, verbatim: true });
    for (const { address } of addresses) {
      if (isBlockedIp(address)) {
        throw new ProxyError(403, 'SSRF_BLOCKED', `Request to ${hostname} resolves to a forbidden address.`);
      }
    }
  } catch (error) {
    if (error instanceof ProxyError) throw error;
    // If DNS resolve fails, it might be an unresolvable hostname, we allow fetch to handle/fail it
  }
}

/**
 * sanitizeHeaders — removes dangerous hop-by-hop headers.
 */
function sanitizeHeaders(headers = {}) {
  const clean = {};
  for (const [key, value] of Object.entries(headers)) {
    if (!STRIP_HEADERS.includes(key.toLowerCase())) {
      clean[key] = value;
    }
  }
  return clean;
}

/**
 * readBodyWithSizeLimit — reads stream with a byte counter.
 *
 * WHY we tolerate a missing body stream:
 *   204 No Content, 304, and HEAD responses have response.body === null;
 *   calling getReader() on null crashed the whole proxy request.
 */
async function readBodyWithSizeLimit(response, limit) {
  if (!response.body) {
    return '';
  }

  const reader = response.body.getReader();
  let chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.length;
    if (totalBytes > limit) {
      // Cancel the stream so the upstream socket is released immediately
      await reader.cancel().catch(() => {});
      throw new ProxyError(413, 'RESPONSE_TOO_LARGE', `Response size limit of ${limit} bytes exceeded.`);
    }
    chunks.push(value);
  }

  // Concatenate all chunks and convert to string
  const totalBuffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    totalBuffer.set(chunk, offset);
    offset += chunk.length;
  }

  return new TextDecoder('utf-8').decode(totalBuffer);
}

/**
 * fetchWithSsrfSafeRedirects — follows redirects manually, re-validating the
 * target host on EVERY hop so a public origin cannot bounce Kurai into a
 * private network.
 */
async function fetchWithSsrfSafeRedirects(url, fetchOptions) {
  let currentUrl = url;
  let currentOptions = { ...fetchOptions, redirect: 'manual' };

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const response = await fetch(currentUrl, currentOptions);

    // Not a redirect — done
    if (![301, 302, 303, 307, 308].includes(response.status)) {
      return { response, finalUrl: currentUrl };
    }

    const location = response.headers.get('location');
    if (!location) {
      return { response, finalUrl: currentUrl };
    }

    if (hop === MAX_REDIRECTS) {
      throw new ProxyError(502, 'TOO_MANY_REDIRECTS', `Exceeded ${MAX_REDIRECTS} redirects.`);
    }

    // Drain the redirect body so its socket is reusable
    await response.body?.cancel().catch(() => {});

    const nextUrl = new URL(location, currentUrl);
    await assertHostAllowed(nextUrl.hostname);

    // WHY 301/302/303 downgrade to GET (per the fetch spec):
    // Browsers and curl do the same; replaying a POST body on a 302 target
    // is both surprising and a data-leak risk on cross-origin redirects.
    if (response.status === 303 ||
        ((response.status === 301 || response.status === 302) && currentOptions.method !== 'GET' && currentOptions.method !== 'HEAD')) {
      currentOptions = { ...currentOptions, method: 'GET', body: undefined };
    }

    // Never forward credentials/custom headers cross-origin on a redirect
    if (nextUrl.origin !== new URL(currentUrl).origin) {
      const headers = { ...currentOptions.headers };
      delete headers.authorization;
      delete headers.Authorization;
      currentOptions = { ...currentOptions, headers };
    }

    currentUrl = nextUrl.toString();
  }
}

/**
 * forwardRequest — main request forwarder logic.
 */
export async function forwardRequest({ method, url, headers = {}, body, timeout = config.proxy.timeoutMs }) {
  const start = process.hrtime.bigint();

  let urlObj;
  try {
    urlObj = new URL(url);
  } catch {
    throw new ProxyError(400, 'INVALID_URL', `Invalid URL: ${url}`);
  }

  // WHY we only allow http/https:
  // file://, ftp:// and friends would let clients read server-local resources.
  if (!['http:', 'https:'].includes(urlObj.protocol)) {
    throw new ProxyError(400, 'INVALID_PROTOCOL', `Protocol '${urlObj.protocol}' is not allowed.`);
  }

  await assertHostAllowed(urlObj.hostname);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions = {
      method,
      headers: sanitizeHeaders(headers),
      signal: controller.signal
    };

    if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
      fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
    }

    const { response, finalUrl } = await fetchWithSsrfSafeRedirects(url, fetchOptions);

    const limit = config.proxy.maxResponseBytes;
    const bodyText = await readBodyWithSizeLimit(response, limit);

    // WHY duration is measured after the body is fully read:
    // "time" should reflect what the developer actually waited for — headers
    // arriving quickly with a slow-streaming body still feels slow.
    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      // WHY getSetCookie: entries() folds multiple Set-Cookie headers into one
      // comma-joined string — this keeps each cookie intact for the client.
      setCookies: response.headers.getSetCookie(),
      body: bodyText,
      time: Math.round(durationMs),
      size: Buffer.byteLength(bodyText, 'utf8'),
      finalUrl
    };
  } catch (error) {
    if (error instanceof ProxyError) throw error;

    // AbortError → the timeout above fired
    if (error.name === 'AbortError') {
      throw new ProxyError(504, 'UPSTREAM_TIMEOUT', `Target did not respond within ${timeout}ms.`);
    }

    // Network-level failures (DNS, refused connection, TLS) → 502, not 500:
    // the target failed, not Kurai.
    throw new ProxyError(502, 'UPSTREAM_UNREACHABLE', `Could not reach target: ${error.cause?.code || error.message}`);
  } finally {
    clearTimeout(timer);
  }
}
