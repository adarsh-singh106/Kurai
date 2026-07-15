/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/collections/collectionStorage.js]
 *
 * WHO I AM:    Persistence adapter interface for request Collections.
 * WHAT I OWN:  Reading/writing collection arrays from/to browser storage adapters.
 * WHAT I DON'T: Schema structure modification logic.
 * WHO CALLS ME: client/features/collections/collectionService.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import storageAdapter from '../../storage/index.js';

const KEY = 'kurai_collections';

const collectionStorage = {
  getAll: async () => {
    return storageAdapter.collections.get(KEY) || [];
  },

  /**
   * Persist the FULL collections list.
   * WHY whole-list writes: collections are a small JSON blob; replacing the
   * array atomically is simpler and safer than per-item diffing, and it makes
   * create/update/delete all the same one-line operation for the service.
   *
   * @param {Array} list — complete collections array
   * @returns {Array} the persisted list
   */
  persist: async (list) => {
    storageAdapter.collections.set(KEY, list);
    return list;
  }
};

export default collectionStorage;
