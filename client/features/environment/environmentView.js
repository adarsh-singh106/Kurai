/**
 * ─────────────────────────────────────────────────────────────────────────────
 * [client/features/environment/environmentView.js]
 *
 * WHO I AM:    UI manager for Environments.
 * WHAT I OWN:  Updating the environment selector dropdown in the top header bar,
 *              triggering changes in active environment, and rendering the variable editor.
 * WHAT I DON'T: Bypassing CORS or sending requests.
 * WHO CALLS ME: client/main.js.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import eventBus from '../../core/eventBus.js';
import state from '../../core/state.js';
import { escapeHtml } from '../../core/utils.js';

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
      });
    }
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
