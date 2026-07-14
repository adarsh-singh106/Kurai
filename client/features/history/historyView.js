/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/history/historyView.js]
 *
 * WHO I AM:    Sidebar UI view manager for request History.
 * WHAT I OWN:  Subscribing to history updates and printing list nodes in the DOM.
 * WHAT I DON'T: Triggering actual proxy requests.
 * WHO CALLS ME: client/main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import eventBus from '../../core/eventBus.js';

const historyView = {
  init: () => {
    eventBus.on('history:updated', (historyList) => {
      historyView.render(historyList);
    });
  },

  render: (historyList) => {
    const container = document.getElementById('history-list');
    if (!container) return;

    if (historyList.length === 0) {
      container.innerHTML = '<div class="empty-state">No history recorded</div>';
      return;
    }

    container.innerHTML = historyList.map(item => `
      <div class="history-item" data-id="${item.id}">
        <span class="badge badge-${item.method?.toLowerCase()}">${item.method}</span>
        <span class="url">${item.url}</span>
      </div>
    `).join('');
  }
};

export default historyView;
