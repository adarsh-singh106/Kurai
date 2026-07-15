/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/history/historyService.js]
 *
 * WHO I AM:    Business logic orchestrator for request History.
 * WHAT I OWN:  Sorting recent requests, executing limit filters (max 50 entries),
 *              and formatting requests for database additions.
 * WHAT I DON'T: Rendering sidebar list elements (historyView.js concerns).
 * WHO CALLS ME: client/features/request/requestService.js (when request finishes).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import historyStorage from './historyStorage.js';
import state from '../../core/state.js';

const historyService = {
  addEntry: async (requestObject) => {
    const entry = {
      ...requestObject,
      id: Math.random().toString(36).substring(2, 9),
      timestamp: new Date().toISOString()
    };
    await historyStorage.add(entry);
    state.addToHistory(entry);
    return entry;
  },

  clearHistory: async () => {
    await historyStorage.clear();
    // WHY clearHistory not addToHistory([]): addToHistory would push an
    // empty-array *entry* onto the stack instead of emptying it.
    state.clearHistory();
  }
};

export default historyService;
