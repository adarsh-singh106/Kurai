/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/core/eventBus.js]
 *
 * WHO I AM:    A simple pub/sub event bus. I am how every module in Kurai
 *              communicates without importing each other.
 * WHAT I OWN:  Listening registry, subscriber triggers, and event emissions.
 * WHAT I DON'T: Any UI drawing or request orchestration logic.
 * WHO CALLS ME: Every other module (features, core, network, storage).
 *
 * SAFETY GUARANTEES:
 *   - `emit()` isolates each listener in a try/catch so one bad handler cannot
 *     crash the entire event pipeline.
 *   - `on()` prevents the same function reference from being registered twice
 *     on the same event (duplicate guard).
 *   - A warning is logged when a single event exceeds MAX_EVENT_LISTENERS
 *     registrations — a strong signal of a memory leak.
 *
 * EVENTS I EMIT:
 *   request:changed       — any field in currentRequest was modified
 *   request:sending       — user clicked Send, request is in flight
 *   response:received     — proxy returned a response (success or HTTP error)
 *   response:error        — network/proxy error (not an HTTP error code)
 *   collection:updated    — a collection was created, renamed, or deleted
 *   environment:changed   — active environment switched or variable edited
 *   history:updated       — new entry added to history
 *   ui:loading            — loading spinner should show/hide
 *   ui:theme              — theme changed
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { LIMITS } from './constants.js';

const eventBus = (() => {
  /**
   * Internal listener registry.
   * WHY a plain object instead of `Map`: lightweight, JSON-serialisable keys
   * (event names are always strings), and sufficient for our scale.
   * @type {Record<string, Function[]>}
   */
  const listeners = {};

  /**
   * WHY this flag: `destroy()` sets it to prevent post-teardown subscriptions
   * that would otherwise silently leak.
   * @type {boolean}
   */
  let destroyed = false;

  return {
    /**
     * Subscribe `fn` to an event.
     *
     * @param {string} event — event name to listen for
     * @param {Function} fn  — callback invoked with event data
     * @returns {Function}   — unsubscribe function for convenient cleanup
     * @throws {TypeError}   if `fn` is not a function
     */
    on: (event, fn) => {
      if (destroyed) {
        console.warn(`[eventBus] Ignoring on("${event}") — bus is destroyed.`);
        return () => {};
      }
      if (typeof fn !== 'function') {
        throw new TypeError(
          `[eventBus] on("${event}"): expected a function, got ${typeof fn}`
        );
      }

      listeners[event] ||= [];

      // WHY duplicate guard: re-registering the same handler causes it to fire
      // twice per emit, which is almost always a bug (e.g. a view calling init
      // multiple times without cleaning up).
      if (listeners[event].includes(fn)) {
        console.warn(
          `[eventBus] Duplicate listener skipped for "${event}".`
        );
        return () => eventBus.off(event, fn);
      }

      listeners[event].push(fn);

      // WHY max-listener warning: mirrors Node's EventEmitter safeguard.
      // More than MAX_EVENT_LISTENERS on one event almost always means a
      // component is subscribing on every render without unsubscribing.
      if (listeners[event].length > LIMITS.MAX_EVENT_LISTENERS) {
        console.warn(
          `[eventBus] Possible leak: "${event}" has ${listeners[event].length} listeners ` +
          `(max recommended: ${LIMITS.MAX_EVENT_LISTENERS}).`
        );
      }

      // WHY return unsubscribe: lets callers clean up without holding a
      // reference to both the event name *and* the handler function.
      return () => eventBus.off(event, fn);
    },

    /**
     * Unsubscribe `fn` from an event.
     *
     * @param {string} event — event name
     * @param {Function} fn  — the exact function reference registered via `on()`
     */
    off: (event, fn) => {
      listeners[event] = (listeners[event] || []).filter(f => f !== fn);
    },

    /**
     * Emit an event, invoking every registered listener with `data`.
     *
     * WHY try/catch per listener: one broken handler must not prevent the
     * remaining handlers from executing — partial failure is far better than
     * total silence on a critical event like `response:received`.
     *
     * @param {string} event — event name to emit
     * @param {*} data       — payload forwarded to each listener
     */
    emit: (event, data) => {
      const fns = listeners[event];
      if (!fns || fns.length === 0) return;

      for (const fn of fns) {
        try {
          fn(data);
        } catch (err) {
          console.error(
            `[eventBus] Listener error on "${event}":`, err
          );
        }
      }
    },

    /**
     * Subscribe to an event for a single emission only.
     *
     * @param {string} event — event name
     * @param {Function} fn  — one-shot callback
     * @returns {Function}   — unsubscribe (in case you need to cancel before it fires)
     */
    once: (event, fn) => {
      const wrapper = (data) => {
        fn(data);
        eventBus.off(event, wrapper);
      };
      return eventBus.on(event, wrapper);
    },

    /**
     * Remove ALL listeners for a specific event.
     * WHY useful: when an entire feature panel is torn down (e.g. switching
     * workspace), bulk removal is safer than tracking individual unsubs.
     *
     * @param {string} event — event name whose listeners should be cleared
     */
    removeAllListeners: (event) => {
      if (event) {
        delete listeners[event];
      }
    },

    /**
     * Permanently tear down the event bus.
     * WHY: allows clean shutdown in test harnesses and prevents further
     * subscriptions or emissions after the app is unmounted.
     */
    destroy: () => {
      for (const event of Object.keys(listeners)) {
        delete listeners[event];
      }
      destroyed = true;
    }
  };
})();

export default eventBus;
