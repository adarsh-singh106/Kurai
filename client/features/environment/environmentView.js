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

const environmentView = {
  init: () => {
    eventBus.on('environment:changed', (environments) => {
      environmentView.renderDropdown(environments);
    });
  },

  renderDropdown: (environments) => {
    const selector = document.getElementById('environment-selector');
    if (!selector) return;

    selector.innerHTML = `
      <option value="">No Environment</option>
      ${environments.map(env => `<option value="${env.id}">${env.name}</option>`).join('')}
    `;
  }
};

export default environmentView;
