/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/core/state.js]
 *
 * WHO I AM:    The single source of truth for all runtime application state.
 * WHAT I OWN:  currentRequest, currentResponse, collections list, environments list,
 *              active environment identifiers, history cache, and core UI states.
 * WHAT I DON'T: DOM elements (views own DOM), network requests, or storage adapters.
 * WHO CALLS ME: Every client module reading state. Mutations must use my methods.
 *
 * DESIGN DECISIONS:
 *   - `get()` returns deep clones via `structuredClone()` to prevent callers
 *     from mutating internal state through returned references.
 *   - Every setter validates its input and throws on bad data rather than
 *     silently corrupting state — fail-fast philosophy.
 *   - `addToHistory()` clones the entry before storing to decouple the caller's
 *     object from the internal history array.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import eventBus from './eventBus.js';
import { HTTP_METHODS, LIMITS } from './constants.js';

/**
 * Returns a fresh copy of the default state shape.
 * WHY a factory function: `resetState()` needs a pristine copy each time;
 * a shared object literal would accumulate mutations across resets.
 * @returns {Object} default application state
 */
function createDefaultState() {
  return {
    currentRequest: {
      id: '',
      name: 'New Request',
      method: 'GET',
      url: '',
      params: [],
      headers: [],
      body: { type: 'none', content: '', formData: [] },
      auth: { type: 'inherit' }
    },
    currentResponse: null,
    collections: [],
    environments: [],
    activeEnvironmentId: null,
    history: [],
    ui: {
      activeTab: 'params',
      loading: false,
      sidebarWidth: 280,
      theme: 'dark'
    }
  };
}

const state = (() => {
  // WHY private: prevents external code from mutating state directly,
  // which would bypass event emission and break UI reactivity.
  let _state = createDefaultState();

  return {
    // ─── Readers ──────────────────────────────────────────────────────

    /**
     * Read a value from state by dot-delimited path.
     *
     * WHY structuredClone: returning direct references lets any consumer do
     * `state.get('history').push(...)` and silently corrupt internal state.
     * Deep cloning severs that link at a small perf cost (acceptable — state
     * reads are not on a hot rendering path).
     *
     * @param {string} path — dot-delimited path, e.g. `'currentRequest.method'`
     * @returns {*} deep clone of the resolved value, or `undefined` if path misses
     */
    get: (path) => {
      const value = path.split('.').reduce((obj, key) => obj?.[key], _state);
      // WHY: primitives (string, number, boolean, null, undefined) don't need
      // cloning and structuredClone would work but is unnecessary overhead.
      if (value === null || value === undefined || typeof value !== 'object') {
        return value;
      }
      return structuredClone(value);
    },

    // ─── Request Mutators ─────────────────────────────────────────────

    /**
     * Set the HTTP method for the current request.
     *
     * @param {string} method — must be one of `HTTP_METHODS`
     * @throws {Error} if `method` is not a recognised HTTP verb
     */
    setMethod: (method) => {
      if (!HTTP_METHODS.includes(method)) {
        throw new Error(
          `[state] Invalid HTTP method "${method}". ` +
          `Allowed: ${HTTP_METHODS.join(', ')}`
        );
      }
      _state.currentRequest.method = method;
      eventBus.emit('request:changed', structuredClone(_state.currentRequest));
    },

    /**
     * Set the request URL.
     *
     * WHY trim: users frequently paste URLs with trailing whitespace from docs
     * or chat apps; silently trimming prevents confusing 404s.
     *
     * @param {string} url — target URL string
     * @throws {TypeError} if `url` is not a string
     */
    setUrl: (url) => {
      if (typeof url !== 'string') {
        throw new TypeError(
          `[state] setUrl() expected a string, got ${typeof url}`
        );
      }
      _state.currentRequest.url = url.trim();
      eventBus.emit('request:changed', structuredClone(_state.currentRequest));
    },

    /**
     * Replace the entire current request scaffold (e.g. when loading a saved
     * request from a collection).
     *
     * @param {Object} request — full request object matching the currentRequest shape
     * @throws {TypeError} if `request` is not a non-null object
     * @throws {Error} if `request.method` is not a valid HTTP method
     */
    setCurrentRequest: (request) => {
      if (!request || typeof request !== 'object') {
        throw new TypeError(
          '[state] setCurrentRequest() expected a non-null object.'
        );
      }
      if (request.method && !HTTP_METHODS.includes(request.method)) {
        throw new Error(
          `[state] setCurrentRequest() invalid method "${request.method}".`
        );
      }
      // WHY clone: severs the caller's reference so later mutations to
      // the passed object do not silently change internal state.
      _state.currentRequest = structuredClone(request);
      eventBus.emit('request:changed', structuredClone(_state.currentRequest));
    },

    // ─── Response Mutators ────────────────────────────────────────────

    /**
     * Store a proxy response.
     *
     * WHY shape check: downstream renderers destructure `status` and `body`
     * unconditionally — a malformed response would throw deep inside the
     * response panel with a confusing stack trace. Failing here is clearer.
     *
     * @param {Object|null} response — must contain at least `status` and `body`, or be `null` to clear
     * @throws {TypeError} if response shape is invalid
     */
    setResponse: (response) => {
      if (response !== null) {
        if (typeof response !== 'object') {
          throw new TypeError(
            `[state] setResponse() expected an object or null, got ${typeof response}`
          );
        }
        if (!('status' in response) || !('body' in response)) {
          throw new TypeError(
            '[state] setResponse() response must contain "status" and "body" properties.'
          );
        }
      }
      _state.currentResponse = response ? structuredClone(response) : null;
      eventBus.emit('response:received', structuredClone(_state.currentResponse));
    },

    // ─── UI Mutators ──────────────────────────────────────────────────

    /**
     * Toggle the global loading state.
     *
     * @param {boolean} isLoading — `true` to show spinner, `false` to hide
     * @throws {TypeError} if `isLoading` is not a boolean
     */
    setLoading: (isLoading) => {
      if (typeof isLoading !== 'boolean') {
        throw new TypeError(
          `[state] setLoading() expected boolean, got ${typeof isLoading}`
        );
      }
      _state.ui.loading = isLoading;
      eventBus.emit('ui:loading', isLoading);
    },

    // ─── Collection Mutators ──────────────────────────────────────────

    /**
     * Replace the full collections list (used after initial load or sync).
     *
     * @param {Array} collections — array of collection objects
     * @throws {TypeError} if `collections` is not an array
     */
    setCollections: (collections) => {
      if (!Array.isArray(collections)) {
        throw new TypeError(
          `[state] setCollections() expected an array, got ${typeof collections}`
        );
      }
      _state.collections = structuredClone(collections);
      eventBus.emit('collection:updated', structuredClone(_state.collections));
    },

    // ─── Environment Mutators ─────────────────────────────────────────

    /**
     * Replace the full environments list.
     *
     * @param {Array} environments — array of environment objects
     * @throws {TypeError} if `environments` is not an array
     */
    setEnvironments: (environments) => {
      if (!Array.isArray(environments)) {
        throw new TypeError(
          `[state] setEnvironments() expected an array, got ${typeof environments}`
        );
      }
      _state.environments = structuredClone(environments);
      eventBus.emit('environment:changed', structuredClone(_state.environments));
    },

    /**
     * Switch the active environment.
     *
     * WHY validate existence: setting an ID that doesn't map to any loaded
     * environment would cause `activeEnvironment()` to silently return `null`,
     * making variable interpolation fail with no visible feedback.
     *
     * @param {string|null} id — environment ID, or `null` to deactivate
     * @throws {Error} if `id` is not `null` and doesn't match any loaded environment
     */
    setActiveEnvironmentId: (id) => {
      if (id !== null) {
        const exists = _state.environments.some(env => env.id === id);
        if (!exists) {
          throw new Error(
            `[state] setActiveEnvironmentId(): no environment with id "${id}" exists.`
          );
        }
      }
      _state.activeEnvironmentId = id;
      eventBus.emit('environment:changed', structuredClone(_state.environments));
    },

    /**
     * Resolve the currently active environment object.
     *
     * @returns {Object|null} the active environment, or `null` if none selected
     */
    activeEnvironment: () => {
      const env = _state.environments.find(
        e => e.id === _state.activeEnvironmentId
      ) || null;
      return env ? structuredClone(env) : null;
    },

    // ─── History Mutators ─────────────────────────────────────────────

    /**
     * Add a single entry to the front of the history stack.
     *
     * WHY clone before storing: the caller typically passes the same request
     * object that is still referenced by `_state.currentRequest`. Without
     * cloning, future mutations to currentRequest would retroactively change
     * the history entry.
     *
     * @param {Object} entry — history entry object
     */
    addToHistory: (entry) => {
      _state.history.unshift(structuredClone(entry));
      if (_state.history.length > LIMITS.MAX_HISTORY_ENTRIES) {
        _state.history.pop();
      }
      eventBus.emit('history:updated', structuredClone(_state.history));
    },

    /**
     * Batch-load history entries (used during boot to hydrate from storage).
     *
     * WHY a dedicated method instead of looping `addToHistory()`: the loop
     * fires N `history:updated` events; batch-loading fires exactly one,
     * preventing N redundant DOM re-renders during startup.
     *
     * @param {Array} entries — array of history entry objects
     * @throws {TypeError} if `entries` is not an array
     */
    setHistory: (entries) => {
      if (!Array.isArray(entries)) {
        throw new TypeError(
          `[state] setHistory() expected an array, got ${typeof entries}`
        );
      }
      _state.history = structuredClone(entries).slice(0, LIMITS.MAX_HISTORY_ENTRIES);
      eventBus.emit('history:updated', structuredClone(_state.history));
    },

    /**
     * Clear all history entries.
     */
    clearHistory: () => {
      _state.history = [];
      eventBus.emit('history:updated', []);
    },

    // ─── Lifecycle ────────────────────────────────────────────────────

    /**
     * Reset the entire state back to factory defaults.
     * WHY useful: workspace switching or "New Window" needs a clean slate
     * without reloading the page.
     */
    resetState: () => {
      _state = createDefaultState();
      eventBus.emit('request:changed', structuredClone(_state.currentRequest));
      eventBus.emit('response:received', null);
      eventBus.emit('collection:updated', []);
      eventBus.emit('environment:changed', []);
      eventBus.emit('history:updated', []);
      eventBus.emit('ui:loading', false);
    },

    // ─── Debugging ────────────────────────────────────────────────────

    /**
     * Return a full deep-clone snapshot of the current state for debugging.
     * WHY structuredClone: callers (DevTools, test harnesses) can inspect
     * without risk of mutation.
     *
     * @returns {Object} complete deep clone of internal state
     */
    getSnapshot: () => {
      return structuredClone(_state);
    }
  };
})();

export default state;
