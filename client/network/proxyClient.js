/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/network/proxyClient.js]
 *
 * WHO I AM:    The client API proxy dispatcher.
 * WHAT I OWN:  Posting prepared request structures to the backend proxy URL `/api/proxy`
 *              and returning the target response object.
 * WHAT I DON'T: Any UI updates (views own that) or state mutation.
 * WHO CALLS ME: client/features/request/requestService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * sendProxiedRequest — dispatches request payloads to the local proxy backend.
 */
export async function sendProxiedRequest(requestPayload) {
  const response = await fetch('/api/proxy', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(requestPayload)
  });

  const body = await response.json();
  
  if (!body.ok) {
    throw new Error(body.error?.message || 'Proxy request failed');
  }

  return body.data;
}
