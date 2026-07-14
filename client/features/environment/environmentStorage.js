/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/environment/environmentStorage.js]
 *
 * WHO I AM:    Persistence manager for environments and variables.
 * WHAT I OWN:  Reading and writing environment collections to browser storage adapters.
 * WHAT I DON'T: Variable replacement mechanics.
 * WHO CALLS ME: client/features/environment/environmentService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import storageAdapter from '../../storage/index.js';

const KEY = 'kurai_environments';

const environmentStorage = {
  getAll: async () => {
    return storageAdapter.environments.get(KEY) || [];
  },

  saveAll: async (environments) => {
    return storageAdapter.environments.set(KEY, environments);
  }
};

export default environmentStorage;
