/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/storage/indexedDB.js]
 *
 * WHO I AM:    The IndexedDB database persistence provider.
 * WHAT I OWN:  Managing IndexedDB object stores, connections, queries, and bulk
 *              removals.
 * WHAT I DON'T: Synchronous LocalStorage methods.
 * WHO CALLS ME: client/storage/index.js (specifically for request history).
 *
 * DESIGN DECISIONS:
 *   - `_dbPromise` caches the pending open so concurrent callers share one
 *     connection instead of racing to open multiple.
 *   - `put()` is used instead of `add()` so re-inserting an entry with the
 *     same `id` upserts rather than throwing a ConstraintError.
 *   - `autoIncrement` is removed because we supply our own UUIDs via `keyPath: 'id'`
 *     — combining both causes IndexedDB to overwrite the caller's ID.
 *   - `db.onclose` resets the cached instance so the next call re-opens.
 *   - Store name is validated before every transaction to give a clear error
 *     instead of a cryptic DOMException.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const DB_NAME = 'KuraiDatabase';

/**
 * WHY version 2: version 1 used autoIncrement which conflicts with caller-
 * supplied IDs.  Bumping triggers `onupgradeneeded` so we can recreate the
 * store with the correct schema.
 * @type {number}
 */
const DB_VERSION = 2;

/** @type {IDBDatabase | null} */
let dbInstance = null;

/**
 * WHY a separate promise: if two modules call `getDB()` at the same instant,
 * without this guard both would call `indexedDB.open()` and the second would
 * get a blocked/upgrade event.  Caching the promise means all concurrent
 * callers await the same connection.
 * @type {Promise<IDBDatabase> | null}
 */
let _dbPromise = null;

/**
 * Known object stores created during `onupgradeneeded`.
 * WHY explicit list: validates store names before creating transactions so
 * callers get a clear error instead of a cryptic DOMException.
 * @type {ReadonlyArray<string>}
 */
const KNOWN_STORES = Object.freeze(['history']);

/**
 * Open (or return cached) IndexedDB connection.
 *
 * @returns {Promise<IDBDatabase>}
 */
function getDB() {
  if (dbInstance) return Promise.resolve(dbInstance);
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    /**
     * Migration strategy: runs on first open AND on version bumps.
     * WHY delete-then-create: for a history store the data is expendable and
     * schema changes (removing autoIncrement) require recreating the store.
     */
    request.onupgradeneeded = (e) => {
      const db = e.target.result;

      // WHY: autoIncrement was removed — the old store schema is incompatible,
      // so we drop and recreate.  History data is non-critical.
      if (db.objectStoreNames.contains('history')) {
        db.deleteObjectStore('history');
      }
      db.createObjectStore('history', { keyPath: 'id' });
    };

    request.onsuccess = (e) => {
      dbInstance = e.target.result;

      // WHY: the browser can close the connection at any time (e.g. storage
      // pressure).  Resetting the cache ensures the next call re-opens.
      dbInstance.onclose = () => {
        console.warn('[indexedDB-adapter] Database connection closed unexpectedly.');
        dbInstance = null;
        _dbPromise = null;
      };

      resolve(dbInstance);
    };

    request.onerror = (e) => {
      _dbPromise = null;
      reject(e.target.error);
    };
  });

  return _dbPromise;
}

/**
 * Validate that `storeName` is one of our known stores.
 *
 * @param {string} storeName
 * @throws {Error} if store name is not recognised
 */
function assertKnownStore(storeName) {
  if (!KNOWN_STORES.includes(storeName)) {
    throw new Error(
      `[indexedDB-adapter] Unknown store "${storeName}". ` +
      `Known stores: ${KNOWN_STORES.join(', ')}`
    );
  }
}

const indexedDBAdapter = {
  /**
   * List all records in an object store.
   *
   * @param {string} storeName — target object store
   * @param {object} [options]
   * @param {number} [options.limit] — max records to return (pagination)
   * @returns {Promise<Array<*>>}
   */
  list: async (storeName, { limit } = {}) => {
    assertKnownStore(storeName);
    const db = await getDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readonly');
        const store = transaction.objectStore(storeName);

        if (limit && limit > 0) {
          // WHY cursor: `getAll()` with a count param is not supported in all
          // browsers.  A cursor lets us stop early for pagination.
          const results = [];
          const cursorReq = store.openCursor();
          cursorReq.onsuccess = (e) => {
            const cursor = e.target.result;
            if (cursor && results.length < limit) {
              results.push(cursor.value);
              cursor.continue();
            } else {
              resolve(results);
            }
          };
          cursorReq.onerror = () => reject(cursorReq.error);
        } else {
          const request = store.getAll();
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        }
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * Insert or update (upsert) a record.
   *
   * WHY `put` instead of `add`: `add` throws ConstraintError if the key
   * already exists.  `put` upserts, which is the correct behaviour when
   * re-saving an edited entry.
   *
   * @param {string} storeName — target object store
   * @param {*} value — record to upsert (must contain the keyPath field)
   * @returns {Promise<IDBValidKey>} the key of the written record
   */
  put: async (storeName, value) => {
    assertKnownStore(storeName);
    const db = await getDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.put(value);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * Delete a single record by key.
   *
   * @param {string} storeName — target object store
   * @param {IDBValidKey} key — primary key of the record to delete
   * @returns {Promise<boolean>} `true` on success
   */
  delete: async (storeName, key) => {
    assertKnownStore(storeName);
    const db = await getDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(key);

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });
  },

  /**
   * Clear all records from an object store.
   *
   * @param {string} storeName — target object store
   * @returns {Promise<boolean>} `true` on success
   */
  clear: async (storeName) => {
    assertKnownStore(storeName);
    const db = await getDB();
    return new Promise((resolve, reject) => {
      try {
        const transaction = db.transaction(storeName, 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();

        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      } catch (e) {
        reject(e);
      }
    });
  },

  // WHY exposed: kept for backwards compatibility — old callers use `add()`.
  // Internally delegates to `put()`.
  add: async (storeName, value) => indexedDBAdapter.put(storeName, value)
};

export default indexedDBAdapter;
