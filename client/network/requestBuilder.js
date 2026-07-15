/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/network/requestBuilder.js]
 *
 * WHO I AM:    The request object formatter.
 * WHAT I OWN:  Structuring raw request configurations, compiling query strings
 *              into the final target URL, encoding bodies per type, and
 *              assembling header arrays.
 * WHAT I DON'T: Bypassing CORS or sending socket requests.
 * WHO CALLS ME: client/features/request/requestService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { applyAuthHeaders } from './auth.js';
import { CONTENT_TYPES } from '../core/constants.js';
import { splitUrl, buildQuery } from '../core/urlQuery.js';

/**
 * Content-Type implied by each body type.
 * WHY no multipart here: real multipart needs boundary handling and file
 * support; until then form data is sent urlencoded, which every server
 * framework parses identically for text fields.
 */
const BODY_CONTENT_TYPES = {
  json: CONTENT_TYPES.JSON,
  text: CONTENT_TYPES.TEXT,
  form: CONTENT_TYPES.FORM,
  urlencoded: CONTENT_TYPES.FORM
};

/** Encode the request body per its declared type. */
function encodeBody(body) {
  const type = body?.type || 'none';
  if (type === 'none') return undefined;
  if (type === 'form' || type === 'urlencoded') {
    const pairs = (body.formData || []).filter(f => f.enabled && f.key);
    const params = new URLSearchParams();
    pairs.forEach(f => params.append(f.key, f.value));
    return params.toString();
  }
  return body.content;
}

/**
 * buildRequestObject — formats the request state into a final proxy-compatible JSON object.
 */
export function buildRequestObject(requestState) {
  const auth = requestState.auth || {};

  // WHY rebuild the query exclusively from params: the URL bar and the params
  // rows are two views of the same query string (live-synced in the UI), so
  // appending would duplicate every pair. The base URL is authoritative for
  // everything before '?'; the params array is authoritative for the query.
  // No URLSearchParams — it would percent-mangle values; the server-side
  // new URL() call normalises encoding.
  const { base } = splitUrl(requestState.url);
  const queryParts = [];
  const paramsQuery = buildQuery(requestState.params || []);
  if (paramsQuery) queryParts.push(paramsQuery);

  // API key auth may target the query string instead of a header.
  if (auth.type === 'apiKey' && auth.apiKey?.in === 'query' && auth.apiKey?.key) {
    queryParts.push(`${auth.apiKey.key}=${auth.apiKey.value || ''}`);
  }

  const queryString = queryParts.join('&');
  const finalUrl = queryString ? `${base}?${queryString}` : base;

  // Compile active headers
  let headers = (requestState.headers || [])
    .filter(h => h.enabled)
    .reduce((map, h) => {
      map[h.key] = h.value;
      return map;
    }, {});

  // Apply Auth headers
  const authHeaders = applyAuthHeaders(requestState.headers || [], auth);
  authHeaders.forEach(h => {
    if (h.enabled) {
      headers[h.key] = h.value;
    }
  });

  const body = encodeBody(requestState.body);

  // Auto Content-Type from body type — unless the user set one explicitly.
  const bodyType = requestState.body?.type || 'none';
  const hasExplicitContentType = Object.keys(headers)
    .some(k => k.toLowerCase() === 'content-type');
  if (body !== undefined && !hasExplicitContentType && BODY_CONTENT_TYPES[bodyType]) {
    headers['Content-Type'] = BODY_CONTENT_TYPES[bodyType];
  }

  return {
    url: finalUrl,
    method: requestState.method || 'GET',
    headers,
    body
  };
}
