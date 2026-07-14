/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/network/auth.js]
 *
 * WHO I AM:    Helper for assembling authentication headers.
 * WHAT I OWN:  Injecting appropriate authorization parameters (Bearer tokens, Basic base64 credentials,
 *              API key headers/query params) into standard request structures.
 * WHAT I DON'T: Any user authentication state or local storage persistence.
 * WHO CALLS ME: client/network/requestBuilder.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * applyAuthHeaders — applies auth criteria to headers map.
 */
export function applyAuthHeaders(headers = [], authConfig = {}) {
  const finalHeaders = [...headers];

  if (authConfig.type === 'bearer' && authConfig.bearer?.token) {
    finalHeaders.push({ key: 'Authorization', value: `Bearer ${authConfig.bearer.token}`, enabled: true });
  } else if (authConfig.type === 'basic' && authConfig.basic?.username) {
    const credentials = btoa(`${authConfig.basic.username}:${authConfig.basic.password || ''}`);
    finalHeaders.push({ key: 'Authorization', value: `Basic ${credentials}`, enabled: true });
  } else if (authConfig.type === 'apiKey' && authConfig.apiKey?.key && authConfig.apiKey?.value) {
    if (authConfig.apiKey.in === 'header') {
      finalHeaders.push({ key: authConfig.apiKey.key, value: authConfig.apiKey.value, enabled: true });
    }
  }

  return finalHeaders;
}
