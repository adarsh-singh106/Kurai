/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [server/services/proxyEngine.js]
 *
 * WHO I AM:    The core request proxy and CORS bypass engine.
 * WHAT I OWN:  Forwarding incoming requests, DNS/IP resolving checks (SSRF blocks),
 *              timing and size measurements, and header sanitization.
 * WHAT I DON'T: File-system history logs or Express routing details.
 * WHO CALLS ME: server/routes/proxy.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import dns from 'dns';
import { promisify } from 'util';
import config from '../config.js';

const resolve4Async = promisify(dns.resolve4);

// Blocked private/loopback/metadata IP ranges (SSRF protection)
// WHY: Prevent clients from probing local networks (like AWS metadata) through Kurai
const BLOCKED_IP_RANGES = [
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  /^127\./,
  /^::1$/,
  /^localhost$/i,
  /^169\.254\./,   // Link-local metadata
  /^0\.0\.0\.0$/
];

// Hop-by-hop headers that must not be forwarded
const STRIP_HEADERS = ['host', 'connection', 'transfer-encoding', 'cookie'];

/**
 * isBlockedHost — resolves target host to IPv4 and matches against SSRF blocklist.
 */
async function isBlockedHost(hostname) {
  if (config.proxy.allowPrivateIps) {
    return false;
  }

  // Check hostname directly
  if (BLOCKED_IP_RANGES.some(regex => regex.test(hostname))) {
    return true;
  }

  try {
    // Resolve DNS to check real IP (prevents DNS rebinding attacks)
    const ips = await resolve4Async(hostname);
    for (const ip of ips) {
      if (BLOCKED_IP_RANGES.some(regex => regex.test(ip))) {
        return true;
      }
    }
  } catch (error) {
    // If DNS resolve fails, it might be an unresolvable hostname, we allow fetch to handle/fail it
  }

  return false;
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
 */
async function readBodyWithSizeLimit(response, limit) {
  const reader = response.body.getReader();
  let chunks = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    totalBytes += value.length;
    if (totalBytes > limit) {
      throw new Error(`Response size limit of ${limit} bytes exceeded.`);
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
 * forwardRequest — main request forwarder logic.
 */
export async function forwardRequest({ method, url, headers = {}, body, timeout = config.proxy.timeoutMs }) {
  const start = process.hrtime.bigint();

  const urlObj = new URL(url);
  const isBlocked = await isBlockedHost(urlObj.hostname);
  if (isBlocked) {
    throw new Error(`SSRF Blocked: Request to ${urlObj.hostname} is forbidden.`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    const fetchOptions = {
      method,
      headers: sanitizeHeaders(headers),
      signal: controller.signal,
      redirect: 'follow'
    };

    if (body && !['GET', 'HEAD'].includes(method.toUpperCase())) {
      fetchOptions.body = typeof body === 'object' ? JSON.stringify(body) : body;
    }

    const response = await fetch(url, fetchOptions);

    const end = process.hrtime.bigint();
    const durationMs = Number(end - start) / 1_000_000;

    const limit = config.proxy.maxResponseBytes;
    const bodyText = await readBodyWithSizeLimit(response, limit);

    return {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: bodyText,
      time: Math.round(durationMs),
      size: Buffer.byteLength(bodyText, 'utf8')
    };
  } finally {
    clearTimeout(timer);
  }
}
