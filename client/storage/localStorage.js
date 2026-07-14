/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/storage/localStorage.js]
 *
 * WHO I AM:    The localStorage persistence provider.
 * WHAT I OWN:  Storing and retrieving key-value pairs in window.localStorage
 *              with namespace prefixing and quota-exceeded safety.
 * WHAT I DON'T: File-system I/O or browser IndexedDB operations.
 * WHO CALLS ME: client/storage/index.js.
 *
 * DESIGN DECISIONS:
 *   - All keys are prefixed with `NAMESPACE` to avoid collisions with other
 *     apps on the same origin.
 *   - `set()` explicitly catches `QuotaExceededError` and surfaces it so
 *     callers can show a user-friendly "storage full" message.
 *   - Every public method is wrapped in try/catch so a corrupt value in one
 *     key cannot crash the entire app.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/**
 * WHY prefix: multiple apps sharing the same origin would overwrite each
 * other's keys without namespacing.
 * @type {string}
 */
const NAMESPACE = 'kurai:';

/**
 * Prepends the namespace prefix to a raw key.
 * @param {string} key — raw storage key
 * @returns {string} prefixed key safe for localStorage
 */
const prefixKey = (key) => `${NAMESPACE}${key}`;

const localStorageAdapter = {
  /**
   * Retrieve and JSON-parse a value from localStorage.
   *
   * @param {string} key — raw key (will be auto-prefixed)
   * @returns {*} parsed value, or `null` if missing / corrupt
   */
  get: (key) => {
    try {
      const data = localStorage.getItem(prefixKey(key));
      return data ? JSON.parse(data) : null;
    } catch (e) {
      console.error('[localStorage-adapter] Error reading key:', key, e);
      return null;
    }
  },

  /**
   * JSON-stringify and persist a value to localStorage.
   *
   * WHY specific QuotaExceededError handling: the browser throws a DOMException
   * with name "QuotaExceededError" when storage is full. We surface a distinct
   * error message so callers can prompt the user to free space, rather than
   * silently losing data.
   *
   * @param {string} key — raw key (will be auto-prefixed)
   * @param {*} value — JSON-serialisable value
   * @returns {boolean} `true` on success
   * @throws {Error} with descriptive message on quota exceeded
   */
  set: (key, value) => {
    try {
      localStorage.setItem(prefixKey(key), JSON.stringify(value));
      return true;
    } catch (e) {
      // WHY: QuotaExceededError is a DOMException subclass.  We check by name
      // rather than `instanceof` because some browsers don't expose the class.
      if (e?.name === 'QuotaExceededError') {
        console.error(
          '[localStorage-adapter] Storage quota exceeded for key:', key
        );
        throw new Error(
          `Storage quota exceeded. Clear some data and try again. (key: ${key})`
        );
      }
      console.error('[localStorage-adapter] Error writing key:', key, e);
      return false;
    }
  },

  /**
   * Remove a single key from localStorage.
   *
   * @param {string} key — raw key (will be auto-prefixed)
   * @returns {boolean} `true` on success
   */
  remove: (key) => {
    try {
      localStorage.removeItem(prefixKey(key));
      return true;
    } catch (e) {
      console.error('[localStorage-adapter] Error deleting key:', key, e);
      return false;
    }
  },

  /**
   * Check whether a key exists (without parsing the value).
   *
   * @param {string} key — raw key
   * @returns {boolean}
   */
  has: (key) => {
    try {
      return localStorage.getItem(prefixKey(key)) !== null;
    } catch (e) {
      return false;
    }
  },

  /**
   * Remove ALL keys that belong to the Kurai namespace.
   * WHY: useful for a full "reset workspace" action without nuking unrelated
   * data from other apps on the same origin.
   *
   * @returns {boolean} `true` on success
   */
  clearNamespace: () => {
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(NAMESPACE)) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
      return true;
    } catch (e) {
      console.error('[localStorage-adapter] Error clearing namespace:', e);
      return false;
    }
  }
};

export default localStorageAdapter;
