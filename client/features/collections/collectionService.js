/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/collections/collectionService.js]
 *
 * WHO I AM:    Business logic orchestrator for request Collections.
 * WHAT I OWN:  Creating collections, editing names, nesting requests/folders,
 *              deleting nodes, and validation of schemas.
 * WHAT I DON'T: DOM node renders (collectionView.js owns that) or raw persistence
 *              disk operations (collectionStorage.js owns that).
 * WHO CALLS ME: collectionView.js (user interactions) or main.js (initial load).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import collectionStorage from './collectionStorage.js';
import state from '../../core/state.js';

const collectionService = {
  loadCollections: async () => {
    const list = await collectionStorage.getAll();
    state.setCollections(list);
    return list;
  },

  createCollection: async (name) => {
    const newColl = {
      id: Math.random().toString(36).substring(2, 9),
      name,
      items: [],
      variables: [],
      auth: { type: 'inherit' }
    };
    const saved = await collectionStorage.save(newColl);
    const all = [...state.get('collections'), saved];
    state.setCollections(all);
    return saved;
  }
};

export default collectionService;
