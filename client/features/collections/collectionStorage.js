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

  save: async (collection) => {
    const list = storageAdapter.collections.get(KEY) || [];
    list.push(collection);
    storageAdapter.collections.set(KEY, list);
    return collection;
  }
};

export default collectionStorage;
