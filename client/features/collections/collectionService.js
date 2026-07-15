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
import { LIMITS } from '../../core/constants.js';

/** Generate a short unique id (collision odds negligible at our scale). */
const uid = () => Math.random().toString(36).substring(2, 9);

/**
 * Persist the given list and push it into state (which emits
 * 'collection:updated' so the sidebar re-renders). Single funnel for every
 * mutation below — persistence and reactivity can never drift apart.
 */
async function commit(list) {
  await collectionStorage.persist(list);
  state.setCollections(list);
  return list;
}

const collectionService = {
  loadCollections: async () => {
    const list = await collectionStorage.getAll();
    state.setCollections(list);
    return list;
  },

  createCollection: async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('[collections] Collection name cannot be empty.');

    const existing = state.get('collections');
    if (existing.length >= LIMITS.MAX_COLLECTIONS) {
      throw new Error(`[collections] Limit of ${LIMITS.MAX_COLLECTIONS} collections reached.`);
    }

    const newColl = {
      id: uid(),
      name: trimmed,
      items: [],
      variables: [],
      auth: { type: 'inherit' }
    };
    await commit([...existing, newColl]);
    return newColl;
  },

  renameCollection: async (collectionId, name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) throw new Error('[collections] Collection name cannot be empty.');
    const list = state.get('collections').map(coll =>
      coll.id === collectionId ? { ...coll, name: trimmed } : coll
    );
    return commit(list);
  },

  deleteCollection: async (collectionId) => {
    const list = state.get('collections').filter(coll => coll.id !== collectionId);
    return commit(list);
  },

  /**
   * Save a request snapshot into a collection.
   * WHY snapshot (own id + copy) instead of a reference: the request keeps
   * living in the builder afterwards; edits there must not silently mutate
   * the saved copy.
   */
  saveRequestToCollection: async (collectionId, request, name) => {
    const item = {
      ...request,
      id: uid(),
      name: (name || request.name || request.url || 'Untitled request').trim()
    };
    const list = state.get('collections').map(coll =>
      coll.id === collectionId
        ? { ...coll, items: [...(coll.items || []), item] }
        : coll
    );
    await commit(list);
    return item;
  },

  removeRequestFromCollection: async (collectionId, requestId) => {
    const list = state.get('collections').map(coll =>
      coll.id === collectionId
        ? { ...coll, items: (coll.items || []).filter(item => item.id !== requestId) }
        : coll
    );
    return commit(list);
  },

  /** Resolve a saved request by ids (used by the view's click-to-load). */
  findRequest: (collectionId, requestId) => {
    const coll = state.get('collections').find(c => c.id === collectionId);
    return coll?.items?.find(item => item.id === requestId) || null;
  }
};

export default collectionService;
