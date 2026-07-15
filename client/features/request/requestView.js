/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/request/requestView.js]
 *
 * WHO I AM:    UI manager for the Request Builder panel.
 * WHAT I OWN:  Binding the method select, URL bar and Send button; rendering
 *              the Params/Headers key-value editors, Body editor, and Auth
 *              form; and keeping tab counts in sync with request state.
 * WHAT I DON'T: Network proxies or storage files.
 * WHO CALLS ME: client/main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import requestState from './requestState.js';
import requestService from './requestService.js';
import state from '../../core/state.js';
import eventBus from '../../core/eventBus.js';
import { escapeHtml } from '../../core/utils.js';

/**
 * WHY this flag: our own edits round-trip through state and re-emit
 * 'request:changed'. Rebuilding the KV editors mid-keystroke would steal
 * focus, so we suppress re-renders triggered by our own mutations.
 */
let suppressRender = false;

/** Commit a partial update to the current request without re-rendering. */
function patchRequest(patch) {
  const current = state.get('currentRequest');
  suppressRender = true;
  state.setCurrentRequest({ ...current, ...patch });
  suppressRender = false;
}

/* ── Key-Value editor ────────────────────────────────────────────────────── */

/**
 * Render an editable key-value list (used for both Params and Headers).
 *
 * @param {HTMLElement} container — host element
 * @param {Array} items — [{key, value, enabled}]
 * @param {Function} commit — called with the updated items array
 * @param {{keyPlaceholder: string, valuePlaceholder: string}} placeholders
 */
function renderKvEditor(container, items, commit, placeholders) {
  container.innerHTML = '';

  items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = `kv-row${item.enabled ? '' : ' disabled'}`;
    row.innerHTML = `
      <input type="checkbox" ${item.enabled ? 'checked' : ''} aria-label="Enable row">
      <input type="text" class="kv-input kv-key" placeholder="${escapeHtml(placeholders.keyPlaceholder)}" value="${escapeHtml(item.key)}" spellcheck="false" autocomplete="off">
      <input type="text" class="kv-input kv-value" placeholder="${escapeHtml(placeholders.valuePlaceholder)}" value="${escapeHtml(item.value)}" spellcheck="false" autocomplete="off">
      <button class="kv-delete" title="Remove row" aria-label="Remove row">
        <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round">
          <line x1="3" y1="3" x2="13" y2="13"/><line x1="13" y1="3" x2="3" y2="13"/>
        </svg>
      </button>`;

    const [checkbox] = row.querySelectorAll('input[type="checkbox"]');
    const keyInput = row.querySelector('.kv-key');
    const valueInput = row.querySelector('.kv-value');
    const deleteBtn = row.querySelector('.kv-delete');

    checkbox.addEventListener('change', () => {
      items[index].enabled = checkbox.checked;
      row.classList.toggle('disabled', !checkbox.checked);
      commit(items);
    });
    keyInput.addEventListener('input', () => {
      items[index].key = keyInput.value;
      commit(items);
    });
    valueInput.addEventListener('input', () => {
      items[index].value = valueInput.value;
      commit(items);
    });
    deleteBtn.addEventListener('click', () => {
      items.splice(index, 1);
      commit(items);
      renderKvEditor(container, items, commit, placeholders);
    });

    container.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'kv-add-btn';
  addBtn.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round">
      <line x1="8" y1="2.5" x2="8" y2="13.5"/><line x1="2.5" y1="8" x2="13.5" y2="8"/>
    </svg>
    Add ${placeholders.rowLabel}`;
  addBtn.addEventListener('click', () => {
    items.push({ key: '', value: '', enabled: true });
    commit(items);
    renderKvEditor(container, items, commit, placeholders);
    // WHY: focus the fresh key input so adding rows flows keyboard-first.
    const keys = container.querySelectorAll('.kv-key');
    keys[keys.length - 1]?.focus();
  });
  container.appendChild(addBtn);
}

/** Update the little count bubbles on the Params/Headers tabs. */
function updateTabCounts(request) {
  const counts = {
    params: (request.params || []).filter(p => p.enabled && p.key).length,
    headers: (request.headers || []).filter(h => h.enabled && h.key).length
  };
  for (const [tab, count] of Object.entries(counts)) {
    const el = document.querySelector(`[data-count-for="${tab}"]`);
    if (!el) continue;
    el.textContent = count;
    el.hidden = count === 0;
  }
}

/* ── Sub-panel renderers ─────────────────────────────────────────────────── */

function renderParamsEditor(request) {
  const container = document.getElementById('params-editor');
  if (!container) return;
  const params = request.params || [];
  renderKvEditor(container, params, (items) => {
    patchRequest({ params: items });
    updateTabCounts({ ...request, params: items });
  }, { keyPlaceholder: 'key', valuePlaceholder: 'value', rowLabel: 'param' });
}

function renderHeadersEditor(request) {
  const container = document.getElementById('headers-editor');
  if (!container) return;
  const headers = request.headers || [];
  renderKvEditor(container, headers, (items) => {
    patchRequest({ headers: items });
    updateTabCounts({ ...request, headers: items });
  }, { keyPlaceholder: 'Header', valuePlaceholder: 'Value', rowLabel: 'header' });
}

function renderBodyEditor(request) {
  const bodyType = request.body?.type || 'none';
  const bodyInput = document.getElementById('request-body-input');
  const noneHint = document.getElementById('body-none-hint');
  const radio = document.querySelector(`input[name="body-type"][value="${bodyType}"]`);

  if (radio) radio.checked = true;
  if (bodyInput) {
    bodyInput.value = request.body?.content || '';
    bodyInput.hidden = bodyType === 'none';
  }
  if (noneHint) noneHint.hidden = bodyType !== 'none';
}

function renderAuthEditor(request) {
  const auth = request.auth || { type: 'inherit' };
  const typeSelect = document.getElementById('auth-type-select');
  const bearerFields = document.getElementById('auth-bearer-fields');
  const basicFields = document.getElementById('auth-basic-fields');

  if (typeSelect) typeSelect.value = auth.type === 'bearer' || auth.type === 'basic' ? auth.type : 'inherit';
  if (bearerFields) {
    bearerFields.hidden = auth.type !== 'bearer';
    const token = document.getElementById('auth-bearer-token');
    if (token) token.value = auth.bearer?.token || '';
  }
  if (basicFields) {
    basicFields.hidden = auth.type !== 'basic';
    const username = document.getElementById('auth-basic-username');
    const password = document.getElementById('auth-basic-password');
    if (username) username.value = auth.basic?.username || '';
    if (password) password.value = auth.basic?.password || '';
  }
}

/** Full re-render of every request sub-panel (skipped for our own edits). */
function renderAll(request) {
  renderParamsEditor(request);
  renderHeadersEditor(request);
  renderBodyEditor(request);
  renderAuthEditor(request);
  updateTabCounts(request);
}

/* ── View ────────────────────────────────────────────────────────────────── */

const requestView = {
  init: () => {
    const methodSelect = document.getElementById('request-method');
    const urlInput = document.getElementById('request-url');
    const sendBtn = document.getElementById('send-request-btn');

    if (methodSelect) {
      methodSelect.addEventListener('change', (e) => {
        requestState.updateMethod(e.target.value);
        // WHY: data-method drives the CSS colour coding of the select.
        methodSelect.dataset.method = e.target.value;
      });
    }

    if (urlInput) {
      urlInput.addEventListener('input', (e) => {
        requestState.updateUrl(e.target.value);
      });
      // Enter in the URL bar sends the request — muscle memory from browsers.
      urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') requestService.sendCurrentRequest();
      });
    }

    if (sendBtn) {
      sendBtn.addEventListener('click', () => {
        requestService.sendCurrentRequest();
      });
    }

    // ── Request config tabs ────────────────────────────────────────────
    document.querySelectorAll('.request-tabs .tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.request-tabs .tab-btn').forEach(b => {
          b.classList.toggle('active', b === btn);
          b.setAttribute('aria-selected', String(b === btn));
        });
        document.querySelectorAll('.request-tab-panels .tab-panel').forEach(panel => {
          panel.classList.toggle('active', panel.id === `tab-panel-${btn.dataset.tab}`);
        });
      });
    });

    // ── Body type + content ────────────────────────────────────────────
    document.querySelectorAll('input[name="body-type"]').forEach(radio => {
      radio.addEventListener('change', () => {
        const current = state.get('currentRequest');
        const body = { ...(current.body || {}), type: radio.value };
        patchRequest({ body });
        renderBodyEditor({ ...current, body });
      });
    });

    const bodyInput = document.getElementById('request-body-input');
    if (bodyInput) {
      bodyInput.addEventListener('input', () => {
        const current = state.get('currentRequest');
        patchRequest({ body: { ...(current.body || {}), content: bodyInput.value } });
      });
    }

    // ── Auth form ──────────────────────────────────────────────────────
    const authTypeSelect = document.getElementById('auth-type-select');
    if (authTypeSelect) {
      authTypeSelect.addEventListener('change', () => {
        const current = state.get('currentRequest');
        const auth = { ...(current.auth || {}), type: authTypeSelect.value };
        patchRequest({ auth });
        renderAuthEditor({ ...current, auth });
      });
    }

    const bindAuthField = (id, apply) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('input', () => {
        const current = state.get('currentRequest');
        patchRequest({ auth: apply(current.auth || {}, el.value) });
      });
    };
    bindAuthField('auth-bearer-token', (auth, v) => ({ ...auth, bearer: { ...(auth.bearer || {}), token: v } }));
    bindAuthField('auth-basic-username', (auth, v) => ({ ...auth, basic: { ...(auth.basic || {}), username: v } }));
    bindAuthField('auth-basic-password', (auth, v) => ({ ...auth, basic: { ...(auth.basic || {}), password: v } }));

    // ── Send button loading state ──────────────────────────────────────
    eventBus.on('ui:loading', (isLoading) => {
      if (!sendBtn) return;
      sendBtn.classList.toggle('loading', isLoading);
      sendBtn.disabled = isLoading;
      const spinner = sendBtn.querySelector('.btn-send-spinner');
      if (spinner) spinner.hidden = !isLoading;
    });

    // ── Sync inputs when request changes ───────────────────────────────
    eventBus.on('request:changed', (request) => {
      if (methodSelect) {
        methodSelect.value = request.method;
        methodSelect.dataset.method = request.method;
      }
      if (urlInput && urlInput.value !== request.url) urlInput.value = request.url;
      // WHY suppressRender: skip editor rebuilds for our own keystrokes —
      // full renders only happen on external loads (history click, reset).
      if (!suppressRender) renderAll(request);
    });

    // Initial paint from default state.
    renderAll(state.get('currentRequest'));
  }
};

export default requestView;
