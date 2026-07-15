/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/history/historyView.js]
 *
 * WHO I AM:    Sidebar UI view manager for request History.
 * WHAT I OWN:  Subscribing to history updates, printing list nodes in the DOM,
 *              click-to-restore of past requests, relative timestamps, sidebar
 *              search filtering, and the clear-history control.
 * WHAT I DON'T: Triggering actual proxy requests.
 * WHO CALLS ME: client/main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import eventBus from '../../core/eventBus.js';
import state from '../../core/state.js';
import historyStorage from './historyStorage.js';
import { escapeHtml, relativeTime, showToast } from '../../core/utils.js';

/** Latest full list — kept so search filtering re-renders without state reads. */
let cachedList = [];
let searchQuery = '';

const historyView = {
  init: () => {
    eventBus.on('history:updated', (historyList) => {
      cachedList = historyList;
      historyView.render(historyList);
    });

    // Sidebar search filters visible history rows live.
    const search = document.getElementById('sidebar-search-input');
    if (search) {
      search.addEventListener('input', () => {
        searchQuery = search.value.trim().toLowerCase();
        historyView.render(cachedList);
      });
    }
  },

  render: (historyList) => {
    const container = document.getElementById('history-list');
    if (!container) return;

    const visible = searchQuery
      ? historyList.filter(item =>
          (item.url || '').toLowerCase().includes(searchQuery) ||
          (item.method || '').toLowerCase().includes(searchQuery))
      : historyList;

    if (visible.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M12 7v5l4 2"/>
          </svg>
          <span class="empty-title">${searchQuery ? 'No matches' : 'No history yet'}</span>
          <span>${searchQuery ? 'Try a different search' : 'Sent requests will appear here'}</span>
        </div>`;
      return;
    }

    container.innerHTML = visible.map(item => `
      <div class="history-item" data-id="${escapeHtml(item.id)}" title="${escapeHtml(item.url)}">
        <span class="badge badge-${escapeHtml((item.method || 'get').toLowerCase())}">${escapeHtml(item.method || 'GET')}</span>
        <span class="url">${escapeHtml(item.url)}</span>
        ${item.timestamp ? `<span class="history-time">${relativeTime(item.timestamp)}</span>` : ''}
      </div>
    `).join('') + `
      <button class="history-clear-btn" id="clear-history-btn">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
          <line x1="10" x2="10" y1="11" y2="17"/>
          <line x1="14" x2="14" y1="11" y2="17"/>
        </svg>
        Clear history
      </button>`;

    // ── Click to restore a past request into the builder ────────────────
    container.querySelectorAll('.history-item').forEach(row => {
      row.addEventListener('click', () => {
        const entry = cachedList.find(item => item.id === row.dataset.id);
        if (!entry) return;
        // WHY strip metadata: id/timestamp belong to the history record,
        // not to the request being edited.
        const { id, timestamp, ...request } = entry;
        state.setCurrentRequest({
          // Re-apply defaults for fields older entries may lack.
          params: [], headers: [],
          body: { type: 'none', content: '', formData: [] },
          auth: { type: 'inherit' },
          tests: '',
          ...request
        });
        showToast('Request loaded from history', 'info', 1500);
      });
    });

    const clearBtn = container.querySelector('#clear-history-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        await historyStorage.clear();
        state.setHistory([]);
        showToast('History cleared', 'success', 1500);
      });
    }
  }
};

export default historyView;
