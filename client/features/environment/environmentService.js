/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/environment/environmentService.js]
 *
 * WHO I AM:    Variable resolution engine + environment CRUD orchestrator.
 * WHAT I OWN:  Replacing {{placeholder}} variables in request templates, active
 *              environment selection, creating/renaming/deleting environments,
 *              and editing their variable sets.
 * WHAT I DON'T: Persisting to raw storage (environmentStorage.js) or rendering
 *              modal editors (environmentView.js).
 * WHO CALLS ME: client/features/request/requestService.js, environmentView.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import environmentStorage from './environmentStorage.js';
import state from '../../core/state.js';

/** Generate a short unique id (collision odds negligible at our scale). */
const uid = () => Math.random().toString(36).substring(2, 9);

/** Persist + push to state (emits 'environment:changed'). Single mutation funnel. */
async function commit(list) {
  await environmentStorage.saveAll(list);
  state.setEnvironments(list);
  return list;
}

const environmentService = {
  /**
   * resolveTemplate — replaces all instances of {{variableName}} with values.
   */
  resolveTemplate: (template = '') => {
    const activeEnv = state.activeEnvironment();
    const variables = activeEnv ? activeEnv.variables || [] : [];

    // Resolve mustache brackets using the environment key-value map
    return String(template).replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmed = key.trim();
      const matchVar = variables.find(v => v.key === trimmed && v.enabled);
      return matchVar ? matchVar.value : match;
    });
  },

  /**
   * resolveRequest — deep-resolves {{vars}} across the whole request:
   * URL, param/header keys+values, body content and form fields, auth secrets.
   * WHY not just the URL: tokens live in headers ({{TOKEN}}) and hosts live
   * in bodies just as often as in URLs — partial resolution is a footgun.
   */
  resolveRequest: (request) => {
    const r = environmentService.resolveTemplate;
    const kv = (items) => (items || []).map(item => ({
      ...item, key: r(item.key), value: r(item.value)
    }));

    return {
      ...request,
      url: r(request.url),
      params: kv(request.params),
      headers: kv(request.headers),
      body: request.body ? {
        ...request.body,
        content: r(request.body.content || ''),
        formData: kv(request.body.formData)
      } : request.body,
      auth: request.auth ? {
        ...request.auth,
        bearer: request.auth.bearer ? { token: r(request.auth.bearer.token || '') } : undefined,
        basic: request.auth.basic ? {
          username: r(request.auth.basic.username || ''),
          password: r(request.auth.basic.password || '')
        } : undefined,
        apiKey: request.auth.apiKey ? {
          ...request.auth.apiKey,
          key: r(request.auth.apiKey.key || ''),
          value: r(request.auth.apiKey.value || '')
        } : undefined
      } : request.auth
    };
  },

  // ─── CRUD ───────────────────────────────────────────────────────────

  createEnvironment: async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('[environments] Environment name cannot be empty.');
    const newEnv = { id: uid(), name: trimmed, variables: [] };
    await commit([...state.get('environments'), newEnv]);
    return newEnv;
  },

  renameEnvironment: async (envId, name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('[environments] Environment name cannot be empty.');
    const list = state.get('environments').map(env =>
      env.id === envId ? { ...env, name: trimmed } : env
    );
    return commit(list);
  },

  deleteEnvironment: async (envId) => {
    // Deactivate first so activeEnvironmentId never dangles.
    if (state.get('activeEnvironmentId') === envId) {
      state.setActiveEnvironmentId(null);
    }
    const list = state.get('environments').filter(env => env.id !== envId);
    return commit(list);
  },

  /** Replace the full variable list of one environment. */
  setVariables: async (envId, variables) => {
    const list = state.get('environments').map(env =>
      env.id === envId ? { ...env, variables } : env
    );
    return commit(list);
  }
};

export default environmentService;
