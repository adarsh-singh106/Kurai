/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/core/urlQuery.js]
 *
 * WHO I AM:    Query-string helpers for the URL ↔ Params two-way sync.
 * WHAT I OWN:  Splitting a URL on its first '?', parsing a query string into
 *              KV rows, and rebuilding a URL from a params array.
 * WHAT I DON'T: Encoding or validation. WHY manual string ops instead of
 *              new URL()/URLSearchParams: URLs here may contain {{templates}}
 *              ({{BASE_URL}}/users?id={{ID}}) which those APIs percent-encode
 *              or reject. Values stay verbatim; the server's new URL() call
 *              normalises encoding at send time.
 * WHO CALLS ME: client/features/request/requestView.js,
 *               client/network/requestBuilder.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Split a URL on the FIRST '?' → { base, query } (query without the '?'). */
export function splitUrl(url = '') {
  const idx = url.indexOf('?');
  return idx === -1
    ? { base: url, query: '' }
    : { base: url.slice(0, idx), query: url.slice(idx + 1) };
}

/**
 * Parse a query string into KV rows: 'a=1&b' → [{key:'a',value:'1',enabled:true},
 * {key:'b',value:'',enabled:true}]. Pairs split on the FIRST '=' only, so
 * values containing '=' (base64, JWTs) survive. Empty segments ('&&') skipped.
 */
export function parseQuery(query = '') {
  return query
    .split('&')
    .filter(segment => segment !== '')
    .map(segment => {
      const eq = segment.indexOf('=');
      return eq === -1
        ? { key: segment, value: '', enabled: true }
        : { key: segment.slice(0, eq), value: segment.slice(eq + 1), enabled: true };
    });
}

/** Serialise enabled, non-empty-key params to 'k=v&k2=v2' (verbatim, no encoding). */
export function buildQuery(params = []) {
  return params
    .filter(p => p.enabled && p.key)
    .map(p => `${p.key}=${p.value ?? ''}`)
    .join('&');
}

/** Replace a URL's query string with one rebuilt from the params array. */
export function replaceQuery(url, params) {
  const { base } = splitUrl(url);
  const query = buildQuery(params);
  return query ? `${base}?${query}` : base;
}
