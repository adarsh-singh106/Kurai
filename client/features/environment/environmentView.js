/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/environment/environmentView.js]
 *
 * WHO I AM:    UI manager for Environments.
 * WHAT I OWN:  Updating the environment selector dropdown in the top header bar,
 *              triggering changes in active environment, and the environment
 *              manager modal (create/rename/delete envs + variable editor).
 * WHAT I DON'T: Bypassing CORS or sending requests.
 * WHO CALLS ME: client/main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import eventBus from '../../core/eventBus.js';
import state from '../../core/state.js';
import environmentService from './environmentService.js';
import { escapeHtml, showToast, promptDialog, confirmDialog } from '../../core/utils.js';

/** Which environment is open in the manager modal. */
let selectedEnvId = null;

/**
 * WHY persistence lives here: state.js deliberately owns no storage. The active
 * env resets on every reload otherwise, silently breaking {{variable}} URLs.
 */
export const ACTIVE_ENV_STORAGE_KEY = 'kurai.activeEnvironmentId';

/* ── Manager modal ───────────────────────────────────────────────────────── */

function closeManager() {
  document.getElementById('env-manager-overlay')?.remove();
}

function renderManager() {
  closeManager();
  const environments = state.get('environments');
  if (selectedEnvId && !environments.some(e => e.id === selectedEnvId)) selectedEnvId = null;
  if (!selectedEnvId && environments.length) selectedEnvId = environments[0].id;
  const selected = environments.find(e => e.id === selectedEnvId) || null;

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id = 'env-manager-overlay';
  overlay.innerHTML = `
    <div class="modal-content env-manager" role="dialog" aria-modal="true">
      <div class="modal-title">Environments</div>
      <div class="env-manager-body">
        <div class="env-manager-list">
          ${environments.map(env => `
            <div class="env-list-item${env.id === selectedEnvId ? ' active' : ''}" data-id="${escapeHtml(env.id)}">
              <span class="env-list-name">${escapeHtml(env.name)}</span>
              <button class="coll-action env-rename" title="Rename" aria-label="Rename environment">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                  <path d="m15 5 4 4"/>
                </svg>
              </button>
              <button class="coll-action env-delete" title="Delete" aria-label="Delete environment">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M3 6h18M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>
                  <line x1="10" x2="10" y1="11" y2="17"/>
                  <line x1="14" x2="14" y1="11" y2="17"/>
                </svg>
              </button>
            </div>`).join('')}
          <button class="new-collection-btn" id="env-new-btn">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M12 5v14"/>
            </svg>
            New Environment
          </button>
        </div>
        <div class="env-manager-vars">
          ${selected ? `
            <div class="env-vars-title">Variables in “${escapeHtml(selected.name)}”</div>
            <div class="kv-editor" id="env-vars-editor"></div>
          ` : `
            <div class="empty-state">
              <span class="empty-title">No environment selected</span>
              <span>Create one to define {{variables}}</span>
            </div>`}
        </div>
      </div>
      <div class="modal-actions">
        <button class="btn btn-primary" id="env-close-btn">Done</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeManager(); });
  overlay.querySelector('#env-close-btn')?.addEventListener('click', closeManager);

  overlay.querySelector('#env-new-btn')?.addEventListener('click', async () => {
    const name = await promptDialog('New environment', {
      placeholder: 'e.g. Development', confirmLabel: 'Create'
    });
    if (name === null) return;
    try {
      const env = await environmentService.createEnvironment(name);
      selectedEnvId = env.id;
      renderManager();
    } catch (err) {
      showToast(err.message.replace(/^\[environments\]\s*/, ''), 'error');
    }
  });

  overlay.querySelectorAll('.env-list-item').forEach(row => {
    const id = row.dataset.id;

    row.addEventListener('click', (e) => {
      if (e.target.closest('.coll-action')) return;
      selectedEnvId = id;
      renderManager();
    });

    row.querySelector('.env-rename')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const env = state.get('environments').find(en => en.id === id);
      const name = await promptDialog('Rename environment', { value: env?.name || '', confirmLabel: 'Rename' });
      if (name === null) return;
      try {
        await environmentService.renameEnvironment(id, name);
        renderManager();
      } catch (err) {
        showToast(err.message.replace(/^\[environments\]\s*/, ''), 'error');
      }
    });

    row.querySelector('.env-delete')?.addEventListener('click', async (e) => {
      e.stopPropagation();
      const env = state.get('environments').find(en => en.id === id);
      const ok = await confirmDialog(`Delete "${env?.name}"?`, {
        message: 'Its variables will be deleted too.', confirmLabel: 'Delete', danger: true
      });
      if (!ok) return;
      await environmentService.deleteEnvironment(id);
      if (selectedEnvId === id) selectedEnvId = null;
      renderManager();
    });
  });

  // Variable editor for the selected environment — reuse the KV row markup
  // by rendering rows manually (requestView's renderKvEditor isn't exported).
  if (selected) {
    renderVarsEditor(
      overlay.querySelector('#env-vars-editor'),
      structuredClone(selected.variables || []),
      selected.id
    );
  }
}

/** Key-value editor for environment variables (same UX as params/headers). */
function renderVarsEditor(container, items, envId) {
  if (!container) return;
  container.innerHTML = '';

  const persist = () => environmentService.setVariables(envId, items);

  items.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = `kv-row${item.enabled ? '' : ' disabled'}`;
    row.innerHTML = `
      <input type="checkbox" ${item.enabled ? 'checked' : ''} aria-label="Enable variable">
      <input type="text" class="kv-input kv-key" placeholder="VARIABLE" value="${escapeHtml(item.key)}" spellcheck="false" autocomplete="off">
      <input type="text" class="kv-input kv-value" placeholder="value" value="${escapeHtml(item.value)}" spellcheck="false" autocomplete="off">
      <button class="kv-delete" title="Remove variable" aria-label="Remove variable">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M18 6 6 18M6 6l12 12"/>
        </svg>
      </button>`;

    const [checkbox] = row.querySelectorAll('input[type="checkbox"]');
    row.querySelector('.kv-key').addEventListener('input', (e) => {
      items[index].key = e.target.value;
      persist();
    });
    row.querySelector('.kv-value').addEventListener('input', (e) => {
      items[index].value = e.target.value;
      persist();
    });
    checkbox.addEventListener('change', () => {
      items[index].enabled = checkbox.checked;
      row.classList.toggle('disabled', !checkbox.checked);
      persist();
    });
    row.querySelector('.kv-delete').addEventListener('click', () => {
      items.splice(index, 1);
      persist();
      renderVarsEditor(container, items, envId);
    });

    container.appendChild(row);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'kv-add-btn';
  addBtn.innerHTML = `
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <path d="M5 12h14M12 5v14"/>
    </svg>
    Add variable`;
  addBtn.addEventListener('click', () => {
    items.push({ key: '', value: '', enabled: true });
    persist();
    renderVarsEditor(container, items, envId);
    const keys = container.querySelectorAll('.kv-key');
    keys[keys.length - 1]?.focus();
  });
  container.appendChild(addBtn);
}

/* ── View ────────────────────────────────────────────────────────────────── */

const environmentView = {
  init: () => {
    eventBus.on('environment:changed', (environments) => {
      environmentView.renderDropdown(environments);
    });

    // Switching environments in the header updates the active env in state.
    const selector = document.getElementById('environment-selector');
    if (selector) {
      selector.addEventListener('change', () => {
        state.setActiveEnvironmentId(selector.value || null);
        try {
          if (selector.value) {
            localStorage.setItem(ACTIVE_ENV_STORAGE_KEY, selector.value);
          } else {
            localStorage.removeItem(ACTIVE_ENV_STORAGE_KEY);
          }
        } catch { /* private mode — selection just won't persist */ }
      });
    }

    document.getElementById('env-manage-btn')?.addEventListener('click', () => {
      renderManager();
    });
  },

  renderDropdown: (environments) => {
    const selector = document.getElementById('environment-selector');
    if (!selector) return;

    const activeId = state.get('activeEnvironmentId');
    selector.innerHTML = `
      <option value="">No Environment</option>
      ${environments.map(env => `
        <option value="${escapeHtml(env.id)}"${env.id === activeId ? ' selected' : ''}>${escapeHtml(env.name)}</option>
      `).join('')}
    `;
  }
};

export default environmentView;
