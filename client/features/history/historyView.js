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
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round">
            <circle cx="8" cy="8" r="6.5"/><path d="M8 4.5V8l2.5 1.5"/>
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
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9.5a1 1 0 0 0 1 .93h4.6a1 1 0 0 0 1-.93L12 4"/>
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
