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
      container.innerHTML = '<div class="empty-state">No collections saved</div>';
      return;
    }

    container.innerHTML = collections.map(coll => `
      <div class="collection-item" data-id="${coll.id}">
        <span class="coll-name">${coll.name}</span>
      </div>
    `).join('');
  }
};

export default collectionView;
