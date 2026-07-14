/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/environment/environmentService.js]
 *
 * WHO I AM:    Variable resolution engine.
 * WHAT I OWN:  Replacing {{placeholder}} variables in request templates, active
 *              environment selection, and dynamic variable lookup chain.
 * WHAT I DON'T: Persisting variables or rendering modal editors.
 * WHO CALLS ME: client/features/request/requestService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import state from '../../core/state.js';

const environmentService = {
  /**
   * resolveTemplate — replaces all instances of {{variableName}} with values.
   */
  resolveTemplate: (template = '') => {
    const activeEnv = state.activeEnvironment();
    const variables = activeEnv ? activeEnv.variables || [] : [];
    
    // Resolve mustache brackets using the environment key-value map
    return template.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
      const trimmed = key.trim();
      const matchVar = variables.find(v => v.key === trimmed && v.enabled);
      return matchVar ? matchVar.value : match;
    });
  }
};

export default environmentService;
