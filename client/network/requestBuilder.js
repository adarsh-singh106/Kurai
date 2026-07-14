/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/network/requestBuilder.js]
 *
 * WHO I AM:    The request object formatter.
 * WHAT I OWN:  Structuring raw request configurations, compiling query strings
 *              into the final target URL, and assembling header arrays.
 * WHAT I DON'T: Bypassing CORS or sending socket requests.
 * WHO CALLS ME: client/features/request/requestService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { applyAuthHeaders } from './auth.js';

/**
 * buildRequestObject — formats the request state into a final proxy-compatible JSON object.
 */
export function buildRequestObject(requestState, environmentVariables = []) {
  // Merge parameters into URL if enabled
  let finalUrl = requestState.url;
  const enabledParams = (requestState.params || []).filter(p => p.enabled);
  if (enabledParams.length > 0) {
    const searchParams = new URLSearchParams();
    enabledParams.forEach(p => searchParams.append(p.key, p.value));
    const separator = finalUrl.includes('?') ? '&' : '?';
    finalUrl += `${separator}${searchParams.toString()}`;
  }

  // Compile active headers
  let headers = (requestState.headers || [])
    .filter(h => h.enabled)
    .reduce((map, h) => {
      map[h.key] = h.value;
      return map;
    }, {});

  // Apply Auth headers
  const authHeaders = applyAuthHeaders(requestState.headers || [], requestState.auth || {});
  authHeaders.forEach(h => {
    if (h.enabled) {
      headers[h.key] = h.value;
    }
  });

  return {
    url: finalUrl,
    method: requestState.method || 'GET',
    headers,
    body: requestState.body?.type !== 'none' ? requestState.body?.content : undefined
  };
}
