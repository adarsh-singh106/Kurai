/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/collections/collectionView.js]
 *
 * WHO I AM:    Sidebar UI view manager for Collections.
 * WHAT I OWN:  Subscribing to state collections updates, drawing nested trees in the DOM,
 *              and binding click handlers for adding requests or folders.
 * WHAT I DON'T: Directly invoking HTTP requests or writing to disk storage.
 * WHO CALLS ME: client/main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import eventBus from '../../core/eventBus.js';
import { escapeHtml } from '../../core/utils.js';

const FOLDER_ICON = `
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1.5 4.5a2 2 0 0 1 2-2h2.6l1.6 2h4.8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-7z"/>
  </svg>`;

const collectionView = {
  init: () => {
    eventBus.on('collection:updated', (collections) => {
      collectionView.render(collections);
    });
  },

  render: (collections) => {
    const container = document.getElementById('collections-list');
    if (!container) return;

    if (collections.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          ${FOLDER_ICON.replace('width="13" height="13"', '')}
          <span class="empty-title">No collections yet</span>
          <span>Group related requests into collections</span>
        </div>`;
      return;
    }

    container.innerHTML = collections.map(coll => `
      <div class="collection-item" data-id="${escapeHtml(coll.id)}">
        <span class="coll-icon">${FOLDER_ICON}</span>
        <span class="coll-name">${escapeHtml(coll.name)}</span>
      </div>
    `).join('');
  }
};

export default collectionView;
