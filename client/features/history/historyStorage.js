/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/history/historyStorage.js]
 *
 * WHO I AM:    IndexedDB persistence interface for request History.
 * WHAT I OWN:  Reading and writing request log items to browser IndexedDB store.
 * WHAT I DON'T: Capping array bounds (historyService.js concerns).
 * WHO CALLS ME: client/features/history/historyService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import storageAdapter from '../../storage/index.js';

const STORE_NAME = 'history';

const historyStorage = {
  list: async () => {
    return await storageAdapter.history.list(STORE_NAME);
  },

  add: async (entry) => {
    return await storageAdapter.history.add(STORE_NAME, entry);
  },

  clear: async () => {
    return await storageAdapter.history.clear(STORE_NAME);
  }
};

export default historyStorage;
