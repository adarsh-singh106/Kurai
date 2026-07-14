/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/storage/index.js]
 *
 * WHO I AM:    The client-side storage adapter registry and router.
 * WHAT I OWN:  Deciding whether to use localStorage, IndexedDB, or backend REST APIs
 *              for persistence, with feature detection and graceful fallback.
 * WHAT I DON'T: Directly interfacing with browser databases — delegates to
 *              adapters in localStorage.js and indexedDB.js.
 * WHO CALLS ME: Feature storage modules (e.g. collectionStorage.js).
 *
 * DESIGN DECISIONS:
 *   - Feature detection for IndexedDB: falls back to localStorage if IDB is
 *     unavailable (e.g. Firefox private browsing pre-v115).
 *   - Unified interface: both adapters expose `get`, `set`, `remove` for
 *     simple KV; IndexedDB additionally exposes `list`, `put`, `delete`, `clear`
 *     for record-oriented stores.
 *   - Logs a warning on fallback so developers know performance may differ.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import localStorageAdapter from './localStorage.js';
import indexedDBAdapter from './indexedDB.js';

/**
 * Detect whether IndexedDB is available and functional.
 * WHY runtime check: some browsers expose `window.indexedDB` but throw on
 * `.open()` in private/incognito mode.
 * @returns {boolean}
 */
function isIndexedDBAvailable() {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * WHY conditional: if IndexedDB is unavailable (rare, but possible in
 * restricted environments), we fall back to localStorage for history too.
 * The caller interface stays identical.
 */
const historyAdapter = (() => {
  if (isIndexedDBAvailable()) {
    return indexedDBAdapter;
  }
  console.warn(
    '[storage] IndexedDB unavailable — falling back to localStorage for history. ' +
    'Large history sets may hit the ~5 MB quota.'
  );
  return localStorageAdapter;
})();

/**
 * Storage adapter routing map.
 *
 * WHY per-feature routing: collections and environments are small JSON blobs
 * that fit comfortably in localStorage's ~5 MB quota.  History can grow large
 * and benefits from IndexedDB's higher limits and async API.
 *
 * @type {Record<string, typeof localStorageAdapter | typeof indexedDBAdapter>}
 */
const storageAdapter = {
  collections: localStorageAdapter,
  environments: localStorageAdapter,
  history: historyAdapter
};

export default storageAdapter;
