/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/request/requestService.js]
 *
 * WHO I AM:    Request execution coordinator.
 * WHAT I OWN:  Compiling target variables, calling the request formatter, dispatching
 *              the request to the network proxy client, and updating states.
 * WHAT I DON'T: Directly changing DOM elements.
 * WHO CALLS ME: client/features/request/requestView.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import state from '../../core/state.js';
import eventBus from '../../core/eventBus.js';
import { buildRequestObject } from '../../network/requestBuilder.js';
import { sendProxiedRequest } from '../../network/proxyClient.js';
import historyService from '../history/historyService.js';
import environmentService from '../environment/environmentService.js';

const requestService = {
  sendCurrentRequest: async () => {
    const rawRequest = state.get('currentRequest');

    // Resolve mustache variables everywhere they can appear: URL, params,
    // headers, body content/fields, and auth secrets.
    const resolvedRequest = environmentService.resolveRequest(rawRequest);

    // WHY fail fast: an unresolved {{VAR}} would reach the proxy and bounce as
    // a cryptic 400. Catch it here with a message that names the variable —
    // and do it before setLoading so no spinner cleanup is needed.
    const unresolved = resolvedRequest.url.match(/\{\{([^}]+)\}\}/);
    if (unresolved) {
      eventBus.emit('response:error', new Error(
        `Unresolved variable {{${unresolved[1].trim()}}} in URL — select an environment or define the variable.`
      ));
      return;
    }

    state.setLoading(true);
    eventBus.emit('request:sending');

    try {
      const formattedRequest = buildRequestObject(resolvedRequest);

      // Attach the post-response test script (if any). WHY the raw script and
      // not the resolved one: a script containing "{{" is code, not a template
      // — scripts read env values through kurai.variables.get() instead.
      const script = (rawRequest.tests || '').trim();
      if (script) {
        const activeEnv = state.activeEnvironment();
        formattedRequest.script = rawRequest.tests;
        formattedRequest.variables = (activeEnv?.variables || [])
          .filter(v => v.enabled && v.key)
          .reduce((map, v) => ({ ...map, [v.key]: v.value }), {});
      }

      const responseData = await sendProxiedRequest(formattedRequest);

      state.setResponse(responseData);

      // Scripts can kurai.variables.set() — merge changes back into the
      // active environment so extracted values ({{TOKEN}}) chain into the
      // next request.
      if (script && responseData.variables) {
        await mergeScriptVariables(responseData.variables);
      }

      // Save sent request to circular history buffer
      await historyService.addEntry(rawRequest);
    } catch (error) {
      console.error('[request-service] Send failed:', error);
      eventBus.emit('response:error', error);
    } finally {
      state.setLoading(false);
    }
  }
};

/**
 * Merge variables returned by a test script into the active environment.
 * Updates matching keys, appends new ones, and skips the storage write when
 * nothing actually changed.
 */
async function mergeScriptVariables(scriptVariables) {
  const activeEnv = state.activeEnvironment();
  if (!activeEnv) return;

  const merged = structuredClone(activeEnv.variables || []);
  let changed = false;

  for (const [key, value] of Object.entries(scriptVariables)) {
    const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
    const existing = merged.find(v => v.key === key);
    if (existing) {
      if (existing.value !== stringValue) {
        existing.value = stringValue;
        changed = true;
      }
    } else {
      merged.push({ key, value: stringValue, enabled: true });
      changed = true;
    }
  }

  if (changed) await environmentService.setVariables(activeEnv.id, merged);
}

export default requestService;
