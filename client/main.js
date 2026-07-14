/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/main.js]
 *
 * WHO I AM:    The front-end bootstrap sequence module.
 * WHAT I OWN:  Bootstrapping the application: loading state, registering global
 *              events, initializing features, and initiating the primary render.
 * WHAT I DON'T: Any specific styling, routing, or feature implementation.
 * WHO CALLS ME: script tag in client/index.html.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import requestView from './features/request/requestView.js';
import responseView from './features/response/responseView.js';
import collectionView from './features/collections/collectionView.js';
import environmentView from './features/environment/environmentView.js';
import historyView from './features/history/historyView.js';
import collectionService from './features/collections/collectionService.js';
import environmentStorage from './features/environment/environmentStorage.js';
import historyStorage from './features/history/historyStorage.js';
import state from './core/state.js';

console.log('[kurai] Initializing boot sequence...');

document.addEventListener('DOMContentLoaded', async () => {
  try {
    // 1. Initialize Views
    requestView.init();
    responseView.init();
    collectionView.init();
    environmentView.init();
    historyView.init();
    
    console.log('[kurai] Features initialized.');

    // 2. Load Data from Storage
    const collections = await collectionService.loadCollections();
    const environments = await environmentStorage.getAll();
    const historyList = await historyStorage.list();

    // 3. Populate State
    state.setEnvironments(environments);
    
    // Reverse history to show newest first if stored sequentially
    historyList.forEach(entry => state.addToHistory(entry));

    console.log('[kurai] Primary UI rendered successfully.');
  } catch (error) {
    console.error('[kurai] Boot sequence failed:', error);
  }
});
