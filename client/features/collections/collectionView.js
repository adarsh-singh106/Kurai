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
import state from '../../core/state.js';
import collectionService from './collectionService.js';
import { escapeHtml, showToast, promptDialog, confirmDialog } from '../../core/utils.js';

const FOLDER_ICON = `
  <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M1.5 4.5a2 2 0 0 1 2-2h2.6l1.6 2h4.8a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-7z"/>
  </svg>`;

const PLUS_ICON = `
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
    <line x1="8" y1="2.5" x2="8" y2="13.5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/>
  </svg>`;

const TRASH_ICON = `
  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
    <path d="M2.5 4h11M6.5 4V2.5h3V4M4 4l.7 9.5a1 1 0 0 0 1 .93h4.6a1 1 0 0 0 1-.93L12 4"/>
  </svg>`;

const CHEVRON_ICON = `
  <svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M5.5 3l5 5-5 5"/>
  </svg>`;

/**
 * WHY module-level Set: expansion is view-only UI state — putting it in the
 * global store would force every toggle through a state event round-trip.
 * Survives re-renders because renders rebuild DOM, not this Set.
 */
const expandedIds = new Set();

/** Latest list — kept so click handlers resolve without re-reading state. */
let cachedCollections = [];

/* ── Render helpers ──────────────────────────────────────────────────────── */

function requestRow(collId, item) {
  const method = escapeHtml((item.method || 'GET').toUpperCase());
  return `
    <div class="collection-request" data-coll-id="${escapeHtml(collId)}" data-req-id="${escapeHtml(item.id)}" title="${escapeHtml(item.url || '')}">
      <span class="badge badge-${method.toLowerCase()}">${method}</span>
      <span class="req-name">${escapeHtml(item.name || item.url || 'Untitled')}</span>
      <button class="coll-action req-delete" title="Delete request" aria-label="Delete request">${TRASH_ICON}</button>
    </div>`;
}

function collectionBlock(coll) {
  const expanded = expandedIds.has(coll.id);
  const items = coll.items || [];
  return `
    <div class="collection-block${expanded ? ' expanded' : ''}" data-id="${escapeHtml(coll.id)}">
      <div class="collection-item" data-id="${escapeHtml(coll.id)}">
        <span class="coll-chevron${expanded ? ' open' : ''}">${CHEVRON_ICON}</span>
        <span class="coll-icon">${FOLDER_ICON}</span>
        <span class="coll-name">${escapeHtml(coll.name)}</span>
        <span class="coll-count">${items.length}</span>
        <button class="coll-action coll-save" title="Save current request here" aria-label="Save current request to collection">${PLUS_ICON}</button>
        <button class="coll-action coll-delete" title="Delete collection" aria-label="Delete collection">${TRASH_ICON}</button>
      </div>
      ${expanded ? `
        <div class="collection-children">
          ${items.length
            ? items.map(item => requestRow(coll.id, item)).join('')
            : '<div class="collection-empty-hint">Empty — hit + to save the current request</div>'}
        </div>` : ''}
    </div>`;
}

/* ── Event wiring (delegated per render) ─────────────────────────────────── */

function bindHandlers(container) {
  // New collection.
  container.querySelector('#new-collection-btn')?.addEventListener('click', async () => {
    const name = await promptDialog('New collection', {
      placeholder: 'e.g. User APIs', confirmLabel: 'Create'
    });
    if (name === null) return;
    try {
      const coll = await collectionService.createCollection(name);
      // WHY re-render: commit() already rendered before we knew the new id,
      // so mark it expanded and paint once more.
      expandedIds.add(coll.id);
      collectionView.render(cachedCollections);
      showToast(`Collection "${coll.name}" created`, 'success', 1500);
    } catch (err) {
      showToast(err.message.replace(/^\[collections\]\s*/, ''), 'error');
    }
  });

  // Collection rows: expand/collapse + per-row actions.
  container.querySelectorAll('.collection-item').forEach(row => {
    const id = row.dataset.id;

    row.addEventListener('click', (e) => {
      // Action buttons handle their own clicks.
      if (e.target.closest('.coll-action')) return;
      expandedIds.has(id) ? expandedIds.delete(id) : expandedIds.add(id);
      collectionView.render(cachedCollections);
    });

    row.querySelector('.coll-save')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const request = state.get('currentRequest');
      if (!request.url) {
        showToast('Enter a URL in the builder first', 'warning');
        return;
      }
      const name = await promptDialog('Save request as', {
        value: request.name !== 'New Request' ? request.name : request.url,
        confirmLabel: 'Save'
      });
      if (name === null) return;
      // WHY expand BEFORE the await: the service's commit re-renders
      // synchronously — expanding after it would paint a collapsed tree.
      expandedIds.add(id);
      await collectionService.saveRequestToCollection(id, request, name);
      showToast('Request saved', 'success', 1500);
    });

    row.querySelector('.coll-delete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const coll = cachedCollections.find(c => c.id === id);
      const count = coll?.items?.length || 0;
      const ok = await confirmDialog(`Delete "${coll?.name}"?`, {
        message: count ? `Its ${count} saved request(s) will be deleted too.` : undefined,
        confirmLabel: 'Delete', danger: true
      });
      if (!ok) return;
      expandedIds.delete(id);
      await collectionService.deleteCollection(id);
      showToast('Collection deleted', 'success', 1500);
    });
  });

  // Saved request rows: click-to-load + delete.
  container.querySelectorAll('.collection-request').forEach(row => {
    const { collId, reqId } = row.dataset;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.coll-action')) return;
      const saved = collectionService.findRequest(collId, reqId);
      if (!saved) return;
      state.setCurrentRequest({
        // Re-apply defaults for fields older entries may lack.
        params: [], headers: [],
        body: { type: 'none', content: '', formData: [] },
        auth: { type: 'inherit' },
        ...saved
      });
      showToast(`Loaded "${saved.name}"`, 'info', 1500);
    });

    row.querySelector('.req-delete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      await collectionService.removeRequestFromCollection(collId, reqId);
      showToast('Request removed', 'success', 1500);
    });
  });
}

/* ── View ────────────────────────────────────────────────────────────────── */

const collectionView = {
  init: () => {
    eventBus.on('collection:updated', (collections) => {
      collectionView.render(collections);
    });
  },

  render: (collections) => {
    const container = document.getElementById('collections-list');
    if (!container) return;
    cachedCollections = collections;

    const newBtn = `
      <button class="new-collection-btn" id="new-collection-btn">
        ${PLUS_ICON}
        New Collection
      </button>`;

    if (collections.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          ${FOLDER_ICON.replace('width="13" height="13"', '')}
          <span class="empty-title">No collections yet</span>
          <span>Group related requests into collections</span>
        </div>
        ${newBtn}`;
    } else {
      container.innerHTML = collections.map(collectionBlock).join('') + newBtn;
    }

    bindHandlers(container);
  }
};

export default collectionView;
